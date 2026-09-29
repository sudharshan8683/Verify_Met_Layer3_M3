const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { verifyMeasurementChain } = require('../services/integrityService');

// Verify entire cryptographic hash chain across all inspection records
router.get('/chain-check', (req, res) => {
  try {
    const report = verifyMeasurementChain();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      report
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Demo / Judge Endpoint: Deliberately modify a field in SQLite to demonstrate tamper detection
router.post('/simulate-tamper', (req, res) => {
  try {
    const targetRecord = db.prepare(`
      SELECT * FROM measurement_results ORDER BY captured_at ASC LIMIT 1
    `).get();

    if (!targetRecord) {
      return res.status(404).json({ success: false, error: 'No measurement records found to tamper.' });
    }

    // Tamper with overall_result and geo_lat without recomputing hash
    db.prepare(`
      UPDATE measurement_results 
      SET overall_result = 'FAIL', geo_lat = 99.9999 
      WHERE id = ?
    `).run(targetRecord.id);

    // Write audit log
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('log-tamper-' + Date.now(), 'ATTACKER_INSIDER', 'UNAUTHORIZED_DB_EDIT', 'MEASUREMENT', targetRecord.id, 'Direct database update on overall_result = FAIL without valid hash chain transaction');

    res.json({
      success: true,
      message: `Simulated unauthorized database tampering on record ${targetRecord.id}. Field 'overall_result' altered to FAIL. Run chain-check to see cryptographic detection.`,
      record_id: targetRecord.id
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Demo Endpoint: Restore the tampered field back to valid state
router.post('/restore-chain', (req, res) => {
  try {
    const targetRecord = db.prepare(`
      SELECT * FROM measurement_results ORDER BY captured_at ASC LIMIT 1
    `).get();

    if (targetRecord) {
      db.prepare(`
        UPDATE measurement_results 
        SET overall_result = 'PASS', geo_lat = 18.5167, zero_error = 0.0 
        WHERE id = ?
      `).run(targetRecord.id);
    }

    const report = verifyMeasurementChain();

    res.json({
      success: true,
      message: 'Chain restored to valid state.',
      report
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
