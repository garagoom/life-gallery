require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db.cjs');
const photosRouter = require('./routes/photos.cjs');
const authRouter = require('./routes/auth.cjs');
const usersRouter = require('./routes/users.cjs');
const rolesRouter = require('./routes/roles.cjs');
const menusRouter = require('./routes/menus.cjs');
const registerRouter = require('./routes/register.cjs');
const dictRouter = require('./routes/dict.cjs');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin === '*' ? true : corsOrigin.split(',').map(s => s.trim()),
  credentials: true,
}));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Static files - 上传的图片缓存30天
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '30d',
  immutable: true,
}));
// 缩略图缓存30天
app.use('/thumbnails', express.static(path.join(__dirname, 'thumbnails'), {
  maxAge: '30d',
  immutable: true,
}));

// API routes
app.use('/api/photos', photosRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/menus', menusRouter);
app.use('/api/dict', dictRouter);
app.use('/api', registerRouter);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('{*path}', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Initialize database and start server
initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
