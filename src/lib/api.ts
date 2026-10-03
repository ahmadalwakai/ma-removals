import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { API_BASE_URL, APP_VERSION } from "../config";

const TOKEN_KEY = "ma_admin_mobile_token";
const USER_KEY = "ma_admin_mobile_user";
const EXPIRES_KEY = "ma_admin_mobile_expires_at";

async function setStoredValue(key: string, value: string): Promise<void> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getStoredValue(key: string): Promise<string | null> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.localStorage.getItem(key);
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function deleteStoredValue(key: string): Promise<void> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.localStorage.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore missing native module in unsupported runtimes.
  }
}

export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentStatus =
  | "UNPAID"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export type AdminUser = {
  id: string;
  role: "ADMIN";
  name: string | null;
  email: string | null;
};

export type AuthSession = {
  token: string;
  expiresAt: string;
  user: AdminUser;
};

export type BookingSummary = {
  id: string;
  reference: string;
  customer: { name: string | null; email: string | null; phone: string | null };
  serviceName: string;
  pickupAddress: string;
  pickupPostcode: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffPostcode: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  scheduledDate: string;
  scheduledTime: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  totalPaid: number;
  quotedPrice: number;
  driver: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type DriverSummary = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  vehicleType: string;
  licensePlate: string;
  isActive: boolean;
  rating: number;
  jobsCompleted: number;
  createdAt: string;
};

export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  isRead: boolean;
  metadata: unknown;
  createdAt: string;
};

export type OverviewResponse = {
  user: AdminUser;
  generatedAt: string;
  kpis: {
    totalBookings: number;
    thisMonthBookings: number;
    lastMonthBookings: number;
    revenueThisMonth: number;
    revenueLastMonth: number;
    activeDrivers: number;
    activeJobs: number;
    byStatus: Record<string, number>;
  };
  bookings: BookingSummary[];
  drivers: DriverSummary[];
  notifications: {
    unreadCount: number;
    items: AdminNotification[];
  };
};

export type BookingDetail = BookingSummary & {
  customer: BookingSummary["customer"] & { createdAt: string };
  serviceVariant: string | null;
  moveType?: string;
  moveSize?: string;
  pickupPropertyType?: string;
  pickupFloor: number;
  pickupHasLift: boolean;
  dropoffPropertyType?: string;
  dropoffFloor: number;
  dropoffHasLift: boolean;
  distanceMiles: number;
  estimatedHours: number | null;
  basePrice: number;
  finalPrice: number | null;
  isPaid: boolean;
  helpersCount: number;
  peopleNeeded?: number;
  needsPacking: boolean;
  needsAssembly: boolean;
  packingType?: "none" | "materials" | "full";
  dismantlingItems?: number;
  reassemblyItems?: number;
  selectedServices?: Record<string, unknown>;
  notes: string | null;
  items: unknown;
  itemCount?: number;
  driver:
    | {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        vehicleType: string;
        licensePlate: string;
      }
    | null;
  bookingItems: Array<{
    id: string;
    quantity: number;
    item: {
      id: string;
      name: string;
      category: string;
      weight: string;
      size: string;
    };
  }>;
  payments: Array<{
    id: string;
    stripeId: string;
    amount: number;
    currency: string;
    status: string;
    refundAmount: number | null;
    createdAt: string;
  }>;
  history: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    changedByRole: string | null;
    note: string | null;
    timestamp: string;
  }>;
  trackingEvents: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    isPublic: boolean;
    timestamp: string;
  }>;
};

export type EditableBookingAddress = {
  fullAddress?: string;
  postcode?: string;
  lat?: number | null;
  lng?: number | null;
  propertyType?: string;
  floor?: number;
  hasLift?: boolean;
};

export type EditableBookingItem = {
  itemId: string;
  quantity: number;
  room?: string;
};

export type UpdateBookingPayload = {
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  pickup?: EditableBookingAddress;
  dropoff?: EditableBookingAddress;
  moveType?: string;
  moveSize?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  arrivalWindow?: "morning" | "afternoon" | "evening";
  peopleNeeded?: number;
  notes?: string;
  services?: {
    packing?: boolean;
    packingMaterials?: boolean;
    dismantlingItems?: number;
    reassemblyItems?: number;
  };
  items?: EditableBookingItem[];
};

export type CreateDriverPayload = {
  name: string;
  email: string;
  password: string;
};

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request<T>(
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (init.body && typeof init.body === "string") {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...headers,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const payload = await parseJson(res);

  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `فشل الطلب (${res.status})`;
    throw new AdminApiError(message, res.status);
  }

  return payload as T;
}

export async function loginAdmin(
  email: string,
  password: string,
): Promise<AuthSession> {
  return request<AuthSession>("/api/admin/mobile/login", null, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getOverview(token: string): Promise<OverviewResponse> {
  return request<OverviewResponse>("/api/admin/mobile/overview", token);
}

export async function getBookingDetail(
  token: string,
  bookingId: string,
): Promise<BookingDetail> {
  const result = await request<{ booking: BookingDetail }>(
    `/api/admin/mobile/bookings/${bookingId}`,
    token,
  );
  return result.booking;
}

export type RouteDirections = {
  distanceMiles?: number;
  durationMinutes?: number;
  geometry?: string | null;
  geometryCoordinates?: Array<[number, number]> | null;
};

export type GeocodeLocation = {
  lat: number;
  lng: number;
  fullAddress?: string;
};

export async function getGeocodeLocation(query: string): Promise<GeocodeLocation | null> {
  const result = await request<{
    features?: Array<{
      lat?: number;
      lng?: number;
      fullAddress?: string;
    }>;
  }>(`/api/booking/geocode?q=${encodeURIComponent(query)}`, null);
  const first = result.features?.find(
    (feature) =>
      typeof feature.lat === "number" &&
      Number.isFinite(feature.lat) &&
      typeof feature.lng === "number" &&
      Number.isFinite(feature.lng),
  );
  return first ? { lat: first.lat as number, lng: first.lng as number, fullAddress: first.fullAddress } : null;
}

export async function getRouteDirections(
  from: string,
  to: string,
): Promise<RouteDirections> {
  return request<RouteDirections>(
    `/api/booking/directions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    null,
  );
}

export async function updateBookingStatus(
  token: string,
  bookingId: string,
  status: BookingStatus,
): Promise<void> {
  await request(`/api/admin/mobile/bookings/${bookingId}/status`, token, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function assignBookingDriver(
  token: string,
  bookingId: string,
  driverId: string,
): Promise<void> {
  await request(`/api/admin/mobile/bookings/${bookingId}/assign-driver`, token, {
    method: "PATCH",
    body: JSON.stringify({ driverId }),
  });
}

export async function updateBookingDetail(
  token: string,
  bookingId: string,
  payload: UpdateBookingPayload,
): Promise<{
  ok: boolean;
  quotedPrice: number;
  finalPrice: number;
  peopleNeeded: number;
  itemCount: number;
  manualReviewReasons: string[];
}> {
  return request(`/api/admin/mobile/bookings/${bookingId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function toggleDriverActive(
  token: string,
  driverId: string,
  isActive: boolean,
): Promise<void> {
  await request(`/api/admin/mobile/drivers/${driverId}/toggle`, token, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export async function createDriver(
  token: string,
  payload: CreateDriverPayload,
): Promise<DriverSummary> {
  const result = await request<{ driver: DriverSummary }>("/api/admin/mobile/drivers", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result.driver;
}

export async function markAllNotificationsRead(token: string): Promise<void> {
  await request("/api/admin/mobile/notifications/read", token, { method: "POST" });
}

export async function markNotificationRead(
  token: string,
  notificationId: string,
): Promise<void> {
  await request(`/api/admin/mobile/notifications/${notificationId}`, token, {
    method: "PATCH",
  });
}

export async function registerAdminPushToken(
  token: string,
  pushToken: string,
): Promise<void> {
  await request("/api/admin/mobile/push/register", token, {
    method: "POST",
    body: JSON.stringify({
      token: pushToken,
      platform: "android",
      appVersion: APP_VERSION,
    }),
  });
}

export async function saveSession(session: AuthSession): Promise<void> {
  await setStoredValue(TOKEN_KEY, session.token);
  await setStoredValue(USER_KEY, JSON.stringify(session.user));
  await setStoredValue(EXPIRES_KEY, session.expiresAt);
}

export async function loadStoredSession(): Promise<AuthSession | null> {
  const [token, userRaw, expiresAt] = await Promise.all([
    getStoredValue(TOKEN_KEY),
    getStoredValue(USER_KEY),
    getStoredValue(EXPIRES_KEY),
  ]);

  if (!token || !userRaw || !expiresAt) return null;
  if (new Date(expiresAt).getTime() <= Date.now()) {
    await clearSession();
    return null;
  }

  try {
    return {
      token,
      expiresAt,
      user: JSON.parse(userRaw) as AdminUser,
    };
  } catch {
    await clearSession();
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    deleteStoredValue(TOKEN_KEY),
    deleteStoredValue(USER_KEY),
    deleteStoredValue(EXPIRES_KEY),
  ]);
}
