import { PasswordHasher } from './password-hasher';

describe('PasswordHasher', () => {
  const plainPassword = 'superSecurePassword123!';

  it('should hash a password with scrypt format', async () => {
    const hash = await PasswordHasher.hash(plainPassword);
    expect(hash).toBeDefined();
    expect(hash.startsWith('scrypt$N=16384,r=8,p=1$')).toBe(true);

    const parts = hash.split('$');
    expect(parts.length).toBe(4);
    expect(parts[2]).toHaveLength(32); // 16 bytes in hex = 32 chars
    expect(parts[3]).toHaveLength(128); // 64 bytes in hex = 128 chars
  });

  it('should verify matching password correctly', async () => {
    const hash = await PasswordHasher.hash(plainPassword);
    const isValid = await PasswordHasher.verify(plainPassword, hash);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const hash = await PasswordHasher.hash(plainPassword);
    const isValid = await PasswordHasher.verify('wrongPassword123!', hash);
    expect(isValid).toBe(false);
  });

  it('should reject malformed hashes safely without throwing', async () => {
    expect(await PasswordHasher.verify(plainPassword, '')).toBe(false);
    expect(await PasswordHasher.verify(plainPassword, 'plainTextString')).toBe(false);
    expect(await PasswordHasher.verify(plainPassword, 'scrypt$bad$salt')).toBe(false);
  });

  it('should reject passwords shorter than 8 characters', async () => {
    await expect(PasswordHasher.hash('short')).rejects.toThrow(
      'Password must be at least 8 characters long',
    );
  });
});
