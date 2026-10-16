import { fromBase64Url, randomToken, safeEqual, toBase64Url } from "./crypto";

// Workers accept at most 100000 PBKDF2 iterations.
const ITERATIONS = 100_000;
const FORMAT = "pbkdf2-sha256";
const encoder = new TextEncoder();

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** `pbkdf2-sha256$<iterations>$<salt>$<hash>`, the format of `OWNER_PASSWORD_HASH`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = fromBase64Url(randomToken(16));
  const hash = await derive(password, salt, ITERATIONS);
  return [FORMAT, ITERATIONS, toBase64Url(salt), toBase64Url(hash)].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [format, iterations, salt, hash] = stored.split("$");
  const count = Number(iterations);
  if (format !== FORMAT || !salt || !hash || !Number.isInteger(count) || count < 1 || count > ITERATIONS) {
    return false;
  }
  const actual = await derive(password, fromBase64Url(salt), count);
  return safeEqual(actual, fromBase64Url(hash));
}
