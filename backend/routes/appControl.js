const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/status', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM app_config WHERE key = 'app_enabled'");
    const enabled = result.rows.length > 0 ? result.rows[0].value === 'true' : true;
    res.json({ enabled });
  } catch (err) {
    console.error('Error fetching app status:', err);
    res.json({ enabled: true });
  }
});

router.post('/toggle', async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }
    await pool.query(
      "INSERT INTO app_config (key, value, updated_at) VALUES ('app_enabled', $1, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP",
      [enabled ? 'true' : 'false']
    );
    res.json({ enabled });
  } catch (err) {
    console.error('Error toggling app status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
