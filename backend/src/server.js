const express = require('express');
const cors = require('cors');
const path = require('node:path');
const { initSchema } = require('./config/database');
const { initLayer3Schema } = require('./config/layer3Schema');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static mock uploads for photos and certificates
const uploadsDir = path.join(__dirname, '../uploads');
const fs = require('node:fs');

app.get('/uploads/nameplates/:filename', (req, res) => {
  const filePath = path.join(uploadsDir, 'nameplates', req.params.filename);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.trim().startsWith('<svg')) {
      res.type('image/svg+xml');
      return res.send(content);
    }
    return res.sendFile(filePath);
  }
  res.status(404).send('Not found');
});

app.use('/uploads', express.static(uploadsDir));

// Initialize Database Schema on start
initSchema();
initLayer3Schema(); // Layer 3 additive tables (nameplate_comparisons, qr_stickers)

// Mount API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/instruments', require('./routes/instruments'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/verifications', require('./routes/verifications'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/integrity', require('./routes/integrity'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/risk-flags', require('./routes/riskFlags'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/nameplate', require('./routes/nameplate'));   // Layer 3: pHash nameplate comparison
app.use('/api/stickers', require('./routes/stickers'));     // Layer 3: tamper-evident QR stickers

// Root Health Check Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'VerifyMET+ Integrity Layer',
    version: '1.3.0-layer3',
    layer: 'Layer 3: Physical-Digital Binding Active',
    features_active: [
      'Cryptographic SHA-256 Hash Chaining (3.1)',
      'Proof of Physical Presence: Photo + Geo Enforced (3.1)',
      'Automated Database Tamper Detection (3.1)',
      'Physical-Digital Binding: pHash Nameplate Comparison + Tamper-Evident QR Stickers (3.2)',
      'Behavioral Red-Flag Anomaly Engine Tables (3.3)',
      'Blind Weighted-Random Inspector Assignment (3.4)',
      'Public Citizen Concern & Feedback Loop (3.5)',
      'WhatsApp-First Communication Channel (3.6)'
    ],
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 VerifyMET+ Layer 1 API Server running on port ${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/api/health`);
  console.log(`   Integrity Chain Check: http://localhost:${PORT}/api/integrity/chain-check`);
  console.log(`=======================================================`);
});

module.exports = app;
