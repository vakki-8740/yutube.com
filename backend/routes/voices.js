const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const initSqlJs = require('sql.js');

const router = express.Router();

const DB_PATH = path.join(__dirname, '..', 'voices.db');
let db = null;
let dbReady = null;

async function getDb() {
  if (db) return db;
  if (dbReady) return dbReady;

  dbReady = (async () => {
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
      const buf = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buf);
    } else {
      db = new SQL.Database();
    }
    db.run(`CREATE TABLE IF NOT EXISTS voice_recordings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      duration INTEGER DEFAULT 0,
      file_size INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`);
    persistDb();
    return db;
  })();

  return dbReady;
}

function persistDb() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Failed to persist DB:', err);
  }
}

const voicesDir = path.join(__dirname, '..', 'uploads', 'voices');
if (!fs.existsSync(voicesDir)) {
  fs.mkdirSync(voicesDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: voicesDir,
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

    const database = await getDb();
    const id = uuidv4();
    const filePath = '/uploads/voices/' + req.file.filename;
    const duration = parseInt(req.body.duration) || 0;

    const stmt = database.prepare(
      'INSERT INTO voice_recordings (id, user_id, file_path, duration, file_size) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.bind([id, req.body.userId, filePath, duration, req.file.size]);
    stmt.step();
    stmt.free();
    persistDb();

    res.json({ id, url: filePath, duration, file_size: req.file.size, created_at: new Date().toISOString() });
  } catch (err) {
    console.error('Voice upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.get('/list', async (req, res) => {
  try {
    const database = await getDb();
    const stmt = database.prepare('SELECT id, user_id, file_path, duration, file_size, created_at FROM voice_recordings ORDER BY created_at DESC');
    const rows = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      rows.push(row);
    }
    stmt.free();
    res.json(rows);
  } catch (err) {
    console.error('List voices error:', err);
    res.status(500).json({ error: 'Failed to list voices' });
  }
});

router.get('/user/:userId', async (req, res) => {
  try {
    const database = await getDb();
    const stmt = database.prepare('SELECT id, user_id, file_path, duration, file_size, created_at FROM voice_recordings WHERE user_id = ? ORDER BY created_at DESC');
    stmt.bind([req.params.userId]);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    res.json(rows);
  } catch (err) {
    console.error('List user voices error:', err);
    res.status(500).json({ error: 'Failed to list voices' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const database = await getDb();
    const stmt = database.prepare('SELECT file_path FROM voice_recordings WHERE id = ?');
    stmt.bind([req.params.id]);
    let filePath = null;
    if (stmt.step()) {
      const row = stmt.getAsObject();
      filePath = row.file_path;
    }
    stmt.free();

    if (!filePath) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    const fullPath = path.join(__dirname, '..', filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    const delStmt = database.prepare('DELETE FROM voice_recordings WHERE id = ?');
    delStmt.bind([req.params.id]);
    delStmt.step();
    delStmt.free();
    persistDb();

    res.json({ success: true });
  } catch (err) {
    console.error('Delete voice error:', err);
    res.status(500).json({ error: 'Failed to delete voice' });
  }
});

module.exports = router;
