import bcrypt from "bcryptjs";

const ROUNDS = 12;

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
