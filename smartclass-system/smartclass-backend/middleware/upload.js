const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_MB = Number(process.env.MAX_UPLOAD_MB) || 10;

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, safe);
  },
});

const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(new Error(`Unsupported file type. Allowed: ${allowed.join(', ')}`));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
});

module.exports = upload;
