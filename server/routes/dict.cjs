const express = require('express');
const router = express.Router();
const { getDb } = require('../db.cjs');

// GET /api/dict — all dictionary types (public, no auth needed)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec(`SELECT type, value, label, color, level, sort_order FROM dictionaries WHERE status = 1 ORDER BY type, sort_order ASC`);
    const rows = result[0] ? result[0].values : [];
    const grouped = {};
    for (const [type, value, label, color, level, sort_order] of rows) {
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push({ value, label, color, level, sort_order });
    }
    res.json({ code: 200, message: 'success', data: grouped });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

// GET /api/dict/:type — single type (public, no auth needed)
router.get('/:type', (req, res) => {
  try {
    const db = getDb();
    const result = db.exec(
      `SELECT value, label, color, level, sort_order FROM dictionaries WHERE type = ? AND status = 1 ORDER BY sort_order ASC`,
      [req.params.type]
    );
    const rows = result[0] ? result[0].values : [];
    const data = rows.map(([value, label, color, level, sort_order]) => ({ value, label, color, level, sort_order }));
    res.json({ code: 200, message: 'success', data });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = router;
