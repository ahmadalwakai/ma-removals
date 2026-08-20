import { createHmac, timingSafeEqual } from "crypto";

import { db } from "@/lib/db";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

type AdminTokenPayload = {
  kind: "admin-mobile";
  sub: string;
  role: "ADMIN";
  name: string | null;
  email: string | null;
  iat: number;
  exp: number;
};

export type AdminMobileUser = {
  id: string;
  role: "ADMIN";
  name: string | null;
  email: string | null;
};

function getSecret(): string {
  const secret =
    process.env.ADMIN_MOBILE_AUTH_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error(
      "ADMIN_MOBILE_AUTH_SECRET, AUTH_SECRET or NEXTAUTH_SECRET is required for mobile admin auth.",
    );
  }

  return secret;
}

function encodeBase64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function signPayload(payloadPart: string): string {
  return encodeBase64Url(
    createHmac("sha256", getSecret()).update(payloadPart).digest(),
  );
}

function isPayload(value: unknown): value is AdminTokenPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return (
    payload.kind === "admin-mobile" &&
    payload.role === "ADMIN" &&
    typeof payload.sub === "string" &&
    typeof payload.iat === "number" &&
    typeof payload.exp === "number" &&
    (typeof payload.name === "string" || payload.name === null) &&
    (typeof payload.email === "string" || payload.email === null)
  );
}

export function createAdminMobileToken(user: AdminMobileUser): {
  token: string;
  expiresAt: string;
} {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + TOKEN_TTL_SECONDS;
  const payload: AdminTokenPayload = {
    kind: "admin-mobile",
    sub: user.id,
    role: "ADMIN",
    name: user.name,
    email: user.email,
    iat,
    exp,
  };

  const payloadPart = encodeBase64Url(JSON.stringify(payload));
  const signaturePart = signPayload(payloadPart);

  return {
    token: `${payloadPart}.${signaturePart}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function verifyAdminMobileToken(token: string): AdminTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadPart, signaturePart] = parts;
  if (!payloadPart || !signaturePart) return null;

  const expected = Buffer.from(signPayload(payloadPart));
  const actual = Buffer.from(signaturePart);
  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(decodeBase64Url(payloadPart));
  } catch {
    return null;
  }

  if (!isPayload(payload)) return null;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

  return payload;
}

export async function requireAdminMobile(
  req: Request,
): Promise<AdminMobileUser | null> {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  const payload = verifyAdminMobileToken(token);
  if (!payload) return null;

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, name: true, email: true },
  });

  if (!user || user.role !== "ADMIN") return null;

  return {
    id: user.id,
    role: "ADMIN",
    name: user.name,
    email: user.email,
  };
}
