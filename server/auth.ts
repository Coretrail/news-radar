import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = (await derive(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  try {
    const [salt, hex] = stored.split(':');
    const actual = (await derive(password, salt, 64)) as Buffer;
    const expected = Buffer.from(hex, 'hex');
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (v: string) => createHash('sha256').update(v).digest('hex');
