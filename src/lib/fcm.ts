import { db } from "@/lib/db";

/**
 * FCM HTTP v1 sender. Authenticates with a Firebase service account
 * (set as the JSON-encoded `FIREBASE_SERVICE_ACCOUNT_JSON` env var) and
 * sends DATA-only messages so the native FCMService in the admin
 * Android app owns the notification rendering (full-screen intent +
 * custom channel — see android-fcm-lockscreen-alerts memory note).
 *
 * Token caching:
 *  - Access tokens live ~1h; we cache in-process and refresh ~5m early.
 *  - Tokens that come back from FCM with `UNREGISTERED`/`INVALID_ARGUMENT`
 *    are auto-pruned from `FcmToken`.
 */

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;
let cachedAccount: ServiceAccount | null = null;

function readServiceAccount(): ServiceAccount | null {
  if (cachedAccount) return cachedAccount;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      return null;
    }
    // Service accounts copied from the Firebase console keep `\n` literal.
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    cachedAccount = parsed;
    return parsed;
  } catch {
    return null;
  }
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function mintAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(
    new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })),
  );
  const payload = b64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: account.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const unsigned = `${header}.${payload}`;
  const key = await importPrivateKey(account.private_key);
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsigned),
    ),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth token mint failed: ${res.status}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 300) * 1000,
  };
  return cachedToken.value;
}

async function getAccessToken(): Promise<string | null> {
  const account = readServiceAccount();
  if (!account) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  return mintAccessToken(account);
}

export interface FcmPayload {
  title: string;
  body: string;
  /** App-internal route, e.g. `/admin/bookings/abc123`. */
  deeplink?: string;
  /** Logical event type used for native deduplication/grouping. */
  type?: string;
  /** Stable reference for the underlying entity (booking ref, lead id…). */
  ref?: string;
}

interface FcmSendResult {
  attempted: number;
  delivered: number;
  pruned: number;
  configured: boolean;
}

/**
 * Send a DATA-only push to all admin devices currently registered
 * with FCM. Silent failures only — callers should never block on push
 * delivery (web admin notifications are still the source of truth).
 */
export async function sendAdminPush(payload: FcmPayload): Promise<FcmSendResult> {
  const account = readServiceAccount();
  if (!account) {
    return { attempted: 0, delivered: 0, pruned: 0, configured: false };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { attempted: 0, delivered: 0, pruned: 0, configured: false };
  }

  // Only push to recently-active devices to keep blast radius small.
  const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60); // 60 days
  const targets = await db.fcmToken.findMany({
    where: { lastSeenAt: { gte: cutoff } },
    select: { id: true, token: true },
  });
  if (targets.length === 0) {
    return { attempted: 0, delivered: 0, pruned: 0, configured: true };
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;
  const dead: string[] = [];
  let delivered = 0;

  await Promise.all(
    targets.map(async ({ id, token }) => {
      const message = {
        token,
        data: {
          title: payload.title,
          body: payload.body,
          ...(payload.deeplink ? { deeplink: payload.deeplink } : {}),
          ...(payload.type ? { type: payload.type } : {}),
          ...(payload.ref ? { ref: payload.ref } : {}),
        },
        android: {
          priority: "HIGH",
          // Direct boot delivery isn't supported via HTTP v1; the native
          // service handles the rest. Keep TTL short — stale alerts are
          // worse than no alert.
          ttl: "120s",
        },
      };
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message }),
        });
        if (res.ok) {
          delivered += 1;
          return;
        }
        const text = await res.text();
        if (
          res.status === 404 ||
          /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/.test(text)
        ) {
          dead.push(id);
        }
      } catch {
        /* network blip — try again on the next event */
      }
    }),
  );

  if (dead.length > 0) {
    await db.fcmToken
      .deleteMany({ where: { id: { in: dead } } })
      .catch(() => {});
  }

  return {
    attempted: targets.length,
    delivered,
    pruned: dead.length,
    configured: true,
  };
}

/**
 * Send a DATA-only push to every device registered by a single driver
 * (DriverProfile.id). Used when an admin assigns / sends a job to a
 * driver so their Android app pops the full-screen lock-screen alert.
 * Silent failures only — never throws; callers must not block on it.
 */
export async function sendDriverPush(
  driverProfileId: string,
  payload: FcmPayload,
): Promise<FcmSendResult> {
  const account = readServiceAccount();
  if (!account) {
    return { attempted: 0, delivered: 0, pruned: 0, configured: false };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { attempted: 0, delivered: 0, pruned: 0, configured: false };
  }

  const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 60); // 60 days
  const targets = await db.driverFcmToken.findMany({
    where: { driverId: driverProfileId, lastSeenAt: { gte: cutoff } },
    select: { id: true, token: true },
  });
  if (targets.length === 0) {
    return { attempted: 0, delivered: 0, pruned: 0, configured: true };
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`;
  const dead: string[] = [];
  let delivered = 0;

  await Promise.all(
    targets.map(async ({ id, token }) => {
      const message = {
        token,
        data: {
          title: payload.title,
          body: payload.body,
          ...(payload.deeplink ? { deeplink: payload.deeplink } : {}),
          ...(payload.type ? { type: payload.type } : {}),
          ...(payload.ref ? { ref: payload.ref } : {}),
        },
        android: {
          priority: "HIGH",
          ttl: "120s",
        },
      };
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message }),
        });
        if (res.ok) {
          delivered += 1;
          return;
        }
        const text = await res.text();
        if (
          res.status === 404 ||
          /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/.test(text)
        ) {
          dead.push(id);
        }
      } catch {
        /* network blip — try again on the next event */
      }
    }),
  );

  if (dead.length > 0) {
    await db.driverFcmToken
      .deleteMany({ where: { id: { in: dead } } })
      .catch(() => {});
  }

  return {
    attempted: targets.length,
    delivered,
    pruned: dead.length,
    configured: true,
  };
}
