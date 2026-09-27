import { createHash, randomBytes } from 'node:crypto';

export class TokenGenerator {
  /**
   * Generates a high-entropy cryptographically secure random hex string.
   */
  static generateSecureToken(bytes = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  /**
   * Creates a SHA-256 fingerprint hash of the token for database storage.
   * Plaintext refresh tokens are never persisted.
   */
  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
