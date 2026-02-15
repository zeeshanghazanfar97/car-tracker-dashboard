const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface SessionUser {
  sub: string;
  name: string | null;
  email: string | null;
  preferredUsername: string | null;
}

export interface SessionData {
  iat: number;
  exp: number;
  user: SessionUser;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function toBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function fromBase64Url(value: string): Uint8Array {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return base64ToBytes(base64);
}

export function randomUrlSafeString(bytes = 32): string {
  const random = new Uint8Array(bytes);
  crypto.getRandomValues(random);
  return toBase64Url(random);
}

export async function sha256Base64Url(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toBase64Url(new Uint8Array(hash));
}

export function parseJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("Invalid JWT format");
  }

  const payload = decoder.decode(fromBase64Url(parts[1]));
  return JSON.parse(payload) as Record<string, unknown>;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSession(payload: SessionData, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const headerPart = toBase64Url(encoder.encode(JSON.stringify(header)));
  const payloadPart = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerPart}.${payloadPart}`;

  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signingInput));
  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySession(token: string, secret: string): Promise<SessionData | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerPart, payloadPart, signaturePart] = parts;
    const signingInput = `${headerPart}.${payloadPart}`;

    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      toArrayBuffer(fromBase64Url(signaturePart)),
      encoder.encode(signingInput)
    );

    if (!valid) return null;

    const payload = JSON.parse(decoder.decode(fromBase64Url(payloadPart))) as SessionData;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= nowSec) return null;

    return payload;
  } catch {
    return null;
  }
}

export function decodeSessionPayload(token: string): SessionData | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(decoder.decode(fromBase64Url(parts[1]))) as SessionData;
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= nowSec) return null;
    if (!payload.user || typeof payload.user.sub !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

export function sanitizeCallbackUrl(callbackUrl: string | null | undefined): string {
  if (!callbackUrl) return "/";
  if (!callbackUrl.startsWith("/")) return "/";
  if (callbackUrl.startsWith("//")) return "/";
  return callbackUrl;
}
