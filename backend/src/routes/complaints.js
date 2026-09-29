const express = require('express');
const router = express.Router();
const { db } = require('../config/database');

// In-Memory Rate Limiter for public endpoint (no external Redis dependency needed)
const rateLimitWindowMs = 60 * 1000; // 1 minute
const maxRequestsPerWindow = 5;
const ipRequestHistory = new Map();

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const now = Date.now();

  const history = ipRequestHistory.get(ip) || [];
  // Keep only requests within the last minute
  const recent = history.filter(timestamp => now - timestamp < rateLimitWindowMs);

  if (recent.length >= maxRequestsPerWindow) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded: Too many requests from this address. Please wait before submitting another report.'
    });
  }

  recent.push(now);
  ipRequestHistory.set(ip, recent);
  next();
}

/**
 * Basic spam filter & text sanitizer
 */
function sanitizeAndValidateText(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length < 10) return { valid: false, error: 'Complaint description is too short. Please provide at least 10 characters detailing the discrepancy.' };
  if (trimmed.length > 2000) return { valid: false, error: 'Complaint description is too long (maximum 2000 characters).' };

  // Check for repeated spam characters
  if (/([a-zA-Z0-9])\1{9,}/.test(trimmed)) {
    return { valid: false, error: 'Submission rejected by automated spam detection filter.' };
  }

  // Sanitize: strip script tags or HTML
  const sanitized = trimmed.replace(/<[^>]*>?/gm, '');
  return { valid: true, text: sanitized };
}

/**
 * POST /api/complaints
 * Public / No-Login Citizen "Report a Concern" Endpoint
 */
router.post('/', rateLimiter, (req, res) => {
  try {
    const { certificate_id, certificate_number, complainant_name, complainant_phone, description, evidence_photo_url } = req.body || {};

    // 1. Spam & Content Validation
    const textCheck = sanitizeAndValidateText(description);
    if (!textCheck || !textCheck.valid) {
      return res.status(400).json({ success: false, error: textCheck ? textCheck.error : 'Description is required.' });
    }
    const cleanDescription = textCheck.text;

    // 2. Validate Certificate
    let cert = null;
    if (certificate_id) {
      cert = db.prepare('SELECT id, certificate_number, officer_id, instrument_id FROM certificates WHERE id = ?').get(certificate_id);
    } else if (certificate_number) {
      cert = db.prepare('SELECT id, certificate_number, officer_id, instrument_id FROM certificates WHERE certificate_number = ?').get(certificate_number);
    }

    if (!cert) {
      return res.status(404).json({
        success: false,
        error: 'Invalid Certificate: No verified Legal Metrology certificate matches the supplied identifier.'
      });
    }

    // Fetch linked instrument and merchant
    const inst = db.prepare('SELECT owner_id, make, model, serial_number FROM instruments WHERE id = ?').get(cert.instrument_id);
    const merchantId = inst ? inst.owner_id : null;

    const complaintId = 'comp-' + Date.now();
    const submittedAt = new Date().toISOString();

    // 3. Store in public_complaints (Layer 1 table)
    db.prepare(`
      INSERT INTO public_complaints (id, certificate_id, complainant_name, complainant_phone, description, evidence_photo_url, status, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING_REVIEW', ?)
    `).run(
      complaintId,
      cert.id,
      complainant_name ? complainant_name.trim().slice(0, 100) : 'Anonymous Citizen',
      complainant_phone ? complainant_phone.trim().slice(0, 20) : 'Confidential',
      cleanDescription,
      evidence_photo_url || null,
      submittedAt
    );

    // 4. Complaint -> Red Flag Engine Integration
    // Check if there is already an active complaint flag for this inspector
    const existingFlag = db.prepare(`
      SELECT id, score, details FROM risk_flags 
      WHERE entity_id = ? AND flag_type = 'PUBLIC_COMPLAINT_LOGGED' AND status = 'ACTIVE'
    `).get(cert.officer_id);

    if (existingFlag) {
      let detailsObj = {};
      try { detailsObj = JSON.parse(existingFlag.details); } catch (e) { detailsObj = {}; }
      const complaintList = detailsObj.complaints || [];
      complaintList.push({ complaint_id: complaintId, excerpt: cleanDescription.slice(0, 100), submitted_at: submittedAt });
      
      const newScore = Math.min(95.0, existingFlag.score + 15.0);
      detailsObj.complaints = complaintList;
      detailsObj.complaint_count = complaintList.length;
      detailsObj.reason = `Accumulated ${complaintList.length} citizen public complaints against verified instruments.`;

      db.prepare(`
        UPDATE risk_flags 
        SET score = ?, details = ? 
        WHERE id = ?
      `).run(newScore, JSON.stringify(detailsObj), existingFlag.id);
    } else {
      const initialDetails = {
        officer_id: cert.officer_id,
        certificate_number: cert.certificate_number,
        complaint_count: 1,
        complaints: [{ complaint_id: complaintId, excerpt: cleanDescription.slice(0, 100), submitted_at: submittedAt }],
        reason: `Citizen logged a short-weighting/tampering concern against certificate ${cert.certificate_number}.`,
        suspected: 'Calibration inaccuracy / scale tampering'
      };

      db.prepare(`
        INSERT INTO risk_flags (id, entity_type, entity_id, flag_type, score, details, status)
        VALUES (?, 'INSPECTOR', ?, 'PUBLIC_COMPLAINT_LOGGED', 45.0, ?, 'ACTIVE')
      `).run('flag-comp-' + Date.now(), cert.officer_id, JSON.stringify(initialDetails));
    }

    // 5. Notification Hooks (in_app and whatsapp channels)
    // Hook 1: in_app alert to the Inspector
    db.prepare(`
      INSERT INTO notifications (id, user_id, title, message, channel, delivery_status)
      VALUES (?, ?, ?, ?, 'in_app', 'DELIVERED')
    `).run(
      'notif-comp-app-' + Date.now(),
      cert.officer_id,
      'Citizen Complaint Logged',
      `A concern was reported by a consumer against certificate ${cert.certificate_number}. Please review the observations.`
    );

    // Hook 2: whatsapp notification hook for Merchant (M3 handles provider dispatch)
    if (merchantId) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, title, message, channel, delivery_status)
        VALUES (?, ?, ?, ?, 'whatsapp', 'DELIVERED')
      `).run(
        'notif-comp-wa-' + Date.now(),
        merchantId,
        'Consumer Notice Received',
        `A citizen reported a weight discrepancy on instrument ${inst?.make} ${inst?.model} (S/N: ${inst?.serial_number}). Verification status is under department review.`
      );
    }

    res.status(201).json({
      success: true,
      message: 'Concern registered securely. Legal Metrology enforcement team alerted for immediate investigation.',
      complaint_id: complaintId,
      certificate_number: cert.certificate_number,
      status: 'PENDING_REVIEW',
      submitted_at: submittedAt
    });

  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error while processing concern.' });
  }
});

// List all complaints (Admin surveillance)
router.get('/', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT pc.*, c.certificate_number, i.make, i.model, i.serial_number, u.name as merchant_name, off.name as inspector_name
      FROM public_complaints pc
      JOIN certificates c ON pc.certificate_id = c.id
      JOIN instruments i ON c.instrument_id = i.id
      JOIN users u ON i.owner_id = u.id
      JOIN users off ON c.officer_id = off.id
      ORDER BY pc.submitted_at DESC
    `);
    const complaints = stmt.all();
    res.json({ success: true, count: complaints.length, complaints });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
