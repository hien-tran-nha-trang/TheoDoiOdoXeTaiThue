/**
 * Cookie phiên đăng nhập ký HMAC-SHA256 bằng Web Crypto
 * (chạy được cả trong proxy lẫn server component).
 */
export const SESSION_COOKIE = "odo_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 60; // 60 ngày - tài xế không phải đăng nhập lại thường xuyên

export type SessionPayload = { uid: number; pv: string; exp: number };

let derivedSecret: Promise<string> | null = null;

async function getSecret(): Promise<string> {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  // Không cài AUTH_SECRET: tự sinh khóa từ chuỗi kết nối CSDL (vốn đã bí mật) để triển khai 1 bước
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (dbUrl) {
    derivedSecret ??= crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(`odo-session:${dbUrl}`))
      .then((buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join(""));
    return derivedSecret;
  }
  if (process.env.VERCEL) {
    throw new Error("Thiếu biến môi trường AUTH_SECRET hoặc DATABASE_URL.");
  }
  return "dev-secret-chi-dung-khi-chay-local-0123456789";
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(await getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = b64url(await hmac(body));
  return `${body}.${sig}`;
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64url(await hmac(body));
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionPayload;
    if (typeof payload.uid !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
