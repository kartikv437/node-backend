const mongoose = require('mongoose');

const fileSubSchema = new mongoose.Schema({
  resourceType: String,
  createdAt: Date,
  fileType: String,
  path: String,
  fileUrl: String,
  displayName: String,
});

const studentDocumentsSchema = new mongoose.Schema({
  studentId: String, // optional if you're tracking user
  aadhar: fileSubSchema,
  tenth: fileSubSchema,
  twelfth: fileSubSchema,
  degree: fileSubSchema,
  photo: fileSubSchema,
  uploadedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('StudentDocuments', studentDocumentsSchema);
