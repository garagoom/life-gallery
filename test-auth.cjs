try {
  require('/opt/life-gallery/server/routes/auth.cjs');
  console.log('auth.cjs loaded OK');
} catch(e) {
  console.error('auth.cjs FAILED:', e.message);
}
