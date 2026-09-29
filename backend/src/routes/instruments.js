const express = require('express');
const router = express.Router();
const { db } = require('../config/database');

// List instruments (optional filter by owner_id)
router.get('/', (req, res) => {
  try {
    const ownerId = req.query.owner_id;
    let query = `
      SELECT i.*, u.name as owner_name, o.name as org_name, c.certificate_number, c.valid_until, c.status as cert_status
      FROM instruments i
      JOIN users u ON i.owner_id = u.id
      LEFT JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN certificates c ON c.instrument_id = i.id AND c.status = 'VALID'
    `;
    const params = [];
    if (ownerId) {
      query += ' WHERE i.owner_id = ?';
      params.push(ownerId);
    }
    query += ' ORDER BY i.created_at DESC';
    const stmt = db.prepare(query);
    const instruments = stmt.all(...params);
    res.json({ success: true, count: instruments.length, instruments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get instrument details
router.get('/:id', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT i.*, u.name as owner_name, u.phone as owner_phone, o.name as org_name
      FROM instruments i
      JOIN users u ON i.owner_id = u.id
      LEFT JOIN organizations o ON u.organization_id = o.id
      WHERE i.id = ?
    `);
    const instrument = stmt.get(req.params.id);
    if (!instrument) return res.status(404).json({ success: false, error: 'Instrument not found' });
    res.json({ success: true, instrument });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Register new instrument (with Layer 1 Physical-Digital Binding Nameplate Photo)
router.post('/', (req, res) => {
  try {
    const {
      owner_id,
      category,
      sub_category,
      make,
      model,
      serial_number,
      capacity,
      accuracy_class,
      premises_address,
      geo_lat,
      geo_lng,
      nameplate_photo_url
    } = req.body;

    if (!owner_id || !category || !make || !model || !serial_number || !capacity || !premises_address) {
      return res.status(400).json({ success: false, error: 'Missing required instrument parameters.' });
    }

    const id = 'inst-' + Date.now();
    const photoUrl = nameplate_photo_url || '/uploads/nameplates/sample_nameplate.jpg';

    const stmt = db.prepare(`
      INSERT INTO instruments (
        id, owner_id, category, sub_category, make, model, serial_number,
        capacity, accuracy_class, verification_status, premises_address,
        geo_lat, geo_lng, nameplate_photo_url, last_photo_match_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      owner_id,
      category,
      sub_category || 'General Commercial Scale',
      make,
      model,
      serial_number,
      capacity,
      accuracy_class || 'Class III',
      'PENDING_VERIFICATION',
      premises_address,
      geo_lat || 18.5204,
      geo_lng || 73.8567,
      photoUrl,
      'UNVERIFIED'
    );

    // Write audit log
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('log-' + Date.now(), owner_id, 'REGISTER_INSTRUMENT', 'INSTRUMENT', id, `Registered ${make} ${model} [S/N: ${serial_number}] with nameplate image`);

    res.status(201).json({
      success: true,
      message: 'Instrument successfully registered with physical nameplate metadata.',
      instrument_id: id
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
