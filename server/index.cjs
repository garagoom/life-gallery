require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { initDb, closeDb, getDb } = require('./db.cjs');
const { backfillMissingDerivatives } = require('./lib/photoDerivatives.cjs');
const photosRouter = require('./routes/photos.cjs');
const authRouter = require('./routes/auth.cjs');
const usersRouter = require('./routes/users.cjs');
const rolesRouter = require('./routes/roles.cjs');
const menusRouter = require('./routes/menus.cjs');
const registerRouter = require('./routes/register.cjs');
const dictRouter = require('./routes/dict.cjs');
const { cookieMiddleware } = require('./middleware/cookies.cjs');
const { csrfMiddleware } = require('./middleware/csrf.cjs');
const { optionalAuth } = require('./middleware/auth.cjs');
const { serveUpload, serveThumbnail, serveMedium } = require('./middleware/media.cjs');

const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  app.set('trust proxy', 1);
}

const corsOrigin = process.env.CORS_ORIGIN;
app.use(compression());
app.use(cors({
  origin: !corsOrigin || corsOrigin === '*'
    ? (isProd ? false : ['http://localhost:5173', 'http://127.0.0.1:5173'])
    : corsOrigin.split(',').map((s) => s.trim()),
  credentials: true,
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(cookieMiddleware);
app.use(csrfMiddleware);

app.use('/uploads/avatars', express.static(path.join(__dirname, 'uploads', 'avatars'), {
  maxAge: '30d',
  immutable: true,
}));
app.get('/uploads/:filename', optionalAuth, serveUpload);
app.get('/thumbnails/:filename', optionalAuth, serveThumbnail);
app.get('/mediums/:filename', optionalAuth, serveMedium);

app.use('/api/photos', photosRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/menus', menusRouter);
app.use('/api/dict', dictRouter);
app.use('/api', registerRouter);

if (isProd) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('{*path}', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

initDb().then(() => {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
  setImmediate(() => {
    const dirs = {
      uploads: path.join(__dirname, 'uploads'),
      thumbnails: path.join(__dirname, 'thumbnails'),
      mediums: path.join(__dirname, 'mediums'),
    };
    backfillMissingDerivatives(getDb, dirs).catch((err) => {
      console.warn('Photo derivative backfill failed:', err.message);
    });
  });
  const shutdown = () => {
    closeDb();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}).catch((err) => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
