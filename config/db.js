const mongoose = require('mongoose');

let isConnected = false;

async function connectDb() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set.');
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    isConnected = true;
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    throw err;
  }
}

module.exports = { connectDb };
