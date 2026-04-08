require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const { connectDb } = require('./config/db');
const uploadRoutes = require('./routes/upload');
const fileRoutes = require('./routes/file');
const qrRoutes = require('./routes/qr');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const { requireLogin, requireAdmin, getSession } = require('./middleware/auth');
const File = require('./models/File');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://cdnjs.cloudflare.com", "blob:"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "blob:"],
      mediaSrc: ["'self'", "blob:", "mediastream:"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      frameSrc: ["'self'", "blob:"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many upload requests. Please try again later.' }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests. Please try again later.' }
});

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Ensure MongoDB is connected before handling any request (critical for serverless cold starts)
let dbReady = false;
let dbPromise = null;

function ensureDb() {
  if (dbReady) return Promise.resolve();
  if (!dbPromise) {
    dbPromise = connectDb()
      .then(() => seedAdmin())
      .then(() => { dbReady = true; })
      .catch(err => { dbPromise = null; throw err; });
  }
  return dbPromise;
}

app.use(async (_req, res, next) => {
  try {
    await ensureDb();
    next();
  } catch (err) {
    console.error('DB connection error:', err);
    res.status(500).json({ error: 'Database connection failed.' });
  }
});

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Login page (public)
app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Scanner is the public landing page
app.get('/', async (req, res) => {
  const sessionId = req.cookies && req.cookies.session;
  const session = await getSession(sessionId);
  if (session) {
    return res.redirect('/dashboard');
  }
  res.redirect('/scanner');
});

// Scanner page (public)
app.get('/scanner', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'scanner.html'));
});

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// File details view page (public — accessible via QR scan)
app.get('/file/:id/view', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'file-details.html'));
});

// Redirect /file/:id to /file/:id/view (for old QR codes)
app.get('/file/:id', (req, res, next) => {
  // Only redirect if it looks like a file ID, not an API-style sub-path
  const { id } = req.params;
  if (id && /^[A-Za-z0-9_-]+$/.test(id)) {
    return res.redirect('/file/' + encodeURIComponent(id) + '/view');
  }
  next();
});

// Public file API endpoints (for QR scanned files)
app.get('/api/file/:id', apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || id.length > 100) {
      return res.status(400).json({ error: 'Invalid file ID.' });
    }
    const file = await File.findOne({ fileId: id }, 'fileId fileName uploaderName uploaderEmail createdAt').lean();
    if (!file) return res.status(404).json({ error: 'File not found.' });
    res.json({ fileId: file.fileId, fileName: file.fileName, uploaderName: file.uploaderName, uploaderEmail: file.uploaderEmail, uploadDate: file.createdAt });
  } catch (err) {
    console.error('Public file API error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/file/:id/pdf', apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const file = await File.findOne({ fileId: id }).select('finalPdf originalPdf fileName status').lean();
    if (!file) return res.status(404).json({ error: 'File not found.' });
    const pdfBuffer = file.status === 'completed' && file.finalPdf ? file.finalPdf : file.originalPdf;
    if (!pdfBuffer) return res.status(404).json({ error: 'PDF not available.' });
    const pdfName = file.fileName.replace(/\.[^.]+$/, '') + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdfName}"`);
    res.send(pdfBuffer.buffer ? Buffer.from(pdfBuffer.buffer) : pdfBuffer);
  } catch (err) {
    console.error('Public PDF API error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/api/file/:id/download', apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const file = await File.findOne({ fileId: id }).select('finalPdf originalPdf fileName status').lean();
    if (!file) return res.status(404).json({ error: 'File not found.' });
    const pdfBuffer = file.status === 'completed' && file.finalPdf ? file.finalPdf : file.originalPdf;
    if (!pdfBuffer) return res.status(404).json({ error: 'PDF not available.' });
    const pdfName = file.fileName.replace(/\.[^.]+$/, '') + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfName}"`);
    res.send(pdfBuffer.buffer ? Buffer.from(pdfBuffer.buffer) : pdfBuffer);
  } catch (err) {
    console.error('Public download API error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Protected API routes
app.use('/api/upload', requireLogin, uploadLimiter, uploadRoutes);
app.use('/api/users', requireLogin, apiLimiter, usersRoutes);
app.use('/file', requireLogin, apiLimiter, fileRoutes);
app.use('/api/qr', apiLimiter, qrRoutes);

// Protected pages
app.get('/dashboard', requireLogin, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/upload', requireLogin, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/users', requireLogin, requireAdmin, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'users.html'));
});

// Error handling for multer
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 16MB.' });
  }
  if (err.message === 'Only .pdf files are allowed.') {
    return res.status(400).json({ error: err.message });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// Seed admin user if no users exist
async function seedAdmin() {
  const count = await User.countDocuments();
  if (count === 0) {
    const hash = crypto.createHash('sha256').update('admin123').digest('hex');
    await User.create({ username: 'admin', password: hash, fullName: 'Administrator', role: 'admin' });
    console.log('Default admin account created (admin / admin123)');
  }
}

// Start server only when running locally (not on Vercel)
if (!process.env.VERCEL) {
  connectDb()
    .then(() => seedAdmin())
    .then(() => {
      dbReady = true;
      app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
      });
    })
    .catch(err => {
      console.error('Failed to start:', err);
      process.exit(1);
    });
}

// Export for Vercel serverless
module.exports = app;

