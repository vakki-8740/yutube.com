require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');
const voicePacksRouter = require('./routes/voicePacks');
const imagesRouter = require('./routes/images');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/voice-packs', voicePacksRouter);
app.use('/api/images', imagesRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log('Voice pack server running on port ' + PORT);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
