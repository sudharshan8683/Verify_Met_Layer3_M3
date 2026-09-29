const express = require('express');
const router = express.Router();
const path = require('node:path');
const { upload, getFileHash } = require('../config/multer');

// Single photo upload for evidence (Live Display or Nameplate)
router.post('/', upload.single('photo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded.' });
    }

    const filePath = req.file.path;
    const fileHash = getFileHash(filePath);
    const photoUrl = `/uploads/evidence/${req.file.filename}`;

    res.json({
      success: true,
      filename: req.file.filename,
      photo_url: photoUrl,
      file_hash: fileHash,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
