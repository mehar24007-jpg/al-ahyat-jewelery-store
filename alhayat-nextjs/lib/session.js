import crypto from "crypto";

export const SESSION_COOKIE = "ah_admin_session";
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function encode(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}
function decode(str) {
  return JSON.parse(Buffer.from(str, "base64url").toString("utf8"));
}
function sign(data, secret) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

export function createSessionToken(payload, secret) {
  const body = encode(payload);
  const sig = sign(body, secret);
  return `${body}.${sig}`;
}

export function verifySessionToken(token, secret) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = sign(body, secret);
  try {
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }
  const payload = decode(body);
  if (payload.exp && Date.now() > payload.exp) return null;
  return payload;
}
