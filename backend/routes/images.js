const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, uuidv4() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image format'), false);
    }
  }
});

router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    if (!req.body.userId) return res.status(400).json({ error: 'userId is required' });

    const id = uuidv4();
    const filePath = '/uploads/' + req.file.filename;

    await pool.query(
      'INSERT INTO images (id, user_id, file_path, file_size) VALUES ($1, $2, $3, $4)',
      [id, req.body.userId, filePath, req.file.size]
    );

    res.json({ id, url: filePath, file_size: req.file.size });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
