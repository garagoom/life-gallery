import { describe, it, expect, afterEach } from 'vitest';
import { setPasswordPublicKey, encryptPassword } from './encryptPassword';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { getPublicKeyPem, decryptPassword, unwrapPassword } = require('../../server/lib/passwordCrypto.cjs');
const { isSecureRequest } = require('../../server/middleware/cookies.cjs');

describe('encryptPassword', () => {
  it('encrypts on the client and decrypts on the server', async () => {
    setPasswordPublicKey(getPublicKeyPem());
    const cipher = await encryptPassword('secret-pass-1');
    expect(cipher).not.toBe('secret-pass-1');
    expect(cipher.length).toBeGreaterThan(80);
    expect(decryptPassword(cipher)).toBe('secret-pass-1');
  });

  it('unwraps RSA ciphertext and falls back to plaintext', async () => {
    setPasswordPublicKey(getPublicKeyPem());
    const cipher = await encryptPassword('secret-pass-2');
    expect(unwrapPassword(cipher)).toBe('secret-pass-2');
    expect(unwrapPassword('legacy-plain-pass')).toBe('legacy-plain-pass');
  });
});

describe('isSecureRequest', () => {
  const original = process.env.COOKIE_SECURE;

  afterEach(() => {
    if (original === undefined) delete process.env.COOKIE_SECURE;
    else process.env.COOKIE_SECURE = original;
  });

  it('does not mark HTTP production as secure by default', () => {
    delete process.env.COOKIE_SECURE;
    expect(isSecureRequest({ secure: false, headers: {} })).toBe(false);
    expect(isSecureRequest({ secure: true, headers: {} })).toBe(true);
    expect(isSecureRequest({
      secure: false,
      headers: { 'x-forwarded-proto': 'https' },
    })).toBe(true);
  });

  it('honors COOKIE_SECURE override', () => {
    process.env.COOKIE_SECURE = 'true';
    expect(isSecureRequest({ secure: false, headers: {} })).toBe(true);
    process.env.COOKIE_SECURE = 'false';
    expect(isSecureRequest({ secure: true, headers: {} })).toBe(false);
  });
});
