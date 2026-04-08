const express = require('express');
const File = require('../models/File');

const router = express.Router();

// GET /api/qr/:fileId - Serve QR code image from MongoDB
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!fileId || typeof fileId !== 'string' || fileId.length > 100) {
      return res.status(400).json({ error: 'Invalid file ID.' });
    }

    const file = await File.findOne({ fileId }).select('qrImage').lean();
    if (!file || !file.qrImage) {
      return res.status(404).json({ error: 'QR code not found.' });
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(file.qrImage.buffer ? Buffer.from(file.qrImage.buffer) : file.qrImage);
  } catch (err) {
    console.error('QR serve error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
