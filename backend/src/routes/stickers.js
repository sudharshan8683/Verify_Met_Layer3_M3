const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { issueSticker, REPORT_REASONS } = require('../services/stickerService');

// --- tiny in-memory rate limiter for the public report endpoint (5 / minute / IP) ---
const hits = new Map();
function rateLimit(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 5) {
    return res.status(429).json({ success: false, error: 'Too many reports. Please try again in a minute.' });
  }
  recent.push(now);
  hits.set(key, recent);
  next();
}

// GET /api/stickers?instrument_id=...  — sticker history of an instrument
router.get('/', (req, res) => {
  try {
    const { instrument_id } = req.query;
    if (!instrument_id) {
      return res.status(400).json({ success: false, error: 'instrument_id query parameter is required.' });
    }
    const stickers = db.prepare(
      'SELECT * FROM qr_stickers WHERE instrument_id = ? ORDER BY applied_at DESC'
    ).all(instrument_id);
    res.json({ success: true, count: stickers.length, stickers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stickers/:id — public lookup of the ID printed on the sticker
router.get('/:id', (req, res) => {
  try {
    const sticker = db.prepare(`
      SELECT s.*, i.make, i.model, i.serial_number, i.premises_address,
             c.certificate_number, c.valid_until, c.status AS certificate_status
      FROM qr_stickers s
      JOIN instruments i ON i.id = s.instrument_id
      LEFT JOIN certificates c ON c.id = s.certificate_id
      WHERE s.id = ?
    `).get(req.params.id);
    if (!sticker) return res.status(404).json({ success: false, error: 'Unknown sticker ID.' });

    const trusted = sticker.status === 'ACTIVE' && sticker.certificate_status === 'VALID';
    res.json({
      success: true,
      trusted,
      warning: trusted ? null : 'Do not rely on this sticker. It is not the current valid sticker for this instrument.',
      sticker
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/stickers/:id/report
 * Body: { reason: PEELED|MOVED|DAMAGED|MISSING, reported_by?, note? }
 * Open to citizens, owners and inspectors (no login: same as the public page).
 * Records the event, marks the sticker COMPROMISED and — for PEELED / MOVED —
 * raises a STICKER_TAMPER risk flag on the instrument for the admin panel.
 */
router.post('/:id/report', rateLimit, (req, res) => {
  try {
    const { reason, reported_by, note } = req.body;
    if (!REPORT_REASONS[reason]) {
      return res.status(400).json({
        success: false,
        error: `reason must be one of: ${Object.keys(REPORT_REASONS).join(', ')}`
      });
    }
    const sticker = db.prepare('SELECT * FROM qr_stickers WHERE id = ?').get(req.params.id);
    if (!sticker) return res.status(404).json({ success: false, error: 'Unknown sticker ID.' });

    const cleanNote = String(note || '').replace(/<[^>]*>/g, '').trim().slice(0, 500);
    const reporter = reported_by || 'public';

    db.prepare(`
      UPDATE qr_stickers
      SET status = CASE WHEN status = 'ACTIVE' THEN 'COMPROMISED' ELSE status END,
          last_report_reason = ?, last_reported_by = ?, last_reported_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reason, reporter, sticker.id);

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, 'STICKER_REPORTED', 'INSTRUMENT', ?, ?)
    `).run(
      'log-stk-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      reported_by || null,
      sticker.instrument_id,
      `Sticker ${sticker.id}: ${reason} — ${REPORT_REASONS[reason]}${cleanNote ? ` | note: ${cleanNote}` : ''}`
    );

    let flagged = false;
    if (reason === 'PEELED' || reason === 'MOVED') {
      const existing = db.prepare(`
        SELECT id FROM risk_flags
        WHERE entity_id = ? AND flag_type = 'STICKER_TAMPER' AND status = 'ACTIVE'
      `).get(sticker.instrument_id);
      if (!existing) {
        db.prepare(`
          INSERT INTO risk_flags (id, entity_type, entity_id, flag_type, score, details, status)
          VALUES (?, 'INSTRUMENT', ?, 'STICKER_TAMPER', ?, ?, 'ACTIVE')
        `).run(
          'flag-stk-' + Date.now(),
          sticker.instrument_id,
          reason === 'MOVED' ? 85.0 : 70.0,
          JSON.stringify({
            sticker_id: sticker.id,
            certificate_id: sticker.certificate_id,
            reported_reason: reason,
            note: cleanNote,
            reason: REPORT_REASONS[reason]
          })
        );
        flagged = true;
      }
    }

    res.status(201).json({
      success: true,
      sticker_id: sticker.id,
      new_status: sticker.status === 'ACTIVE' ? 'COMPROMISED' : sticker.status,
      risk_flag_raised: flagged,
      next_step: 'A Legal Metrology Officer must re-verify the instrument and apply a NEW sticker.'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/stickers/:id/replace
 * Body: { officer_id, geo_lat?, geo_lng? }
 * Only LMO / GATC / ADMIN users. Old sticker -> REPLACED, new one ACTIVE.
 */
router.post('/:id/replace', (req, res) => {
  try {
    const { officer_id, geo_lat, geo_lng } = req.body;
    const officer = officer_id
      ? db.prepare('SELECT id, role FROM users WHERE id = ?').get(officer_id)
      : null;
    if (!officer || !['LMO', 'GATC', 'ADMIN'].includes(officer.role)) {
      return res.status(403).json({ success: false, error: 'Only a Legal Metrology officer or admin can replace a sticker.' });
    }
    const old = db.prepare('SELECT * FROM qr_stickers WHERE id = ?').get(req.params.id);
    if (!old) return res.status(404).json({ success: false, error: 'Unknown sticker ID.' });
    if (old.status === 'REPLACED') {
      return res.status(409).json({ success: false, error: 'Sticker was already replaced.' });
    }

    const newId = issueSticker({
      instrumentId: old.instrument_id,
      certificateId: old.certificate_id,
      appliedBy: officer.id,
      geoLat: geo_lat !== undefined ? Number(geo_lat) : null,
      geoLng: geo_lng !== undefined ? Number(geo_lng) : null
    });
    // issueSticker only retires ACTIVE stickers; also retire a COMPROMISED one
    db.prepare(`UPDATE qr_stickers SET status = 'REPLACED', replaced_by = ? WHERE id = ?`).run(newId, old.id);

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, 'STICKER_REPLACED', 'INSTRUMENT', ?, ?)
    `).run('log-stkr-' + Date.now() + '-' + Math.floor(Math.random() * 1000), officer.id, old.instrument_id, `Sticker ${old.id} replaced by ${newId}`);

    res.status(201).json({ success: true, old_sticker_id: old.id, new_sticker_id: newId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
