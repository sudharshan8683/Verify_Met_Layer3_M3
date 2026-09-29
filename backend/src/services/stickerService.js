/**
 * Tamper-evident QR sticker lifecycle (Layer 3, Feature 3.2).
 * See /docs/LAYER3_STICKER_SPEC.md for the physical + process specification.
 */
const crypto = require('node:crypto');
const { db } = require('../config/database');

function newStickerId() {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `STK-${new Date().getFullYear()}-${rand}`;
}

/**
 * Apply a new sticker at certification. Any earlier ACTIVE sticker on the same
 * instrument becomes REPLACED. Safe to call inside an open transaction.
 */
function issueSticker({ instrumentId, certificateId, appliedBy, geoLat, geoLng }) {
  const id = newStickerId();
  db.prepare(`
    UPDATE qr_stickers SET status = 'REPLACED', replaced_by = ?
    WHERE instrument_id = ? AND status = 'ACTIVE'
  `).run(id, instrumentId);

  db.prepare(`
    INSERT INTO qr_stickers (id, instrument_id, certificate_id, status, applied_by, applied_geo_lat, applied_geo_lng)
    VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?)
  `).run(id, instrumentId, certificateId || null, appliedBy || null,
    geoLat ?? null, geoLng ?? null);
  return id;
}

const REPORT_REASONS = {
  PEELED: 'Sticker found peeled / destroyed (void pattern visible)',
  MOVED: 'Sticker found on a different instrument than the one it was issued for',
  DAMAGED: 'Sticker damaged or unreadable (genuine wear)',
  MISSING: 'Sticker missing from the instrument'
};

module.exports = { issueSticker, newStickerId, REPORT_REASONS };
