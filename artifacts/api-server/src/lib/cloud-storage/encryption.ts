import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.CLOUD_STORAGE_ENCRYPTION_KEY;
  if (!raw) throw new Error("CLOUD_STORAGE_ENCRYPTION_KEY manquante");
  return createHash("sha256").update(raw).digest();
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(ciphertext: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertext, "base64");
  const iv        = buf.subarray(0, 12);
  const tag       = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher  = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

export function signState(payload: object): string {
  const key  = getKey();
  const json = JSON.stringify(payload);
  const mac  = createHash("sha256").update(key).update(json).digest("hex").slice(0, 16);
  return Buffer.from(JSON.stringify({ ...payload, _mac: mac })).toString("base64url");
}

export function verifyState<T extends object>(token: string): T {
  const key  = getKey();
  const raw  = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as T & { _mac: string };
  const { _mac, ...payload } = raw;
  const json = JSON.stringify(payload);
  const expected = createHash("sha256").update(key).update(json).digest("hex").slice(0, 16);
  if (_mac !== expected) throw new Error("State CSRF invalide");
  return payload as T;
}
