const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { compareNameplates } = require('../services/perceptualHash');

/**
 * POST /api/nameplate/compare
 * Body: { instrument_id, candidate_photo_url, application_id?, compared_by?, persist? }
 *  - candidate_photo_url: data: URI, /uploads/... path or http(s) URL
 *  - persist (default true): false = live "preview" check, nothing is written
 * Compares the new nameplate photo with the one registered for the instrument
 * using a perceptual hash. Uncertain / unreadable => NEEDS_REVIEW (manual review).
 */
router.post('/compare', async (req, res) => {
  try {
    const { instrument_id, candidate_photo_url, application_id, compared_by } = req.body;
    const persist = req.body.persist !== false;

    if (!instrument_id || !candidate_photo_url) {
      return res.status(400).json({
        success: false,
        error: 'instrument_id and candidate_photo_url are required.'
      });
    }

    const inst = db.prepare(
      'SELECT id, owner_id, serial_number, nameplate_photo_url FROM instruments WHERE id = ?'
    ).get(instrument_id);
    if (!inst) return res.status(404).json({ success: false, error: 'Instrument not found.' });
    if (!inst.nameplate_photo_url) {
      return res.status(409).json({
        success: false,
        error: 'Instrument has no registered nameplate photo to compare against.'
      });
    }

    const result = await compareNameplates(inst.nameplate_photo_url, candidate_photo_url);

    if (persist) {
      const cmpId = 'npc-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      // Keep data: URIs out of the table (large) — store a short marker instead
      const shortUrl = (u) => (typeof u === 'string' && u.startsWith('data:') ? `${u.slice(0, 40)}…[inline ${u.length}B]` : u);

      db.prepare(`
        INSERT INTO nameplate_comparisons (
          id, instrument_id, application_id, reference_url, candidate_url,
          reference_hash, candidate_hash, hamming_distance, similarity_pct, status,
          threshold_match_max, threshold_mismatch_min, error, compared_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cmpId, instrument_id, application_id || null,
        shortUrl(inst.nameplate_photo_url), shortUrl(candidate_photo_url),
        result.reference_hash, result.candidate_hash, result.distance, result.similarity_pct,
        result.status, result.thresholds.match_max, result.thresholds.mismatch_min,
        result.error, compared_by || null
      );

      db.prepare(`
        UPDATE instruments SET last_photo_match_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(result.status, instrument_id);

      db.prepare(`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
        VALUES (?, ?, ?, 'INSTRUMENT', ?, ?)
      `).run(
        'log-npc-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        compared_by || null,
        'NAMEPLATE_AUTO_COMPARE',
        instrument_id,
        `pHash ${result.status} (distance=${result.distance}, similarity=${result.similarity_pct}%)`
      );

      // A confirmed automatic mismatch raises a risk flag on the instrument
      if (result.status === 'MISMATCH') {
        const existing = db.prepare(`
          SELECT id FROM risk_flags
          WHERE entity_id = ? AND flag_type = 'NAMEPLATE_MISMATCH' AND status = 'ACTIVE'
        `).get(instrument_id);
        if (!existing) {
          db.prepare(`
            INSERT INTO risk_flags (id, entity_type, entity_id, flag_type, score, details, status)
            VALUES (?, 'INSTRUMENT', ?, 'NAMEPLATE_MISMATCH', 80.0, ?, 'ACTIVE')
          `).run(
            'flag-np-' + Date.now(),
            instrument_id,
            JSON.stringify({
              serial_number: inst.serial_number,
              owner_id: inst.owner_id,
              hamming_distance: result.distance,
              similarity_pct: result.similarity_pct,
              comparison_id: cmpId,
              reason: 'New nameplate photo does not match the nameplate registered for this instrument (possible sticker/plate swap).'
            })
          );
        }
      }
      result.comparison_id = cmpId;
    }

    // Do not echo the full hashes' internals unless useful; they are short (64 hex)
    res.json({ success: true, persisted: persist, instrument_id, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/nameplate/:instrumentId/history — comparison history for admin view
router.get('/:instrumentId/history', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, application_id, hamming_distance, similarity_pct, status,
             threshold_match_max, threshold_mismatch_min, error, compared_by, created_at
      FROM nameplate_comparisons WHERE instrument_id = ? ORDER BY created_at DESC LIMIT 50
    `).all(req.params.instrumentId);
    const inst = db.prepare(
      'SELECT last_photo_match_status FROM instruments WHERE id = ?'
    ).get(req.params.instrumentId);
    res.json({
      success: true,
      instrument_id: req.params.instrumentId,
      current_status: inst ? inst.last_photo_match_status : null,
      count: rows.length,
      comparisons: rows
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
