import { hash, verify } from "@node-rs/argon2";

/**
 * argon2id is the recommended password KDF for new systems (memory-hard).
 * Never store or log the plaintext password.
 */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export async function verifyPassword(
  passwordHash: string,
  plain: string,
): Promise<boolean> {
  return verify(passwordHash, plain);
}
