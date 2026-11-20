import bcrypt from "bcryptjs";

const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12;

// Precomputed valid bcrypt hash used for timing attack mitigation when user is not found
const DUMMY_HASH = "$2a$12$e8eYQv7V7L2k3m5n7o9p1u2w3x4y5z6a7b8c9d0e1f2g3h4i5j6k.";

/**
 * Validates password against PRD AUTH-5 policy:
 * - Minimum 8 characters
 * - Must contain at least one letter and at least one number
 */
export function validatePasswordPolicy(password: string): boolean {
  if (typeof password !== "string" || password.length < 8) {
    return false;
  }
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasLetter && hasNumber;
}

/**
 * Hashes a plaintext password using bcrypt with standard salt rounds.
 */
export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, saltRounds);
}

/**
 * Compares a plaintext password with a stored hash.
 */
export async function comparePassword(plainText: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plainText, hashed);
}

/**
 * Executes a dummy comparison to prevent timing-based user enumeration.
 */
export async function comparePasswordDummy(plainText: string): Promise<boolean> {
  await bcrypt.compare(plainText, DUMMY_HASH);
  return false;
}
