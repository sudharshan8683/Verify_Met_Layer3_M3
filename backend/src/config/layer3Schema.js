/**
 * Layer 3 (Physical-Digital Binding) — additive schema.
 * Only CREATE TABLE IF NOT EXISTS: nothing in the Layer 1/2 schema is touched,
 * so it is safe to run on every server start (re-runnable migration).
 *
 * Rollback (manual): DROP TABLE nameplate_comparisons; DROP TABLE qr_stickers;
 */
const { db } = require('./database');

function initLayer3Schema() {
  db.exec(`
    -- Every automatic nameplate comparison (audit trail for Feature 3.2)
    CREATE TABLE IF NOT EXISTS nameplate_comparisons (
      id TEXT PRIMARY KEY,
      instrument_id TEXT NOT NULL REFERENCES instruments(id),
      application_id TEXT,
      reference_url TEXT,
      candidate_url TEXT,
      reference_hash TEXT,
      candidate_hash TEXT,
      hamming_distance INTEGER,
      similarity_pct REAL,
      status TEXT NOT NULL,            -- 'MATCH', 'MISMATCH', 'NEEDS_REVIEW'
      threshold_match_max INTEGER,
      threshold_mismatch_min INTEGER,
      error TEXT,
      compared_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tamper-evident QR stickers (one active sticker per instrument)
    CREATE TABLE IF NOT EXISTS qr_stickers (
      id TEXT PRIMARY KEY,             -- printed on the sticker, e.g. STK-2026-A1B2C3
      instrument_id TEXT NOT NULL REFERENCES instruments(id),
      certificate_id TEXT REFERENCES certificates(id),
      status TEXT DEFAULT 'ACTIVE',    -- 'ACTIVE', 'COMPROMISED', 'REPLACED', 'REVOKED'
      applied_by TEXT,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      applied_geo_lat REAL,
      applied_geo_lng REAL,
      replaced_by TEXT,                -- id of the sticker that replaced this one
      last_report_reason TEXT,
      last_reported_by TEXT,
      last_reported_at DATETIME
    );
  `);
}

module.exports = { initLayer3Schema };
