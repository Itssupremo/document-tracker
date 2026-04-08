const express = require('express');
const upload = require('../middleware/upload');
const File = require('../models/File');
const User = require('../models/User');
const { generateQRCode } = require('../services/qrService');
const { overlayImageOnPdf, getPdfPageCount } = require('../services/pdfService');

const router = express.Router();

// Generate OCDRA-YYYYMM-NN file ID
async function generateFileId() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `OCDRA-${yyyy}${mm}`;

  const latest = await File.findOne({ fileId: { $regex: `^${prefix}-` } }).sort({ fileId: -1 }).lean();

  let seq = 1;
  if (latest) {
    const parts = latest.fileId.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}-${String(seq).padStart(2, '0')}`;
}

// STEP 1: Upload PDF — stored in MongoDB, preview rendered client-side
router.post('/', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please upload a .pdf file.' });
    }

    const sessionUser = await User.findById(req.user.userId).select('fullName email').lean();
    const uploaderName = (sessionUser && sessionUser.fullName) || req.user.username;
    const uploaderEmail = (sessionUser && sessionUser.email) || null;

    const customFileName = req.body.fileName;
    if (!customFileName || !customFileName.trim()) {
      return res.status(400).json({ error: 'File Name is required.' });
    }

    const fileId = await generateFileId();
    const totalPages = await getPdfPageCount(req.file.buffer);

    await File.create({
      fileId,
      fileName: customFileName.trim(),
      originalPdf: req.file.buffer,
      uploaderName,
      uploaderEmail: uploaderEmail ? uploaderEmail.trim() : null,
      uploadedBy: req.user.userId,
      status: 'pending'
    });

    res.status(200).json({
      message: 'File uploaded. Position the QR code on the document preview.',
      fileId,
      fileName: customFileName.trim(),
      totalPages
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Internal server error during upload.' });
  }
});

// Serve the original PDF for client-side preview rendering
router.get('/preview-pdf/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    if (!/^OCDRA-\d{6}-\d{2,}$/i.test(fileId)) {
      return res.status(400).json({ error: 'Invalid file ID.' });
    }

    const file = await File.findOne({ fileId }).select('originalPdf fileName').lean();
    if (!file || !file.originalPdf) {
      return res.status(404).json({ error: 'File not found.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.send(file.originalPdf.buffer ? file.originalPdf.buffer : file.originalPdf);
  } catch (err) {
    console.error('Preview PDF error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// STEP 2: Place QR code at chosen position and generate final PDF
router.post('/generate', async (req, res) => {
  try {
    const { fileId, page, xPercent, yPercent, qrSize } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required.' });
    }

    const file = await File.findOne({ fileId });
    if (!file) {
      return res.status(404).json({ error: 'File not found.' });
    }

    if (file.status === 'completed') {
      return res.status(400).json({ error: 'This file has already been processed.' });
    }

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

    // 1. Generate QR code image buffer
    const { qrImageBuffer } = await generateQRCode(fileId, baseUrl);

    // 2. Overlay QR code on PDF (all in-memory using pdf-lib)
    const pageIndex = typeof page === 'number' ? page : 0;
    const x = typeof xPercent === 'number' ? xPercent : 75;
    const y = typeof yPercent === 'number' ? yPercent : 5;
    const size = typeof qrSize === 'number' ? qrSize : 15;

    // For the overlay, use a plain QR (without the text label)
    const QRCode = require('qrcode');
    const plainQrBuffer = await QRCode.toBuffer(`${baseUrl}/file/${fileId}`, {
      type: 'png', width: 300, margin: 2, color: { dark: '#000000', light: '#ffffff' }
    });

    let finalPdfBuffer;
    try {
      const pdfBuffer = file.originalPdf.buffer ? Buffer.from(file.originalPdf.buffer) : file.originalPdf;
      finalPdfBuffer = await overlayImageOnPdf(pdfBuffer, plainQrBuffer, pageIndex, x, y, size);
    } catch (err) {
      console.error('QR overlay error:', err.message);
      return res.status(500).json({ error: 'Failed to place QR code on PDF.', details: err.message });
    }

    // 3. Update MongoDB record
    file.finalPdf = finalPdfBuffer;
    file.qrImage = qrImageBuffer;
    file.status = 'completed';
    await file.save();

    res.status(201).json({
      message: 'QR code placed and PDF generated successfully.',
      fileId,
      qrUrl: `${baseUrl}/file/${fileId}`,
      qrImageUrl: `/api/qr/${fileId}`
    });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: 'Internal server error during generation.' });
  }
});

module.exports = router;
