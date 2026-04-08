const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  role: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // TTL: auto-delete after 24h
});

module.exports = mongoose.model('Session', sessionSchema);
