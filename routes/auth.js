const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { createSession, destroySession, getSession } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await User.findOne({ username: username.trim() });

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    if (hash !== user.password) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const sessionId = await createSession(user._id, user.username, user.role || 'user');
    res.cookie('session', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({ message: 'Login successful.', username: user.username, fullName: user.fullName, role: user.role || 'user' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const sessionId = req.cookies && req.cookies.session;
  if (sessionId) {
    await destroySession(sessionId);
  }
  res.clearCookie('session');
  res.json({ message: 'Logged out.' });
});

// GET /api/auth/me - check current session
router.get('/me', async (req, res) => {
  try {
    const sessionId = req.cookies && req.cookies.session;
    const session = await getSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Not logged in.' });
    }
    const user = await User.findById(session.userId).select('fullName email role username').lean();
    res.json({
      username: session.username,
      role: session.role || 'user',
      fullName: user ? user.fullName : session.username,
      email: user ? user.email : null
    });
  } catch (err) {
    console.error('Auth me error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/auth/me - update own account
router.put('/me', async (req, res) => {
  try {
    const sessionId = req.cookies && req.cookies.session;
    const session = await getSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Not logged in.' });
    }

    const { fullName, password, email } = req.body;
    const updates = {};

    if (fullName !== undefined && typeof fullName === 'string') {
      updates.fullName = fullName.trim() || null;
    }
    if (email !== undefined && typeof email === 'string') {
      updates.email = email.trim() || null;
    }
    if (password && typeof password === 'string') {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }
      updates.password = crypto.createHash('sha256').update(password).digest('hex');
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update.' });
    }

    await User.findByIdAndUpdate(session.userId, updates);
    res.json({ message: 'Account updated.' });
  } catch (err) {
    console.error('Auth update error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
