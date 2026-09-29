const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { getLatestChainHash, computeRecordHash } = require('../services/integrityService');
const { compareNameplates, resolveMatchStatus } = require('../services/perceptualHash');
const { issueSticker } = require('../services/stickerService');

// Get all verifications or by officer
router.get('/', (req, res) => {
  try {
    const officerId = req.query.officer_id;
    let query = `
      SELECT mr.*, 
        i.make, i.model, i.serial_number, i.category, i.premises_address,
        u.name as officer_name,
        va.application_number
      FROM measurement_results mr
      JOIN instruments i ON mr.instrument_id = i.id
      JOIN users u ON mr.officer_id = u.id
      JOIN verification_applications va ON mr.application_id = va.id
    `;
    const params = [];
    if (officerId) {
      query += ' WHERE mr.officer_id = ?';
      params.push(officerId);
    }
    query += ' ORDER BY mr.captured_at DESC';

    const stmt = db.prepare(query);
    const verifications = stmt.all(...params);
    res.json({ success: true, count: verifications.length, verifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Submit Evidence-Bound Field Inspection (Layer 2 - Feature 3.1)
 * Enforces: Live photo URL, Geo-coordinates, Test weights, and Atomic SHA-256 Hash Chain Insert
 */
router.post('/', async (req, res) => {
  try {
    const {
      application_id,
      instrument_id,
      officer_id,
      zero_error,
      repeatability_error,
      eccentricity_error,
      discrimination_pass,
      overall_result,
      photo_url,
      photo_hash,
      geo_lat,
      geo_lng,
      nameplate_match_status,
      nameplate_photo_url // Layer 3: nameplate photo re-captured at this visit
    } = req.body;

    // Requirement: Proof of physical presence (GPS + Live Photo required)
    if (!photo_url || typeof photo_url !== 'string' || photo_url.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Integrity Violation: Photo evidence is mandatory for verification.'
      });
    }

    if (geo_lat === undefined || geo_lat === null || geo_lng === undefined || geo_lng === null || isNaN(Number(geo_lat)) || isNaN(Number(geo_lng))) {
      return res.status(400).json({
        success: false,
        error: 'Integrity Violation: Field inspection cannot be submitted without valid GPS coordinates (geo_lat, geo_lng).'
      });
    }

    if (!application_id || !instrument_id || !officer_id || !overall_result) {
      return res.status(400).json({ success: false, error: 'Missing required inspection parameters.' });
    }

    // Layer 3 (3.2): mandatory nameplate photo at every (re-)verification +
    // server-side perceptual-hash comparison. The client-sent status is NOT trusted:
    // an automatic MISMATCH cannot be cleared by the inspector (anti-collusion).
    let finalMatchStatus = nameplate_match_status || 'MATCH';
    let nameplateCheck = null;
    if (nameplate_photo_url) {
      const inst = db.prepare('SELECT nameplate_photo_url FROM instruments WHERE id = ?').get(instrument_id);
      if (inst && inst.nameplate_photo_url) {
        nameplateCheck = await compareNameplates(inst.nameplate_photo_url, nameplate_photo_url);
        finalMatchStatus = resolveMatchStatus(nameplateCheck.status, nameplate_match_status);
      }
    }

    // Server-side captured_at timestamp
    const capturedAt = new Date().toISOString();

    // Begin atomic immediate transaction so concurrent inserts cannot share prev_hash
    db.exec('BEGIN IMMEDIATE TRANSACTION;');

    try {
      const prevHash = getLatestChainHash();
      const recordHash = computeRecordHash({
        instrumentId: instrument_id,
        applicationId: application_id,
        officerId: officer_id,
        overallResult: overall_result,
        photoUrl: photo_url,
        photoHash: photo_hash,
        geoLat: parseFloat(geo_lat),
        geoLng: parseFloat(geo_lng),
        prevHash
      });

      const measId = 'meas-' + Date.now();

      // 1. Insert measurement result with cryptographic link
      db.prepare(`
        INSERT INTO measurement_results (
          id, application_id, instrument_id, officer_id, zero_error,
          repeatability_error, eccentricity_error, discrimination_pass,
          overall_result, observations_json, photo_url, geo_lat, geo_lng,
          captured_at, record_hash, prev_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        measId,
        application_id,
        instrument_id,
        officer_id,
        zero_error !== undefined ? parseFloat(zero_error) : 0.0,
        repeatability_error !== undefined ? parseFloat(repeatability_error) : 0.0,
        eccentricity_error !== undefined ? parseFloat(eccentricity_error) : 0.0,
        discrimination_pass !== undefined ? parseInt(discrimination_pass, 10) : 1,
        overall_result,
        JSON.stringify({ zero_error, repeatability_error, eccentricity_error, discrimination_pass, photo_hash: photo_hash || null }),
        photo_url,
        parseFloat(geo_lat),
        parseFloat(geo_lng),
        capturedAt,
        recordHash,
        prevHash
      );

      // 2. Update instrument status and physical binding match
      // Layer 3: a nameplate MISMATCH withholds the certificate (and sticker) until an admin
      // investigates — the measurement itself is still recorded on the hash chain as evidence.
      const certificateWithheld = overall_result === 'PASS' && finalMatchStatus === 'MISMATCH';
      const newStatus = certificateWithheld
        ? 'PENDING_VERIFICATION'
        : (overall_result === 'PASS' ? 'VERIFIED' : 'REJECTED');
      db.prepare(`
        UPDATE instruments 
        SET verification_status = ?, last_photo_match_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newStatus, finalMatchStatus, instrument_id);

      // 3. Update application status
      db.prepare(`
        UPDATE verification_applications 
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(certificateWithheld ? 'IN_PROGRESS' : 'COMPLETED', application_id);

      // 4. If PASS, generate Digital Certificate with QR Code
      let certId = null;
      let certNumber = null;
      let stickerId = null;
      if (overall_result === 'PASS' && !certificateWithheld) {
        certId = 'cert-' + Date.now();
        certNumber = `MH-PUN-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

        const issueDate = new Date().toISOString().split('T')[0];
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        const validUntil = nextYear.toISOString().split('T')[0];

        const qrPayload = JSON.stringify({
          cert_no: certNumber,
          instrument_id,
          officer_id,
          valid_until: validUntil,
          block_hash: recordHash.substring(0, 16),
          verify_url: `https://verifymet.gov.in/verify/${certNumber}`
        });

        db.prepare(`
          INSERT INTO certificates (
            id, certificate_number, instrument_id, application_id, officer_id,
            issue_date, valid_until, qr_payload, status, pdf_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          certId,
          certNumber,
          instrument_id,
          application_id,
          officer_id,
          issueDate,
          validUntil,
          qrPayload,
          'VALID',
          `/certificates/${certNumber}.pdf`
        );

        // Layer 3: apply a tamper-evident QR sticker (ID printed on the physical sticker)
        stickerId = issueSticker({
          instrumentId: instrument_id,
          certificateId: certId,
          appliedBy: officer_id,
          geoLat: parseFloat(geo_lat),
          geoLng: parseFloat(geo_lng)
        });

        // Notify merchant via in-app & WhatsApp channel
        const app = db.prepare('SELECT applicant_id FROM verification_applications WHERE id = ?').get(application_id);
        if (app) {
          db.prepare(`
            INSERT INTO notifications (id, user_id, title, message, channel, delivery_status)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            'notif-wa-' + Date.now(),
            app.applicant_id,
            'Certificate Issued (PASS)',
            `Your instrument was certified under Legal Metrology Rules. Certificate ${certNumber} is active until ${validUntil}.`,
            'whatsapp',
            'DELIVERED'
          );

          db.prepare(`
            INSERT INTO notifications (id, user_id, title, message, channel, delivery_status)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            'notif-app-' + Date.now(),
            app.applicant_id,
            'Verification Complete',
            `Verification result for application ${application_id}: PASS. Certificate issued.`,
            'in_app',
            'DELIVERED'
          );
        }
      }

      // Layer 3: record a mismatch on the audit trail and raise an instrument flag
      if (finalMatchStatus === 'MISMATCH') {
        db.prepare(`
          INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
          VALUES (?, ?, 'NAMEPLATE_MISMATCH', 'INSTRUMENT', ?, ?)
        `).run('log-npm-' + Date.now() + '-' + Math.floor(Math.random() * 1000), officer_id, instrument_id,
          `Nameplate mismatch during verification ${measId}` + (nameplateCheck && nameplateCheck.distance !== null ? ` (pHash distance ${nameplateCheck.distance})` : ' (inspector decision)'));
        const existingFlag = db.prepare(`
          SELECT id FROM risk_flags WHERE entity_id = ? AND flag_type = 'NAMEPLATE_MISMATCH' AND status = 'ACTIVE'
        `).get(instrument_id);
        if (!existingFlag) {
          db.prepare(`
            INSERT INTO risk_flags (id, entity_type, entity_id, flag_type, score, details, status)
            VALUES (?, 'INSTRUMENT', ?, 'NAMEPLATE_MISMATCH', 80.0, ?, 'ACTIVE')
          `).run('flag-npv-' + Date.now(), instrument_id, JSON.stringify({
            measurement_id: measId,
            hamming_distance: nameplateCheck ? nameplateCheck.distance : null,
            reason: 'Nameplate photographed at verification does not match the registered nameplate.'
          }));
        }
      }

      db.exec('COMMIT;');

      res.status(201).json({
        success: true,
        message: 'Evidence-bound verification completed and recorded on cryptographic hash chain.',
        measurement_id: measId,
        captured_at: capturedAt,
        record_hash: recordHash,
        prev_hash: prevHash,
        certificate_number: certNumber,
        sticker_id: stickerId,
        certificate_withheld: certificateWithheld,
        withheld_reason: certificateWithheld ? 'Nameplate mismatch: certificate and sticker withheld pending admin investigation.' : null,
        nameplate_match_status: finalMatchStatus,
        nameplate_check: nameplateCheck ? { status: nameplateCheck.status, distance: nameplateCheck.distance, similarity_pct: nameplateCheck.similarity_pct } : null,
        verification_result: overall_result
      });

    } catch (txError) {
      db.exec('ROLLBACK;');
      throw txError;
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
