const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  fileId: { type: String, required: true, unique: true, index: true },
  fileName: { type: String, required: true },
  originalPdf: { type: Buffer, required: true },
  finalPdf: { type: Buffer, default: null },
  qrImage: { type: Buffer, default: null },
  uploaderName: { type: String, required: true },
  uploaderEmail: { type: String, default: null },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('File', fileSchema);
