import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

const ROUNDS = 12;

// No ambiguous characters (0/O, 1/l/I) — easy to read aloud and copy.
const TEMP_PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** Random temporary password to hand to a new/reset user (changed on first login). */
export function generateTemporaryPassword(length = 12): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return out;
}

export async function hashSecret(value: string): Promise<string> {
  return bcrypt.hash(value, ROUNDS);
}

export async function verifySecret(value: string, hash: string): Promise<boolean> {
  return bcrypt.compare(value, hash);
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "La password deve avere almeno 8 caratteri.";
  }
  return null;
}


/** Demo password format: claudio-214353423 */
export function demoPasswordForHandle(handle: string, suffix: string): string {
  return `${handle}-${suffix}`;
}
