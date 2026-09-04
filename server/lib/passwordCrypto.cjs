const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const keysDir = path.join(__dirname, '..', 'keys');
const privateKeyPath = path.join(keysDir, 'password-rsa.pem');

let privateKeyPem = null;
let publicKeyPem = null;

function loadOrCreateKeys() {
  if (privateKeyPem && publicKeyPem) return;

  if (process.env.PASSWORD_RSA_PRIVATE_KEY) {
    privateKeyPem = process.env.PASSWORD_RSA_PRIVATE_KEY.replace(/\\n/g, '\n');
  } else if (fs.existsSync(privateKeyPath)) {
    privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
  } else {
    const pair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    fs.mkdirSync(keysDir, { recursive: true });
    fs.writeFileSync(privateKeyPath, pair.privateKey, { mode: 0o600 });
    privateKeyPem = pair.privateKey;
  }

  publicKeyPem = crypto.createPublicKey(privateKeyPem).export({ type: 'spki', format: 'pem' });
}

function getPublicKeyPem() {
  loadOrCreateKeys();
  return publicKeyPem;
}

function decryptPassword(ciphertext) {
  loadOrCreateKeys();
  if (typeof ciphertext !== 'string' || ciphertext.length < 80) {
    throw new Error('invalid ciphertext');
  }
  const buf = Buffer.from(ciphertext, 'base64');
  const plain = crypto.privateDecrypt(
    {
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    buf
  );
  return plain.toString('utf8');
}

function unwrapPassword(value, label = '密码') {
  try {
    const plain = decryptPassword(value);
    if (!plain) {
      const err = new Error(`请输入${label}`);
      err.statusCode = 400;
      throw err;
    }
    return plain;
  } catch (error) {
    if (error.statusCode) throw error;
    const err = new Error(`${label}格式无效`);
    err.statusCode = 400;
    throw err;
  }
}

module.exports = { getPublicKeyPem, decryptPassword, unwrapPassword };
