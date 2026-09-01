const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb, saveDb } = require('../db.cjs');

router.post('/register', (req, res) => {
  try {
    const { username, password, displayName, email } = req.body;
    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ code: 400, message: '用户名长度需在3-20个字符之间' });
    }

    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      return res.status(400).json({ code: 400, message: '用户名只允许英文和数字' });
    }

    if (password.length < 8 || password.length > 20) {
      return res.status(400).json({ code: 400, message: '密码长度需在8-20个字符之间' });
    }

    const db = getDb();

    const existing = db.exec(`SELECT id FROM users WHERE username = ?`, [username])[0];
    if (existing && existing.values.length > 0) {
      return res.status(400).json({ code: 400, message: '用户名已存在' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const viewerRole = db.exec(`SELECT id FROM roles WHERE name = 'viewer'`)[0];
    const roleId = viewerRole && viewerRole.values.length > 0 ? viewerRole.values[0][0] : 1;

    db.run(
      `INSERT INTO users (username, password, display_name, email, role, role_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, displayName || username, email || null, 'viewer', roleId]
    );
    saveDb();

    res.json({ code: 200, message: '注册成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = router;