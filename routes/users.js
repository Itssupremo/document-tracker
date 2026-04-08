const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');

const router = express.Router();

// GET /api/users - list all users (admin only)
router.get('/', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    const users = await User.find({}, 'username fullName email role createdAt').sort({ createdAt: -1 }).lean();
    // Map _id to id for frontend compatibility
    const mapped = users.map(u => ({ id: u._id, username: u.username, fullName: u.fullName, email: u.email, role: u.role, createdAt: u.createdAt }));
    res.json(mapped);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/users - create user
router.post('/', async (req, res) => {
  try {
    const { username, password, fullName, email, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 50) {
      return res.status(400).json({ error: 'Username must be 3-50 characters.' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const validRoles = ['admin', 'user'];
    const userRole = validRoles.includes(role) ? role : 'user';

    const existing = await User.findOne({ username: username.trim() });
    if (existing) {
      return res.status(409).json({ error: 'Username already exists.' });
    }

    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const user = await User.create({
      username: username.trim(),
      password: hash,
      fullName: fullName ? fullName.trim() : null,
      email: email ? email.trim() : null,
      role: userRole
    });

    res.status(201).json({ id: user._id, username: user.username, fullName: user.fullName, email: user.email, role: user.role });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/users/:id - update user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, fullName, email, role } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updates = {};
    if (username && typeof username === 'string' && username.trim() !== user.username) {
      if (username.trim().length < 3 || username.trim().length > 50) {
        return res.status(400).json({ error: 'Username must be 3-50 characters.' });
      }
      const existing = await User.findOne({ username: username.trim(), _id: { $ne: id } });
      if (existing) {
        return res.status(409).json({ error: 'Username already exists.' });
      }
      updates.username = username.trim();
    }
    if (password && typeof password === 'string' && password.length >= 6) {
      updates.password = crypto.createHash('sha256').update(password).digest('hex');
    }
    if (fullName !== undefined) {
      updates.fullName = fullName ? fullName.trim() : null;
    }
    if (email !== undefined) {
      updates.email = email ? email.trim() : null;
    }
    if (role && ['admin', 'user'].includes(role)) {
      updates.role = role;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update.' });
    }

    await User.findByIdAndUpdate(id, updates);
    res.json({ message: 'User updated.' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/users/:id - delete user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Can't delete yourself
    if (id === req.user.userId.toString()) {
      return res.status(400).json({ error: 'Cannot delete your own account.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await User.findByIdAndDelete(id);
    res.json({ message: 'User deleted.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
