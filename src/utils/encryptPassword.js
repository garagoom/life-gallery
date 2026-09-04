function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

let publicKeyPem = '';
let cryptoKeyPromise = null;

export function setPasswordPublicKey(pem) {
  if (!pem || pem === publicKeyPem) return;
  publicKeyPem = pem;
  cryptoKeyPromise = null;
}

export function isWebCryptoAvailable() {
  try {
    return typeof globalThis.crypto?.subtle?.importKey === 'function'
      && typeof globalThis.crypto?.subtle?.encrypt === 'function';
  } catch {
    return false;
  }
}

async function importPublicKey() {
  if (!publicKeyPem) {
    throw new Error('加密公钥未就绪');
  }
  if (!cryptoKeyPromise) {
    cryptoKeyPromise = crypto.subtle.importKey(
      'spki',
      pemToArrayBuffer(publicKeyPem),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );
  }
  return cryptoKeyPromise;
}

export async function encryptPassword(plain) {
  if (typeof plain !== 'string' || !plain) {
    throw new Error('请输入密码');
  }
  if (!isWebCryptoAvailable() || !publicKeyPem) {
    return plain;
  }
  try {
    const key = await importPublicKey();
    const encrypted = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      key,
      new TextEncoder().encode(plain)
    );
    return bufferToBase64(encrypted);
  } catch {
    cryptoKeyPromise = null;
    return plain;
  }
}
