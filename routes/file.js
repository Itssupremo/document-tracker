const express = require('express');
const File = require('../models/File');

const router = express.Router();

// GET /file/ - List all files (admin sees all, users see only their own)
router.get('/', async (req, res) => {
  try {
    let query = {};
    if (!req.user || req.user.role !== 'admin') {
      query.uploadedBy = req.user.userId;
    }
    const files = await File.find(query, 'fileId fileName uploaderName uploaderEmail uploadedBy status createdAt').sort({ createdAt: -1 }).lean();
    // Map createdAt to uploadDate for frontend compatibility
    const mapped = files.map(f => ({
      fileId: f.fileId,
      fileName: f.fileName,
      uploaderName: f.uploaderName,
      uploaderEmail: f.uploaderEmail,
      uploadedBy: f.uploadedBy,
      uploadDate: f.createdAt,
      status: f.status
    }));
    res.json(mapped);
  } catch (err) {
    console.error('List files error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /file/:id - Get file metadata
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.length > 100) {
      return res.status(400).json({ error: 'Invalid file ID.' });
    }

    const file = await File.findOne({ fileId: id }, 'fileId fileName uploaderName uploaderEmail createdAt').lean();
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    res.json({
      fileId: file.fileId,
      fileName: file.fileName,
      uploaderName: file.uploaderName,
      uploaderEmail: file.uploaderEmail,
      uploadDate: file.createdAt
    });
  } catch (err) {
    console.error('Get file error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /file/:id/pdf - Serve the final PDF
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;
    const file = await File.findOne({ fileId: id }).select('finalPdf originalPdf fileName status').lean();

    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const pdfBuffer = file.status === 'completed' && file.finalPdf ? file.finalPdf : file.originalPdf;
    if (!pdfBuffer) {
      return res.status(404).json({ error: 'PDF not available.' });
    }

    const pdfName = file.fileName.replace(/\.[^.]+$/, '') + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfName}"`);
    res.send(pdfBuffer.buffer ? Buffer.from(pdfBuffer.buffer) : pdfBuffer);
  } catch (err) {
    console.error('Serve PDF error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /file/:id - Delete a file
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.length > 100) {
      return res.status(400).json({ error: 'Invalid file ID.' });
    }

    const file = await File.findOne({ fileId: id });
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    // Only admin or the uploader can delete
    if (req.user.role !== 'admin' && file.uploadedBy && file.uploadedBy.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ error: 'You can only delete your own files.' });
    }

    await File.deleteOne({ fileId: id });
    res.json({ message: 'File deleted.' });
  } catch (err) {
    console.error('Delete file error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /file/:id/download - Download PDF
router.get('/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const file = await File.findOne({ fileId: id }).select('finalPdf originalPdf fileName status').lean();

    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    const pdfBuffer = file.status === 'completed' && file.finalPdf ? file.finalPdf : file.originalPdf;
    if (!pdfBuffer) {
      return res.status(404).json({ error: 'PDF not available.' });
    }

    const pdfName = file.fileName.replace(/\.[^.]+$/, '') + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfName}"`);
    res.send(pdfBuffer.buffer ? Buffer.from(pdfBuffer.buffer) : pdfBuffer);
  } catch (err) {
    console.error('Download PDF error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
