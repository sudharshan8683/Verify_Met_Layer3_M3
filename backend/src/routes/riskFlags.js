const express = require('express');
const router = express.Router();
const { db } = require('../config/database');

// List all active behavioral risk flags
router.get('/', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT rf.*, u.name as entity_name, u.role as entity_role, u.email as entity_email
      FROM risk_flags rf
      LEFT JOIN users u ON rf.entity_id = u.id
      ORDER BY rf.score DESC, rf.created_at DESC
    `);
    const flags = stmt.all();

    // Parse JSON details
    const parsedFlags = flags.map(f => {
      let detailsObj = {};
      try {
        detailsObj = JSON.parse(f.details);
      } catch (e) {
        detailsObj = { text: f.details };
      }
      return { ...f, details: detailsObj };
    });

    res.json({ success: true, count: parsedFlags.length, risk_flags: parsedFlags });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Compare clean vs flagged inspectors (Layer 4 & Demo readiness)
router.get('/inspectors-summary', (req, res) => {
  try {
    const inspectors = db.prepare(`
      SELECT u.id, u.name, u.email, u.phone,
        (SELECT COUNT(*) FROM verification_applications WHERE assigned_officer_id = u.id) as total_assigned,
        (SELECT COUNT(*) FROM measurement_results WHERE officer_id = u.id) as completed_tests,
        (SELECT COUNT(*) FROM risk_flags WHERE entity_id = u.id AND status = 'ACTIVE') as active_flags,
        (SELECT MAX(score) FROM risk_flags WHERE entity_id = u.id AND status = 'ACTIVE') as max_risk_score
      FROM users u
      WHERE u.role = 'LMO'
      ORDER BY active_flags DESC, u.name ASC
    `).all();

    res.json({ success: true, inspectors });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const { runRedFlagEngine } = require('../services/redFlagEngine');

// Trigger on-demand Red-Flag Anomaly Engine execution
router.post('/run-engine', (req, res) => {
  try {
    const customConfig = req.body || {};
    const results = runRedFlagEngine(customConfig);
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      results
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
