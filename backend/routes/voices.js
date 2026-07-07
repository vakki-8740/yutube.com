const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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
    const audioBase64 = req.file.buffer.toString('base64');
    const duration = parseInt(req.body.duration) || 0;

    const replyTo = req.body.reply_to || null;

    await pool.query(
      'INSERT INTO voice_recordings (id, user_id, audio_data, duration, file_size, reply_to) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, req.body.userId, audioBase64, duration, req.file.size, replyTo]
    );

    const audioUrl = 'data:audio/webm;base64,' + audioBase64;
    res.json({ id, duration, file_size: req.file.size, created_at: new Date().toISOString(), audio_url: audioUrl });
  } catch (err) {
    console.error('Voice upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.get('/list', async (req, res) => {
  try {
    const userId = req.query.userId;
    let result;
    if (userId) {
      result = await pool.query(
        'SELECT id, user_id, audio_data, duration, file_size, receiver_id, reply_to, reactions, seen, created_at FROM voice_recordings WHERE user_id = $1 OR receiver_id = $1 ORDER BY created_at DESC',
        [userId]
      );
    } else {
      result = await pool.query(
      'SELECT id, user_id, audio_data, duration, file_size, receiver_id, reply_to, reactions, created_at FROM voice_recordings ORDER BY created_at DESC'
      );
    }
    const rows = result.rows.map(r => {
      const { audio_data, ...rest } = r;
      return { ...rest, audio_url: 'data:audio/webm;base64,' + audio_data };
    });
    res.json(rows);
  } catch (err) {
    console.error('List voices error:', err);
    res.status(500).json({ error: 'Failed to list voices' });
  }
});

router.get('/admin/all', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, user_id, audio_data, duration, file_size, receiver_id, created_at FROM voice_recordings ORDER BY created_at DESC'
    );
    const rows = result.rows.map(r => {
      const { audio_data, ...rest } = r;
      return { ...rest, audio_url: 'data:audio/webm;base64,' + audio_data };
    });
    res.json(rows);
  } catch (err) {
    console.error('Admin list voices error:', err);
    res.status(500).json({ error: 'Failed to list voices' });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, user_id, audio_data, duration, file_size, reply_to, reactions, created_at FROM voice_recordings WHERE user_id = $1 ORDER BY created_at DESC',
      [req.params.userId]
    );
    const rows = result.rows.map(r => {
      const { audio_data, ...rest } = r;
      return { ...rest, audio_url: 'data:audio/webm;base64,' + audio_data };
    });
    res.json(rows);
  } catch (err) {
    console.error('List user voices error:', err);
    res.status(500).json({ error: 'Failed to list voices' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM voice_recordings WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Recording not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete voice error:', err);
    res.status(500).json({ error: 'Failed to delete voice' });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { recordingId, senderId, receiverId } = req.body;
    if (!recordingId || !senderId || !receiverId) {
      return res.status(400).json({ error: 'recordingId, senderId, receiverId are required' });
    }
    const result = await pool.query(
      'UPDATE voice_recordings SET receiver_id = $1 WHERE id = $2 AND user_id = $3 RETURNING id',
      [receiverId, recordingId, senderId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Recording not found or not owned by sender' });
    }
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Send voice error:', err);
    res.status(500).json({ error: 'Failed to send voice pack' });
  }
});

router.post('/mark-seen', async (req, res) => {
  try {
    const { viewerId, partnerId } = req.body;
    if (!viewerId || !partnerId) {
      return res.status(400).json({ error: 'viewerId and partnerId are required' });
    }
    const result = await pool.query(
      'UPDATE voice_recordings SET seen = TRUE WHERE user_id = $1 AND receiver_id = $2 AND (seen IS NULL OR seen = FALSE) RETURNING id',
      [partnerId, viewerId]
    );
    res.json({ success: true, updated: result.rowCount });
  } catch (err) {
    console.error('Mark seen error:', err);
    res.status(500).json({ error: 'Failed to mark as seen' });
  }
});

router.post('/send-bulk', async (req, res) => {
  try {
    const { senderId, receiverId } = req.body;
    if (!senderId || !receiverId) {
      return res.status(400).json({ error: 'senderId, receiverId are required' });
    }
    const result = await pool.query(
      'UPDATE voice_recordings SET receiver_id = $1 WHERE user_id = $2 AND receiver_id IS NULL RETURNING id',
      [receiverId, senderId]
    );
    res.json({ success: true, updated: result.rowCount });
  } catch (err) {
    console.error('Bulk send voice error:', err);
    res.status(500).json({ error: 'Failed to bulk send voice packs' });
  }
});

router.get('/conversation/:user1/:user2', async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const result = await pool.query(
      'SELECT id, user_id, audio_data, duration, file_size, receiver_id, reply_to, reactions, seen, created_at FROM voice_recordings WHERE (user_id = $1 AND receiver_id = $2) OR (user_id = $2 AND receiver_id = $1) ORDER BY created_at ASC',
      [user1, user2]
    );
    const rows = result.rows.map(r => {
      const { audio_data, ...rest } = r;
      return { ...rest, audio_url: 'data:audio/webm;base64,' + audio_data };
    });
    res.json(rows);
  } catch (err) {
    console.error('Conversation error:', err);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

router.post('/:id/react', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, emoji } = req.body;
    if (!userId || !emoji) {
      return res.status(400).json({ error: 'userId and emoji are required' });
    }

    const existing = await pool.query('SELECT reactions FROM voice_recordings WHERE id = $1', [id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    let reactions = {};
    try { reactions = JSON.parse(existing.rows[0].reactions) || {}; } catch(e) { reactions = {}; }

    if (!reactions[emoji]) reactions[emoji] = [];

    const idx = reactions[emoji].indexOf(userId);
    if (idx > -1) {
      reactions[emoji].splice(idx, 1);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji].push(userId);
    }

    await pool.query('UPDATE voice_recordings SET reactions = $1 WHERE id = $2', [JSON.stringify(reactions), id]);
    res.json({ success: true, reactions });
  } catch (err) {
    console.error('React error:', err);
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
});

module.exports = router;
