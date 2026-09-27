import { scrypt, randomBytes, timingSafeEqual, ScryptOptions } from 'node:crypto';

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS: ScryptOptions = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
};

function scryptPromise(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
}

export class PasswordHasher {
  /**
   * Hashes a plaintext password using crypto.scrypt with a cryptographically secure random salt.
   * Returns formatted string: scrypt$N=16384,r=8,p=1$<salt-hex>$<hash-hex>
   */
  static async hash(password: string): Promise<string> {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const salt = randomBytes(16).toString('hex');
    const derivedKey = await scryptPromise(password, salt);

    return `scrypt$N=${SCRYPT_PARAMS.N},r=${SCRYPT_PARAMS.r},p=${SCRYPT_PARAMS.p}$${salt}$${derivedKey.toString('hex')}`;
  }

  /**
   * Verifies plaintext password against stored scrypt hash using constant-time comparison.
   */
  static async verify(password: string, storedHash: string): Promise<boolean> {
    if (!password || !storedHash) {
      return false;
    }

    const parts = storedHash.split('$');
    if (parts.length !== 4 || parts[0] !== 'scrypt') {
      return false;
    }

    const salt = parts[2];
    const originalHash = parts[3];

    if (!salt || !originalHash) {
      return false;
    }

    try {
      const derivedKey = await scryptPromise(password, salt);
      const originalBuffer = Buffer.from(originalHash, 'hex');

      if (derivedKey.length !== originalBuffer.length) {
        return false;
      }

      return timingSafeEqual(derivedKey, originalBuffer);
    } catch {
      return false;
    }
  }
}
