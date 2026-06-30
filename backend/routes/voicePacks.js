const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');

const router = express.Router();

const imageStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, uuidv4() + ext);
  }
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image format'), false);
    }
  }
});

router.post('/upload-image', uploadImage.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const filePath = '/uploads/' + req.file.filename;
    res.json({ url: filePath, name: req.file.originalname, size: req.file.size });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Image upload failed' });
  }
});

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, uuidv4() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/mp4'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(webm|ogg|wav|mp3|mp4)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format'), false);
    }
  }
});

router.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
    if (!req.body.userId) return res.status(400).json({ error: 'userId is required' });

    const id = uuidv4();
    const filePath = '/uploads/' + req.file.filename;

    await pool.query(
      'INSERT INTO voice_packs (id, user_id, title, file_path, duration, file_size) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, req.body.userId, req.body.title || '', filePath, parseInt(req.body.duration) || 0, req.file.size]
    );

    res.json({ id, url: filePath, duration: parseInt(req.body.duration) || 0, file_size: req.file.size });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { senderId, receiverId, voicePackId } = req.body;
    if (!senderId || !receiverId || !voicePackId) {
      return res.status(400).json({ error: 'senderId, receiverId, voicePackId are required' });
    }

    const conversation = [senderId, receiverId].sort().join('_');
    const id = uuidv4();

    await pool.query(
      'INSERT INTO voice_pack_messages (id, sender_id, receiver_id, voice_pack_id, conversation) VALUES ($1, $2, $3, $4, $5)',
      [id, senderId, receiverId, voicePackId, conversation]
    );

    const pack = await pool.query('SELECT * FROM voice_packs WHERE id = $1', [voicePackId]);
    const voicePack = pack.rows[0];

    res.json({ id, voicePack });
  } catch (err) {
    console.error('Send error:', err);
    res.status(500).json({ error: 'Failed to send voice pack' });
  }
});

router.get('/messages/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT vpm.id, vpm.sender_id, vpm.receiver_id, vpm.voice_pack_id, vpm.conversation, vpm.created_at,
              vp.file_path, vp.duration, vp.title
       FROM voice_pack_messages vpm
       JOIN voice_packs vp ON vpm.voice_pack_id = vp.id
       WHERE vpm.receiver_id = $1 OR vpm.sender_id = $1
       ORDER BY vpm.created_at DESC`,
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Messages error:', err);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM voice_packs WHERE id = $1 RETURNING file_path', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Voice pack not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete voice pack' });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, user_id, title, file_path, duration, file_size, created_at FROM voice_packs WHERE user_id = $1 ORDER BY created_at DESC',
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json({ error: 'Failed to list voice packs' });
  }
});

module.exports = router;
