const crypto = require('crypto');
const Session = require('../models/Session');

async function createSession(userId, username, role) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  await Session.create({ sessionId, userId, username, role });
  return sessionId;
}

async function getSession(sessionId) {
  if (!sessionId) return null;
  const entry = await Session.findOne({ sessionId }).lean();
  if (!entry) return null;
  return { userId: entry.userId, username: entry.username, role: entry.role };
}

async function destroySession(sessionId) {
  if (sessionId) await Session.deleteOne({ sessionId });
}

// Middleware: require login
async function requireLogin(req, res, next) {
  try {
    const sessionId = req.cookies && req.cookies.session;
    const session = await getSession(sessionId);
    if (!session) {
      if (req.path.startsWith('/api/') || req.headers.accept === 'application/json') {
        return res.status(401).json({ error: 'Please log in first.' });
      }
      return res.redirect('/login');
    }
    req.user = session;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

// Middleware: require admin role (must be used after requireLogin)
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    if (req.path.startsWith('/api/') || req.headers.accept === 'application/json') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = { createSession, getSession, destroySession, requireLogin, requireAdmin };
