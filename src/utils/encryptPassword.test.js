import { describe, it, expect } from 'vitest';
import { setPasswordPublicKey, encryptPassword } from './encryptPassword';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { getPublicKeyPem, decryptPassword } = require('../../server/lib/passwordCrypto.cjs');

describe('encryptPassword', () => {
  it('encrypts on the client and decrypts on the server', async () => {
    setPasswordPublicKey(getPublicKeyPem());
    const cipher = await encryptPassword('secret-pass-1');
    expect(cipher).not.toBe('secret-pass-1');
    expect(cipher.length).toBeGreaterThan(80);
    expect(decryptPassword(cipher)).toBe('secret-pass-1');
  });
});
