import crypto from 'node:crypto';

const SECRET = process.env.SECRET || (() => {
  console.warn('[auth] SECRET tanımlı değil, geçici anahtar kullanılıyor (yeniden başlatınca oturumlar düşer)');
  return crypto.randomBytes(32).toString('hex');
})();

export interface TokenData {
  role: 'admin' | 'driver' | 'customer';
  id?: string;
  exp: number;
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');

export function sign(data: Omit<TokenData, 'exp'>, days = 30): string {
  const body = b64(JSON.stringify({ ...data, exp: Date.now() + days * 864e5 }));
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verify(token?: string | null): TokenData | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const exp = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (sig.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return null;
  try {
    const d = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenData;
    return d.exp > Date.now() ? d : null;
  } catch {
    return null;
  }
}

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(pw, salt, 32).toString('hex');
  return `${salt}:${h}`;
}

export function checkPassword(pw: string, stored: string): boolean {
  const [salt, h] = stored.split(':');
  if (!salt || !h) return false;
  const x = crypto.scryptSync(pw, salt, 32);
  return crypto.timingSafeEqual(x, Buffer.from(h, 'hex'));
}

/** Basit deneme sınırı (IP başına) */
const tries = new Map<string, { n: number; until: number }>();
export function rateLimited(key: string): boolean {
  const t = tries.get(key);
  return !!t && t.n >= 8 && t.until > Date.now();
}
export function noteFail(key: string) {
  const t = tries.get(key);
  const now = Date.now();
  if (!t || t.until < now) tries.set(key, { n: 1, until: now + 10 * 60e3 });
  else t.n += 1;
}
export function clearFails(key: string) {
  tries.delete(key);
}
