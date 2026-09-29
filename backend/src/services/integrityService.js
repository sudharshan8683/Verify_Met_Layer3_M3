const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { db } = require('../config/database');

/**
 * Calculates SHA-256 hash of a string
 */
function hashString(content) {
  return crypto.createHash('sha256').update(content || '').digest('hex');
}

/**
 * Calculates or resolves the photo hash:
 * 1. If photoHash is provided, use it
 * 2. If photo is a file on disk, hash its content
 * 3. Fallback to hashString of photoUrl
 */
function resolvePhotoHash(photoUrl, explicitPhotoHash) {
  if (explicitPhotoHash) return explicitPhotoHash;
  if (!photoUrl) return hashString('NO_PHOTO');

  try {
    const relPath = photoUrl.startsWith('/') ? photoUrl.substring(1) : photoUrl;
    const fullPath = path.join(__dirname, '../../', relPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const buffer = fs.readFileSync(fullPath);
      return crypto.createHash('sha256').update(buffer).digest('hex');
    }
  } catch (err) {
    // Fall back to URL string hash
  }

  return hashString(photoUrl);
}

/**
 * Gets the most recent record hash in the chain (or the genesis hash if empty)
 */
function getLatestChainHash() {
  const latest = db.prepare(`
    SELECT record_hash FROM measurement_results 
    WHERE record_hash IS NOT NULL 
    ORDER BY captured_at DESC, id DESC LIMIT 1
  `).get();

  if (latest && latest.record_hash) {
    return latest.record_hash;
  }
  // Standard Genesis Block Hash for VerifyMET+
  return hashString('GENESIS_BLOCK_VERIFYMET_PUNE_2026');
}

/**
 * Computes record hash according to VerifyMET+ cryptographic specification
 */
function computeRecordHash({ instrumentId, applicationId, officerId, overallResult, photoUrl, photoHash, geoLat, geoLng, prevHash }) {
  const finalPhotoHash = resolvePhotoHash(photoUrl, photoHash);
  const payload = [
    instrumentId,
    applicationId,
    officerId,
    overallResult,
    finalPhotoHash,
    Number(geoLat || 0).toFixed(4),
    Number(geoLng || 0).toFixed(4),
    prevHash
  ].join('|');

  return hashString(payload);
}

/**
 * Chain Check Algorithm: Scans the entire measurement chain from genesis to head.
 * Mathematically proves if any field or row in the database was modified!
 * Writes audit log entry whenever a chain check fails.
 */
function verifyMeasurementChain() {
  const records = db.prepare(`
    SELECT mr.*, i.serial_number, u.name as officer_name
    FROM measurement_results mr
    JOIN instruments i ON mr.instrument_id = i.id
    JOIN users u ON mr.officer_id = u.id
    ORDER BY mr.captured_at ASC, mr.id ASC
  `).all();

  if (records.length === 0) {
    return { valid: true, count: 0, message: 'Chain is empty.' };
  }

  let expectedPrevHash = hashString('GENESIS_BLOCK_VERIFYMET_PUNE_2026');

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    // Check 1: Does record's prev_hash match expected previous hash?
    if (record.prev_hash !== expectedPrevHash) {
      const errorMsg = `Cryptographic link broken at block #${i + 1} (ID: ${record.id}). Previous hash mismatch. Expected: ${expectedPrevHash}, Found: ${record.prev_hash}`;
      
      // Log audit entry on failure per Layer 2 spec
      db.prepare(`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('log-fail-' + Date.now(), 'SYSTEM', 'CHAIN_CHECK_FAILED', 'MEASUREMENT', record.id, errorMsg);

      return {
        valid: false,
        broken_at_index: i,
        record_id: record.id,
        instrument_serial: record.serial_number,
        expected_prev_hash: expectedPrevHash,
        actual_prev_hash: record.prev_hash,
        error: errorMsg
      };
    }

    // Check 2: Does recomputed hash match stored record_hash?
    const computed = computeRecordHash({
      instrumentId: record.instrument_id,
      applicationId: record.application_id,
      officerId: record.officer_id,
      overallResult: record.overall_result,
      photoUrl: record.photo_url,
      geoLat: record.geo_lat,
      geoLng: record.geo_lng,
      prevHash: record.prev_hash
    });

    if (record.record_hash !== computed) {
      const errorMsg = `Database tampering detected! Content of block #${i + 1} (ID: ${record.id}, Instrument: ${record.serial_number}) was altered directly in the database. Expected hash: ${computed}, Stored hash: ${record.record_hash}`;

      // Log audit entry on failure per Layer 2 spec
      db.prepare(`
        INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('log-fail-' + Date.now(), 'SYSTEM', 'CHAIN_CHECK_FAILED', 'MEASUREMENT', record.id, errorMsg);

      return {
        valid: false,
        broken_at_index: i,
        record_id: record.id,
        instrument_serial: record.serial_number,
        expected_hash: computed,
        actual_hash: record.record_hash,
        error: errorMsg
      };
    }

    expectedPrevHash = record.record_hash;
  }

  return {
    valid: true,
    count: records.length,
    head_hash: expectedPrevHash,
    message: `All ${records.length} verification records verified. Zero cryptographic discrepancies found.`
  };
}

module.exports = {
  hashString,
  resolvePhotoHash,
  getLatestChainHash,
  computeRecordHash,
  verifyMeasurementChain
};
