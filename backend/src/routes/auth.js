const express = require('express');
const router = express.Router();
const { db } = require('../config/database');

// List all registered stakeholders for demo/selection
router.get('/users', (req, res) => {
  try {
    const role = req.query.role;
    let query = 'SELECT u.*, o.name as org_name, j.code as jurisdiction_code FROM users u LEFT JOIN organizations o ON u.organization_id = o.id LEFT JOIN jurisdictions j ON u.jurisdiction_id = j.id';
    const params = [];
    if (role) {
      query += ' WHERE u.role = ?';
      params.push(role);
    }
    const stmt = db.prepare(query);
    const users = stmt.all(...params);
    res.json({ success: true, count: users.length, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get user profile by ID
router.get('/users/:id', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT u.*, o.name as org_name, j.code as jurisdiction_code, j.district 
      FROM users u 
      LEFT JOIN organizations o ON u.organization_id = o.id 
      LEFT JOIN jurisdictions j ON u.jurisdiction_id = j.id
      WHERE u.id = ?
    `);
    const user = stmt.get(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
