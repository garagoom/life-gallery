const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb, saveDb } = require('../db.cjs');

const DEFAULT_AVATARS = {
  male: '/images/avatars/male.svg',
  female: '/images/avatars/female.svg',
};

const ALLOWED_ROLES = ['creator', 'viewer'];

router.post('/register', (req, res) => {
  try {
    const { username, password, displayName, email, gender, bio, role } = req.body;
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

    if (gender && !['male', 'female', 'secret'].includes(gender)) {
      return res.status(400).json({ code: 400, message: '无效的性别值' });
    }

    const userRole = ALLOWED_ROLES.includes(role) ? role : 'creator';

    const db = getDb();

    const existing = db.exec(`SELECT id FROM users WHERE username = ?`, [username])[0];
    if (existing && existing.values.length > 0) {
      return res.status(400).json({ code: 400, message: '用户名已存在' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const roleRow = db.exec(`SELECT id FROM roles WHERE name = ?`, [userRole])[0];
    const roleId = roleRow && roleRow.values.length > 0 ? roleRow.values[0][0] : 3;
    const avatar = DEFAULT_AVATARS[gender] || DEFAULT_AVATARS.male;

    db.run(
      `INSERT INTO users (username, password, display_name, email, gender, bio, avatar, role, role_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, displayName || username, email || null, gender || null, bio || null, avatar, userRole, roleId]
    );
    saveDb();

    res.json({ code: 200, message: '注册成功' });
  } catch (error) {
    res.status(500).json({ code: 500, message: error.message });
  }
});

module.exports = router;
