import { createHmac, timingSafeEqual } from "crypto";

/**
 * Lightweight, dependency-free bearer tokens for the native driver app.
 *
 * The web driver portal authenticates with a NextAuth session cookie, which is
 * impractical to consume from a React Native client. Instead the native app
 * logs in once (email + password) and receives an HMAC-signed token it stores
 * in `expo-secure-store` and sends as `Authorization: Bearer <token>` on every
 * request. The token is verified here and resolved to a `DriverProfile` by
 * `requireDriver()`.
 *
 * Format: `base64url(payloadJson).base64url(hmacSha256)`. Stateless and signed
 * with the same server secret NextAuth already relies on, so no new env var.
 */

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export interface DriverTokenPayload {
  /** DriverProfile.id */
  driverId: string;
  /** User.id of the driver */
  userId: string;
  /** Issued-at (ms epoch). */
  iat: number;
  /** Expiry (ms epoch). */
  exp: number;
}

function getSecret(): string {
  const secret =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.DRIVER_TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set — cannot sign or verify driver tokens.",
    );
  }
  return secret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64url(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

function sign(data: string): string {
  return base64url(createHmac("sha256", getSecret()).update(data).digest());
}

/** Create a signed bearer token for a driver. */
export function signDriverToken(driverId: string, userId: string): string {
  const now = Date.now();
  const payload: DriverTokenPayload = {
    driverId,
    userId,
    iat: now,
    exp: now + TOKEN_TTL_MS,
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/**
 * Verify a bearer token. Returns the payload when the signature is valid and
 * the token has not expired, otherwise `null`. Never throws on malformed input.
 */
export function verifyDriverToken(token: string | null | undefined): DriverTokenPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature) return null;

  let expected: string;
  try {
    expected = sign(body);
  } catch {
    return null;
  }

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromBase64url(body).toString("utf8")) as DriverTokenPayload;
    if (
      typeof payload.driverId !== "string" ||
      typeof payload.userId !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
