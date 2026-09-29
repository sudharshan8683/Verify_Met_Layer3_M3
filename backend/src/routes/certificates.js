const express = require('express');
const router = express.Router();
const { db } = require('../config/database');

// List certificates
router.get('/', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT c.*, 
        i.make, i.model, i.serial_number, i.category, i.premises_address, i.nameplate_photo_url,
        u.name as owner_name, o.name as org_name,
        off.name as officer_name
      FROM certificates c
      JOIN instruments i ON c.instrument_id = i.id
      JOIN users u ON i.owner_id = u.id
      LEFT JOIN organizations o ON u.organization_id = o.id
      JOIN users off ON c.officer_id = off.id
      ORDER BY c.issue_date DESC
    `);
    const certificates = stmt.all();
    res.json({ success: true, count: certificates.length, certificates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public Verification Portal: Look up certificate by Certificate Number or QR hash
router.get('/verify/:certNumber', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT c.*, 
        i.make, i.model, i.serial_number, i.category, i.capacity, i.premises_address, 
        i.nameplate_photo_url, i.geo_lat as inst_lat, i.geo_lng as inst_lng,
        u.name as owner_name, o.name as org_name,
        off.name as officer_name,
        mr.record_hash, mr.captured_at, mr.photo_url as display_photo_url
      FROM certificates c
      JOIN instruments i ON c.instrument_id = i.id
      JOIN users u ON i.owner_id = u.id
      LEFT JOIN organizations o ON u.organization_id = o.id
      JOIN users off ON c.officer_id = off.id
      LEFT JOIN measurement_results mr ON mr.application_id = c.application_id
      WHERE c.certificate_number = ?
    `);

    const certificate = stmt.get(req.params.certNumber);
    if (!certificate) {
      return res.status(404).json({
        success: false,
        verified: false,
        error: 'Invalid Certificate Number. No authentic Legal Metrology record exists.'
      });
    }

    // Check expiry
    const today = new Date().toISOString().split('T')[0];
    const isExpired = today > certificate.valid_until;

    // Layer 3: current tamper-evident sticker for this instrument (table may be absent on old DBs)
    let sticker = null;
    try {
      sticker = db.prepare(`
        SELECT id, status, applied_at FROM qr_stickers
        WHERE instrument_id = ? AND status IN ('ACTIVE', 'COMPROMISED')
        ORDER BY applied_at DESC LIMIT 1
      `).get(certificate.instrument_id) || null;
    } catch (e) { sticker = null; }

    res.json({
      success: true,
      verified: true,
      sticker,
      status: isExpired ? 'EXPIRED' : certificate.status,
      certificate: {
        certificate_number: certificate.certificate_number,
        issue_date: certificate.issue_date,
        valid_until: certificate.valid_until,
        status: isExpired ? 'EXPIRED' : certificate.status,
        instrument: {
          category: certificate.category,
          make: certificate.make,
          model: certificate.model,
          serial_number: certificate.serial_number,
          capacity: certificate.capacity,
          premises_address: certificate.premises_address,
          nameplate_photo_url: certificate.nameplate_photo_url,
          display_photo_url: certificate.display_photo_url
        },
        merchant: {
          name: certificate.owner_name,
          organization: certificate.org_name
        },
        inspector: {
          name: certificate.officer_name,
          verified_at: certificate.captured_at,
          record_hash: certificate.record_hash
        },
        qr_payload: certificate.qr_payload
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
