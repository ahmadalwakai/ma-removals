import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  Vibration,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDeepLink } from "../hooks/useDeepLink";
import { usePermissionGate } from "../hooks/usePermissionGate";
import { usePushRegistration } from "../hooks/usePushRegistration";
import {
  assignBookingDriver,
  clearSession,
  createDriver,
  getBookingDetail,
  getOverview,
  loadStoredSession,
  loginAdmin,
  registerAdminPushToken,
  saveSession,
  updateBookingDetail,
  updateBookingStatus,
  type AuthSession,
  type BookingDetail,
  type BookingStatus,
  type BookingSummary,
  type DriverSummary,
  type EditableBookingItem,
  type OverviewResponse,
  type UpdateBookingPayload,
} from "../lib/api";

type ScreenKey = "home" | "bookings" | "settings";
type AuthState = "checking" | "signed-out" | "signed-in";
type ArrivalWindow = "morning" | "afternoon" | "evening";
type PackingMode = "none" | "materials" | "full";

type SelectorOption = {
  label: string;
  value: string;
  helper?: string;
};

type SelectorState = {
  title: string;
  options: SelectorOption[];
  onSelect: (value: string) => void;
} | null;

type DraftItem = EditableBookingItem & {
  name: string;
  category: string;
};

type BookingDraft = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickupAddress: string;
  pickupPostcode: string;
  pickupPropertyType: string;
  pickupFloor: number;
  pickupHasLift: boolean;
  dropoffAddress: string;
  dropoffPostcode: string;
  dropoffPropertyType: string;
  dropoffFloor: number;
  dropoffHasLift: boolean;
  scheduledDate: string;
  scheduledTime: string;
  arrivalWindow: ArrivalWindow;
  peopleNeeded: number;
  packingMode: PackingMode;
  dismantlingItems: number;
  reassemblyItems: number;
  notes: string;
  driverId: string;
  items: DraftItem[];
};

const PROPERTY_OPTIONS: SelectorOption[] = [
  { label: "1 Bedroom House", value: "1 Bedroom House" },
  { label: "2 Bedroom House", value: "2 Bedroom House" },
  { label: "3 Bedroom House", value: "3 Bedroom House" },
  { label: "4 Bedroom House", value: "4 Bedroom House" },
  { label: "5+ Bedroom House", value: "5+ Bedroom House" },
  { label: "Studio Flat", value: "Studio Flat" },
  { label: "1 Bedroom Flat", value: "1 Bedroom Flat" },
  { label: "2 Bedroom Flat", value: "2 Bedroom Flat" },
  { label: "3 Bedroom Flat", value: "3 Bedroom Flat" },
];

const ARRIVAL_OPTIONS: SelectorOption[] = [
  { label: "Morning", value: "morning", helper: "09:00" },
  { label: "Afternoon", value: "afternoon", helper: "13:00" },
  { label: "Evening", value: "evening", helper: "17:00" },
];

const PACKING_OPTIONS: SelectorOption[] = [
  { label: "No packing help", value: "none" },
  { label: "Packing materials", value: "materials" },
  { label: "Full packing service", value: "full" },
];

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

const palette = {
  white: "#FFFFFF",
  surface: "#F7F8FA",
  card: "#FFFFFF",
  ink: "#050505",
  muted: "#667085",
  border: "#E4E7EC",
  blue: "#2563EB",
  blueSoft: "#EAF1FF",
  red: "#E11D48",
  redSoft: "#FFF1F3",
  green: "#059669",
  greenSoft: "#ECFDF3",
  amber: "#F59E0B",
  amberSoft: "#FFFAEB",
};

const NEW_BOOKING_SOUND_PATH = "/universfield-ringtone-052-494940.mp3";

type BrowserAudio = {
  volume: number;
  loop: boolean;
  currentTime: number;
  play: () => Promise<void> | void;
  pause: () => void;
};

type BrowserAudioConstructor = new (source?: string) => BrowserAudio;

function playBrowserNewBookingSound(): BrowserAudio | null {
  if (Platform.OS !== "web") return null;
  const AudioCtor = (globalThis as typeof globalThis & { Audio?: BrowserAudioConstructor }).Audio;
  if (!AudioCtor) return null;
  const audio = new AudioCtor(NEW_BOOKING_SOUND_PATH);
  audio.volume = 1;
  audio.loop = false;
  void Promise.resolve(audio.play()).catch(() => {});
  return audio;
}

function gbp(value: number | null | undefined): string {
  return `£${(value ?? 0).toFixed(2)}`;
}

function dateInput(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0, 10)
    : date.toISOString().slice(0, 10);
}

function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function longDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeFromWindow(value: ArrivalWindow): string {
  if (value === "afternoon") return "13:00";
  if (value === "evening") return "17:00";
  return "09:00";
}

function windowFromTime(value: string | null | undefined): ArrivalWindow {
  if (!value) return "morning";
  if (/evening|17|18|19|20/i.test(value)) return "evening";
  if (/afternoon|12|13|14|15|16/i.test(value)) return "afternoon";
  return "morning";
}

function moveSizeFromProperty(propertyType: string): string {
  const value = propertyType.toLowerCase();
  if (value.includes("studio")) return "studio";
  if (value.includes("1")) return "1-bedroom";
  if (value.includes("2")) return "2-bedrooms";
  if (value.includes("3")) return "3-bedrooms";
  if (value.includes("4")) return "4-bedrooms";
  if (value.includes("5")) return "5-plus-bedrooms";
  return "2-bedrooms";
}

function moveTypeFromProperty(propertyType: string): string {
  const value = propertyType.toLowerCase();
  return value.includes("flat") || value.includes("studio") ? "flat-move" : "house-move";
}

function countItems(items: DraftItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

function extractBookingId(path: string | null): string | null {
  if (!path) return null;
  const toMatch = path.match(/[?&]to=([^&]+)/);
  const clean = toMatch ? decodeURIComponent(toMatch[1] ?? "") : path;
  const match = clean.match(/\/admin\/bookings\/([^/?#]+)/) ?? clean.match(/\/bookings\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function notificationBookingId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as { bookingId?: unknown }).bookingId;
  return typeof value === "string" && value ? value : null;
}

function statusTone(status: BookingStatus) {
  if (status === "CANCELLED" || status === "REFUNDED") {
    return { bg: palette.redSoft, color: palette.red };
  }
  if (status === "CONFIRMED" || status === "IN_PROGRESS" || status === "COMPLETED") {
    return { bg: palette.greenSoft, color: palette.green };
  }
  return { bg: palette.amberSoft, color: palette.amber };
}

function createDraft(booking: BookingDetail): BookingDraft {
  const packingMode: PackingMode =
    booking.packingType ??
    (booking.needsPacking ? "materials" : "none");
  const arrivalWindow = windowFromTime(booking.scheduledTime);
  return {
    customerName: booking.customer.name ?? "",
    customerEmail: booking.customer.email ?? "",
    customerPhone: booking.customer.phone ?? "",
    pickupAddress: booking.pickupAddress,
    pickupPostcode: booking.pickupPostcode,
    pickupPropertyType: booking.pickupPropertyType ?? "2 Bedroom House",
    pickupFloor: booking.pickupFloor,
    pickupHasLift: booking.pickupHasLift,
    dropoffAddress: booking.dropoffAddress,
    dropoffPostcode: booking.dropoffPostcode,
    dropoffPropertyType: booking.dropoffPropertyType ?? booking.pickupPropertyType ?? "2 Bedroom House",
    dropoffFloor: booking.dropoffFloor,
    dropoffHasLift: booking.dropoffHasLift,
    scheduledDate: dateInput(booking.scheduledDate),
    scheduledTime: booking.scheduledTime || timeFromWindow(arrivalWindow),
    arrivalWindow,
    peopleNeeded: booking.peopleNeeded ?? booking.helpersCount + 1,
    packingMode,
    dismantlingItems: booking.dismantlingItems ?? (booking.needsAssembly ? 1 : 0),
    reassemblyItems: booking.reassemblyItems ?? 0,
    notes: booking.notes ?? "",
    driverId: booking.driver?.id ?? "",
    items: booking.bookingItems.map((entry) => ({
      itemId: entry.item.id,
      name: entry.item.name,
      category: entry.item.category,
      quantity: entry.quantity,
      room: "other",
    })),
  };
}

function payloadFromDraft(draft: BookingDraft): UpdateBookingPayload {
  const packing = draft.packingMode === "full";
  const packingMaterials = draft.packingMode === "materials" || draft.packingMode === "full";
  return {
    customer: {
      name: draft.customerName.trim(),
      email: draft.customerEmail.trim(),
      phone: draft.customerPhone.trim(),
    },
    pickup: {
      fullAddress: draft.pickupAddress.trim(),
      postcode: draft.pickupPostcode.trim(),
      propertyType: draft.pickupPropertyType,
      floor: draft.pickupFloor,
      hasLift: draft.pickupHasLift,
    },
    dropoff: {
      fullAddress: draft.dropoffAddress.trim(),
      postcode: draft.dropoffPostcode.trim(),
      propertyType: draft.dropoffPropertyType,
      floor: draft.dropoffFloor,
      hasLift: draft.dropoffHasLift,
    },
    moveType: moveTypeFromProperty(draft.pickupPropertyType),
    moveSize: moveSizeFromProperty(draft.pickupPropertyType),
    scheduledDate: draft.scheduledDate,
    scheduledTime: draft.scheduledTime || timeFromWindow(draft.arrivalWindow),
    arrivalWindow: draft.arrivalWindow,
    peopleNeeded: draft.peopleNeeded,
    notes: draft.notes.trim(),
    services: {
      packing,
      packingMaterials,
      dismantlingItems: draft.dismantlingItems,
      reassemblyItems: draft.reassemblyItems,
    },
    items: draft.items.map((item) => ({
      itemId: item.itemId,
      quantity: item.quantity,
      room: item.room,
    })),
  };
}

export function AdminApp() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [activeScreen, setActiveScreen] = useState<ScreenKey>("home");
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [selector, setSelector] = useState<SelectorState>(null);
  const [newBookingPopup, setNewBookingPopup] = useState<BookingSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | BookingStatus>("all");

  const authedRef = useRef(false);
  const pendingPushTokenRef = useRef<string | null>(null);
  const latestBookingRef = useRef<string | null>(null);
  const initialOverviewLoadedRef = useRef(false);
  const surfacedNotificationIdsRef = useRef<Set<string>>(new Set());
  const { pendingPath, consume } = useDeepLink();
  const gate = usePermissionGate();

  const registerToken = useCallback((pushToken: string) => {
    pendingPushTokenRef.current = pushToken;
    if (!authedRef.current || !session?.token) return;
    void registerAdminPushToken(session.token, pushToken).catch(() => {});
  }, [session?.token]);

  const push = usePushRegistration(registerToken);

  const loadOverview = useCallback(
    async (mode: "initial" | "refresh" | "poll" = "initial") => {
      if (!session?.token) return;
      if (mode === "initial") setOverviewLoading(true);
      if (mode === "refresh") setRefreshing(true);
      try {
        const data = await getOverview(session.token);
        setOverview(data);
        const newest = data.bookings[0] ?? null;
        if (!initialOverviewLoadedRef.current) {
          latestBookingRef.current = newest?.id ?? null;
          initialOverviewLoadedRef.current = true;
        } else if (newest && newest.id !== latestBookingRef.current) {
          latestBookingRef.current = newest.id;
          setNewBookingPopup(newest);
        } else if (newest) {
          latestBookingRef.current = newest.id;
        } else {
          latestBookingRef.current = null;
        }
      } catch (error) {
        if (mode !== "poll") {
          Alert.alert("Admin app", error instanceof Error ? error.message : "Unable to load bookings");
        }
      } finally {
        setOverviewLoading(false);
        setRefreshing(false);
      }
    },
    [session?.token],
  );

  const openBooking = useCallback((bookingId: string) => {
    setSelectedBookingId(bookingId);
    setActiveScreen("bookings");
    setNewBookingPopup(null);
  }, []);

  const loadBooking = useCallback(async () => {
    if (!session?.token || !selectedBookingId) return;
    setDetailLoading(true);
    try {
      const data = await getBookingDetail(session.token, selectedBookingId);
      setSelectedBooking(data);
      setDraft(createDraft(data));
    } catch (error) {
      Alert.alert("Booking", error instanceof Error ? error.message : "Unable to open booking");
      setSelectedBookingId(null);
      setSelectedBooking(null);
      setDraft(null);
    } finally {
      setDetailLoading(false);
    }
  }, [selectedBookingId, session?.token]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadStoredSession();
      if (cancelled) return;
      if (!stored) {
        setAuthState("signed-out");
        return;
      }
      authedRef.current = true;
      setSession(stored);
      setAuthState("signed-in");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authState !== "signed-in" || !session?.token) return;
    void loadOverview("initial");
    if (pendingPushTokenRef.current) {
      void registerAdminPushToken(session.token, pendingPushTokenRef.current).catch(() => {});
    }
  }, [authState, loadOverview, session?.token]);

  useEffect(() => {
    if (!session?.token) return;
    const timer = setInterval(() => void loadOverview("poll"), 12000);
    const appSub = AppState.addEventListener("change", (next) => {
      if (next === "active") void loadOverview("poll");
    });
    return () => {
      clearInterval(timer);
      appSub.remove();
    };
  }, [loadOverview, session?.token]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  useEffect(() => {
    if (!pendingPath || authState !== "signed-in") return;
    const bookingId = extractBookingId(pendingPath);
    if (bookingId) openBooking(bookingId);
    consume();
  }, [authState, consume, openBooking, pendingPath]);

  useEffect(() => {
    if (!overview || selectedBookingId || newBookingPopup) return;
    const unreadNewBooking = overview.notifications.items.find(
      (item) =>
        item.type === "new_booking" &&
        !item.isRead &&
        !surfacedNotificationIdsRef.current.has(item.id),
    );
    if (!unreadNewBooking) return;
    const bookingId = notificationBookingId(unreadNewBooking?.metadata);
    if (!bookingId) return;
    const booking = overview.bookings.find((item) => item.id === bookingId);
    if (!booking) return;
    surfacedNotificationIdsRef.current.add(unreadNewBooking.id);
    setNewBookingPopup(booking);
  }, [newBookingPopup, overview, selectedBookingId]);

  const submitLogin = useCallback(async () => {
    setLoginBusy(true);
    setLoginError("");
    try {
      const nextSession = await loginAdmin(email.trim(), password);
      await saveSession(nextSession);
      authedRef.current = true;
      setSession(nextSession);
      setAuthState("signed-in");
      if (pendingPushTokenRef.current) {
        void registerAdminPushToken(nextSession.token, pendingPushTokenRef.current).catch(() => {});
      }
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoginBusy(false);
    }
  }, [email, password]);

  const logout = useCallback(async () => {
    authedRef.current = false;
    await clearSession();
    setSession(null);
    setOverview(null);
    setSelectedBookingId(null);
    setSelectedBooking(null);
    setDraft(null);
    setAuthState("signed-out");
  }, []);

  const saveBooking = useCallback(async () => {
    if (!session?.token || !selectedBooking || !draft) return;
    setSaving(true);
    try {
      await updateBookingDetail(session.token, selectedBooking.id, payloadFromDraft(draft));
      if (draft.driverId && draft.driverId !== selectedBooking.driver?.id) {
        await assignBookingDriver(session.token, selectedBooking.id, draft.driverId);
      }
      await Promise.all([loadBooking(), loadOverview("refresh")]);
      Alert.alert("Saved", "Booking updated and price recalculated.");
    } catch (error) {
      Alert.alert("Save failed", error instanceof Error ? error.message : "Unable to save booking");
    } finally {
      setSaving(false);
    }
  }, [draft, loadBooking, loadOverview, selectedBooking, session?.token]);

  const changeStatus = useCallback(
    async (status: BookingStatus) => {
      if (!session?.token || !selectedBooking) return;
      try {
        await updateBookingStatus(session.token, selectedBooking.id, status);
        await Promise.all([loadBooking(), loadOverview("refresh")]);
      } catch (error) {
        Alert.alert("Status", error instanceof Error ? error.message : "Unable to update status");
      }
    },
    [loadBooking, loadOverview, selectedBooking, session?.token],
  );

  const openSelector = useCallback(
    (title: string, options: SelectorOption[], onSelect: (value: string) => void) => {
      setSelector({ title, options, onSelect });
    },
    [],
  );

  const filteredBookings = useMemo(() => {
    const rows = overview?.bookings ?? [];
    if (statusFilter === "all") return rows;
    return rows.filter((booking) => booking.status === statusFilter);
  }, [overview?.bookings, statusFilter]);

  if (authState === "checking") {
    return (
      <LoginScreen
        email=""
        password=""
        busy
        splash
        error=""
        onEmail={() => {}}
        onPassword={() => {}}
        onSubmit={() => {}}
      />
    );
  }

  if (authState === "signed-out") {
    return (
      <LoginScreen
        email={email}
        password={password}
        busy={loginBusy}
        error={loginError}
        onEmail={setEmail}
        onPassword={setPassword}
        onSubmit={submitLogin}
      />
    );
  }

  return (
    <View style={styles.root}>
      <Header userName={session?.user.name ?? session?.user.email ?? "Admin"} />
      <View style={styles.content}>
        {activeScreen === "home" ? (
          <HomeScreen
            overview={overview}
            loading={overviewLoading}
            refreshing={refreshing}
            onRefresh={() => void loadOverview("refresh")}
            onOpenBookings={() => setActiveScreen("bookings")}
            onOpenBooking={openBooking}
          />
        ) : null}
        {activeScreen === "bookings" ? (
          <BookingsScreen
            overview={overview}
            bookings={filteredBookings}
            selectedBooking={selectedBooking}
            selectedBookingId={selectedBookingId}
            draft={draft}
            drivers={overview?.drivers ?? []}
            detailLoading={detailLoading}
            refreshing={refreshing}
            saving={saving}
            statusFilter={statusFilter}
            onFilter={setStatusFilter}
            onRefresh={() => void loadOverview("refresh")}
            onOpenBooking={openBooking}
            onBackToList={() => {
              setSelectedBookingId(null);
              setSelectedBooking(null);
              setDraft(null);
            }}
            onDraft={setDraft}
            onSelector={openSelector}
            onSave={() => void saveBooking()}
            onStatus={(status) => void changeStatus(status)}
          />
        ) : null}
        {activeScreen === "settings" ? (
          <SettingsScreen
            session={session}
            drivers={overview?.drivers ?? []}
            gate={gate}
            pushEnabled={push.permissionGranted}
            pushToken={push.token}
            onLogout={() => void logout()}
            onRefresh={() => void loadOverview("refresh")}
          />
        ) : null}
      </View>
      <Tabs active={activeScreen} onChange={setActiveScreen} />
      <SelectorModal selector={selector} onClose={() => setSelector(null)} />
      <NewBookingModal
        booking={newBookingPopup}
        onDismiss={() => setNewBookingPopup(null)}
        onOpen={(id) => openBooking(id)}
      />
    </View>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={palette.blue} size="large" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

function LoginScreen(props: {
  email: string;
  password: string;
  busy: boolean;
  splash?: boolean;
  error: string;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onSubmit: () => void;
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const isSplash = props.splash === true;
  const logoOrbitProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    logoOrbitProgress.setValue(0);
    const orbit = Animated.loop(
      Animated.timing(logoOrbitProgress, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    orbit.start();
    return () => orbit.stop();
  }, [logoOrbitProgress]);

  const logoOrbitRotate = logoOrbitProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const logoOrbitReverseRotate = logoOrbitProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });
  const logoOrbitPulse = logoOrbitProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.72, 1, 0.72],
  });
  const heroUnderlineScale = logoOrbitProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.66, 1, 0.66],
  });
  const heroUnderlineOpacity = logoOrbitProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.38, 0.95, 0.38],
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.loginRoot}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.loginScroll}
      >
        <View style={[styles.loginShell, isWide ? styles.loginShellWide : null]}>
          <View style={[styles.loginBrandPanel, isWide ? styles.loginBrandPanelWide : null]}>
            <View style={styles.loginLogoRow}>
              <View style={styles.loginLogoFrame}>
                <Animated.View style={[styles.loginLogoOrbitHalo, { opacity: logoOrbitPulse }]} />
                <Animated.View
                  style={[
                    styles.loginLogoOrbitOuterRing,
                    {
                      transform: [{ rotate: logoOrbitRotate }],
                    },
                  ]}
                >
                  <View style={styles.loginLogoOrbitDotPrimary} />
                  <View style={styles.loginLogoOrbitDotSecondary} />
                </Animated.View>
                <Animated.View
                  style={[
                    styles.loginLogoOrbitInnerRing,
                    {
                      opacity: logoOrbitPulse,
                      transform: [{ rotate: logoOrbitReverseRotate }],
                    },
                  ]}
                />
                <Image
                  source={require("../../assets/icon.png")}
                  style={styles.loginLogo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.loginBrandCopy}>
                <Text style={styles.loginBrandName}>MA Removals</Text>
                <Text style={styles.loginBrandTag}>Moving Made Easy</Text>
              </View>
            </View>

            <View style={styles.loginHeroTitleWrap}>
              <Text style={styles.loginHeroTitle}>Admin control</Text>
              <Animated.View
                style={[
                  styles.loginHeroUnderline,
                  {
                    opacity: heroUnderlineOpacity,
                    transform: [{ scaleX: heroUnderlineScale }],
                  },
                ]}
              />
            </View>
            <Text style={styles.loginHeroText}>
              Manage bookings, drivers, pricing and live booking alerts from one secure app.
            </Text>

            <View style={styles.loginStatusPanel}>
              <View style={styles.loginStatusRow}>
                <View style={styles.loginStatusDot} />
                <Text style={styles.loginStatusText}>Production system</Text>
              </View>
              <View style={styles.loginStatusDivider} />
              <Text style={styles.loginStatusMeta}>Full-screen alerts ready</Text>
            </View>
          </View>

          <View style={styles.loginCard}>
            <View style={styles.loginFormHeader}>
              <Text style={styles.loginKicker}>Admin access</Text>
              <Text style={styles.loginTitle}>{isSplash ? "Starting" : "Sign in"}</Text>
              <Text style={styles.loginSubtitle}>
                {isSplash ? "Preparing your secure admin session." : "Use your admin credentials to continue."}
              </Text>
            </View>

            <LoginField
              label="Email address"
              value={props.email}
              onChange={props.onEmail}
              placeholder="admin@maremovals.com"
              keyboardType="email-address"
              autoCapitalize="none"
              icon="@"
              disabled={isSplash}
            />
            <LoginField
              label="Password"
              value={props.password}
              onChange={props.onPassword}
              placeholder="Enter password"
              secureTextEntry
              icon="*"
              disabled={isSplash}
            />
            {props.error ? (
              <View style={styles.loginErrorBox}>
                <Text style={styles.errorText}>{props.error}</Text>
              </View>
            ) : null}
            <PrimaryButton
              label={isSplash ? "Starting admin app..." : props.busy ? "Signing in..." : "Sign in"}
              disabled={props.busy || !props.email || !props.password}
              onPress={props.onSubmit}
            />
            <Text style={styles.loginFootnote}>
              {isSplash
                ? "Loading alerts, permissions and stored session."
                : "Secure admin session. Alerts stay active after sign in."}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Header({ userName }: { userName: string }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>M&A Admin</Text>
        <Text style={styles.headerSubtitle}>{userName}</Text>
      </View>
      <View style={styles.livePill}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>Live</Text>
      </View>
    </View>
  );
}

function HomeScreen(props: {
  overview: OverviewResponse | null;
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onOpenBookings: () => void;
  onOpenBooking: (id: string) => void;
}) {
  const bookings = props.overview?.bookings.slice(0, 6) ?? [];
  const kpis = props.overview?.kpis;
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} />}
    >
      <View style={styles.homeHero}>
        <Text style={styles.homeTitle}>Operations</Text>
        <Text style={styles.homeSub}>Clean view of today's work.</Text>
      </View>
      <View style={styles.kpiGrid}>
        <Kpi title="Bookings" value={String(kpis?.totalBookings ?? 0)} />
        <Kpi title="This month" value={String(kpis?.thisMonthBookings ?? 0)} />
        <Kpi title="Revenue" value={gbp(kpis?.revenueThisMonth ?? 0)} />
        <Kpi title="Active jobs" value={String(kpis?.activeJobs ?? 0)} />
      </View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent bookings</Text>
        <Pressable onPress={props.onOpenBookings} style={styles.linkButton}>
          <Text style={styles.linkButtonText}>View all</Text>
        </Pressable>
      </View>
      {props.loading && !props.overview ? (
        <LoadingBlock />
      ) : bookings.length === 0 ? (
        <EmptyBlock label="No bookings yet" />
      ) : (
        bookings.map((booking) => (
          <BookingRow key={booking.id} booking={booking} onPress={() => props.onOpenBooking(booking.id)} />
        ))
      )}
    </ScrollView>
  );
}

function BookingsScreen(props: {
  overview: OverviewResponse | null;
  bookings: BookingSummary[];
  selectedBooking: BookingDetail | null;
  selectedBookingId: string | null;
  draft: BookingDraft | null;
  drivers: DriverSummary[];
  detailLoading: boolean;
  refreshing: boolean;
  saving: boolean;
  statusFilter: "all" | BookingStatus;
  onFilter: (status: "all" | BookingStatus) => void;
  onRefresh: () => void;
  onOpenBooking: (id: string) => void;
  onBackToList: () => void;
  onDraft: (draft: BookingDraft | null) => void;
  onSelector: (title: string, options: SelectorOption[], onSelect: (value: string) => void) => void;
  onSave: () => void;
  onStatus: (status: BookingStatus) => void;
}) {
  const filterStatuses: Array<"all" | BookingStatus> = [
    "all",
    "PENDING",
    "CONFIRMED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
  ];
  const allBookings = props.overview?.bookings ?? [];
  const statusCounts = allBookings.reduce<Record<string, number>>(
    (counts, booking) => ({
      ...counts,
      [booking.status]: (counts[booking.status] ?? 0) + 1,
    }),
    { all: allBookings.length },
  );

  if (props.selectedBookingId) {
    if (props.detailLoading || !props.selectedBooking || !props.draft) {
      return <LoadingScreen label="Opening booking" />;
    }
    return (
      <BookingEditor
        booking={props.selectedBooking}
        draft={props.draft}
        drivers={props.drivers}
        saving={props.saving}
        onBack={props.onBackToList}
        onDraft={props.onDraft}
        onSelector={props.onSelector}
        onSave={props.onSave}
        onStatus={props.onStatus}
      />
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterBar}
      >
        {filterStatuses.map((status) => {
          const active = props.statusFilter === status;
          const count = statusCounts[status] ?? 0;
          return (
          <Pressable
            key={status}
            onPress={() => props.onFilter(status)}
            style={[
              styles.filterChip,
              active ? styles.filterChipActive : null,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                active ? styles.filterChipTextActive : null,
              ]}
            >
              {status === "all" ? "All" : STATUS_LABELS[status]}
            </Text>
            <View style={[styles.filterChipCount, active ? styles.filterChipCountActive : null]}>
              <Text style={[styles.filterChipCountText, active ? styles.filterChipCountTextActive : null]}>
                {count}
              </Text>
            </View>
          </Pressable>
          );
        })}
      </ScrollView>
      <FlatList
        data={props.bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} />}
        renderItem={({ item }) => (
          <BookingRow booking={item} onPress={() => props.onOpenBooking(item.id)} />
        )}
        ListEmptyComponent={<EmptyBlock label="No bookings in this view" />}
      />
    </View>
  );
}

function BookingEditor(props: {
  booking: BookingDetail;
  draft: BookingDraft;
  drivers: DriverSummary[];
  saving: boolean;
  onBack: () => void;
  onDraft: (draft: BookingDraft) => void;
  onSelector: (title: string, options: SelectorOption[], onSelect: (value: string) => void) => void;
  onSave: () => void;
  onStatus: (status: BookingStatus) => void;
}) {
  const setDraft = (patch: Partial<BookingDraft>) => {
    props.onDraft({ ...props.draft, ...patch });
  };
  const price = props.booking.finalPrice ?? props.booking.quotedPrice;
  const itemCount = countItems(props.draft.items);
  const driverOptions = [
    { label: "Unassigned", value: "" },
    ...props.drivers.map((driver) => ({
      label: driver.name,
      value: driver.id,
      helper: `${driver.vehicleType.replace(/_/g, " ")} - ${driver.licensePlate}`,
    })),
  ];

  return (
    <View style={styles.flex}>
      <View style={styles.detailHeader}>
        <Pressable onPress={props.onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <View style={styles.detailTitleWrap}>
          <Text style={styles.detailRef}>{props.booking.reference}</Text>
          <Text style={styles.detailPrice}>{gbp(price)}</Text>
        </View>
        <StatusBadge status={props.booking.status} />
      </View>
      <ScrollView contentContainerStyle={styles.editorContent}>
        <Card>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Pickup</Text>
            <Text style={styles.miniMeta}>Scheduled {shortDate(props.booking.scheduledDate)}</Text>
          </View>
          <Field label="Address" value={props.draft.pickupAddress} onChange={(pickupAddress) => setDraft({ pickupAddress })} />
          <Field label="Postcode" value={props.draft.pickupPostcode} onChange={(pickupPostcode) => setDraft({ pickupPostcode })} />
          <OptionField
            label="Property size"
            value={props.draft.pickupPropertyType}
            onPress={() =>
              props.onSelector("Pickup property", PROPERTY_OPTIONS, (value) =>
                setDraft({ pickupPropertyType: value }),
              )
            }
          />
          <View style={styles.twoCol}>
            <NumberStepper label="Floor number" value={props.draft.pickupFloor} min={0} max={30} onChange={(pickupFloor) => setDraft({ pickupFloor })} />
            <Toggle label="Lift available" value={props.draft.pickupHasLift} onChange={(pickupHasLift) => setDraft({ pickupHasLift })} />
          </View>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Drop off</Text>
          <Field label="Address" value={props.draft.dropoffAddress} onChange={(dropoffAddress) => setDraft({ dropoffAddress })} />
          <Field label="Postcode" value={props.draft.dropoffPostcode} onChange={(dropoffPostcode) => setDraft({ dropoffPostcode })} />
          <OptionField
            label="Property size"
            value={props.draft.dropoffPropertyType}
            onPress={() =>
              props.onSelector("Drop off property", PROPERTY_OPTIONS, (value) =>
                setDraft({ dropoffPropertyType: value }),
              )
            }
          />
          <View style={styles.twoCol}>
            <NumberStepper label="Floor number" value={props.draft.dropoffFloor} min={0} max={30} onChange={(dropoffFloor) => setDraft({ dropoffFloor })} />
            <Toggle label="Lift available" value={props.draft.dropoffHasLift} onChange={(dropoffHasLift) => setDraft({ dropoffHasLift })} />
          </View>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Items summary</Text>
          <Text style={styles.summaryText}>{itemCount} items selected</Text>
          {props.draft.items.length === 0 ? (
            <EmptyBlock label="No items on this booking" />
          ) : (
            props.draft.items.map((item) => (
              <View key={item.itemId} style={styles.itemRow}>
                <View style={styles.itemTextWrap}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>{item.category}</Text>
                </View>
                <NumberStepper
                  compact
                  label=""
                  value={item.quantity}
                  min={0}
                  max={99}
                  onChange={(quantity) => {
                    const next = quantity <= 0
                      ? props.draft.items.filter((entry) => entry.itemId !== item.itemId)
                      : props.draft.items.map((entry) =>
                          entry.itemId === item.itemId ? { ...entry, quantity } : entry,
                        );
                    setDraft({ items: next });
                  }}
                />
              </View>
            ))
          )}
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Services and people</Text>
          <OptionField
            label="Packaging"
            value={PACKING_OPTIONS.find((option) => option.value === props.draft.packingMode)?.label ?? "No packing help"}
            onPress={() =>
              props.onSelector("Packaging", PACKING_OPTIONS, (value) =>
                setDraft({ packingMode: value as PackingMode }),
              )
            }
          />
          <NumberStepper label="Dismantling items" value={props.draft.dismantlingItems} min={0} max={99} onChange={(dismantlingItems) => setDraft({ dismantlingItems })} />
          <NumberStepper label="Assembly items" value={props.draft.reassemblyItems} min={0} max={99} onChange={(reassemblyItems) => setDraft({ reassemblyItems })} />
          <NumberStepper label="People needed" value={props.draft.peopleNeeded} min={1} max={12} onChange={(peopleNeeded) => setDraft({ peopleNeeded })} />
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Booking time</Text>
          <Field label="Move date" value={props.draft.scheduledDate} onChange={(scheduledDate) => setDraft({ scheduledDate })} />
          <OptionField
            label="Arrival window"
            value={ARRIVAL_OPTIONS.find((option) => option.value === props.draft.arrivalWindow)?.label ?? "Morning"}
            onPress={() =>
              props.onSelector("Arrival window", ARRIVAL_OPTIONS, (value) =>
                setDraft({
                  arrivalWindow: value as ArrivalWindow,
                  scheduledTime: timeFromWindow(value as ArrivalWindow),
                }),
              )
            }
          />
          <Field label="Time" value={props.draft.scheduledTime} onChange={(scheduledTime) => setDraft({ scheduledTime })} />
          <InfoLine label="Booking made" value={longDateTime(props.booking.createdAt)} />
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Customer details</Text>
          <Field label="Name" value={props.draft.customerName} onChange={(customerName) => setDraft({ customerName })} />
          <Field label="Email" value={props.draft.customerEmail} onChange={(customerEmail) => setDraft({ customerEmail })} autoCapitalize="none" />
          <Field label="Phone" value={props.draft.customerPhone} onChange={(customerPhone) => setDraft({ customerPhone })} keyboardType="phone-pad" />
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Assigned driver</Text>
          <OptionField
            label="Driver"
            value={driverOptions.find((option) => option.value === props.draft.driverId)?.label ?? "Unassigned"}
            onPress={() =>
              props.onSelector("Assign driver", driverOptions, (driverId) =>
                setDraft({ driverId }),
              )
            }
          />
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Customer notes</Text>
          <TextInput
            value={props.draft.notes}
            onChangeText={(notes) => setDraft({ notes })}
            placeholder="Customer note"
            multiline
            maxLength={1200}
            style={[styles.input, styles.noteInput]}
            placeholderTextColor="#98A2B3"
          />
          {props.draft.notes.trim() ? (
            <Text style={styles.customerNotePreview}>{props.draft.notes.trim()}</Text>
          ) : null}
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Actions</Text>
          <PrimaryButton
            label={props.saving ? "Saving..." : "Save and recalculate price"}
            disabled={props.saving}
            onPress={props.onSave}
          />
          <View style={styles.actionRow}>
            <SecondaryButton label="Confirm" onPress={() => props.onStatus("CONFIRMED")} />
            <DangerButton
              label="Cancel"
              onPress={() =>
                Alert.alert("Cancel booking", "Cancel this booking?", [
                  { text: "No", style: "cancel" },
                  { text: "Cancel booking", style: "destructive", onPress: () => props.onStatus("CANCELLED") },
                ])
              }
            />
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

function SettingsScreen(props: {
  session: AuthSession | null;
  drivers: DriverSummary[];
  gate: ReturnType<typeof usePermissionGate>;
  pushEnabled: boolean;
  pushToken: string | null;
  onLogout: () => void;
  onRefresh: () => void;
}) {
  const [driverName, setDriverName] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [driverPassword, setDriverPassword] = useState("");
  const [creatingDriver, setCreatingDriver] = useState(false);

  const submitDriver = useCallback(async () => {
    if (creatingDriver) return;
    if (!props.session?.token) {
      Alert.alert("Add driver", "Admin session is not ready.");
      return;
    }
    const name = driverName.trim();
    const email = driverEmail.trim().toLowerCase();
    if (!name || !email || driverPassword.length < 6) {
      Alert.alert("Add driver", "Enter name, email and a password of at least 6 characters.");
      return;
    }

    setCreatingDriver(true);
    try {
      await createDriver(props.session.token, { name, email, password: driverPassword });
      setDriverName("");
      setDriverEmail("");
      setDriverPassword("");
      props.onRefresh();
      Alert.alert("Driver added", "The driver can now sign in with this email and password.");
    } catch (error) {
      Alert.alert("Add driver", error instanceof Error ? error.message : "Unable to add driver");
    } finally {
      setCreatingDriver(false);
    }
  }, [creatingDriver, driverEmail, driverName, driverPassword, props]);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Card>
        <Text style={styles.cardTitle}>Account</Text>
        <InfoLine label="Name" value={props.session?.user.name ?? "Admin"} />
        <InfoLine label="Email" value={props.session?.user.email ?? "-"} />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Add driver</Text>
        <Field
          label="Name"
          value={driverName}
          onChange={setDriverName}
          autoCapitalize="words"
          editable={!creatingDriver}
        />
        <Field
          label="Email"
          value={driverEmail}
          onChange={setDriverEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!creatingDriver}
        />
        <Field
          label="Password"
          value={driverPassword}
          onChange={setDriverPassword}
          secureTextEntry
          autoCapitalize="none"
          editable={!creatingDriver}
        />
        <PrimaryButton
          label={creatingDriver ? "Adding driver..." : "Add driver"}
          disabled={creatingDriver}
          onPress={() => void submitDriver()}
        />
      </Card>
      <Card>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitle}>Drivers</Text>
          <Text style={styles.miniMeta}>{props.drivers.length} total</Text>
        </View>
        {props.drivers.length ? (
          props.drivers.slice(0, 5).map((driver) => (
            <View key={driver.id} style={styles.driverListRow}>
              <View style={styles.driverAvatar}>
                <Text style={styles.driverAvatarText}>{driver.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.driverListCopy}>
                <Text style={styles.driverListName}>{driver.name}</Text>
                <Text style={styles.driverListEmail}>{driver.email}</Text>
              </View>
              <View style={[styles.driverStatusPill, driver.isActive ? styles.driverStatusActive : styles.driverStatusInactive]}>
                <Text style={[styles.driverStatusText, driver.isActive ? styles.driverStatusTextActive : styles.driverStatusTextInactive]}>
                  {driver.isActive ? "Active" : "Off"}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No drivers yet.</Text>
        )}
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Alerts</Text>
        <InfoLine label="Push permission" value={props.pushEnabled ? "On" : "Off"} />
        <InfoLine label="Full screen alert" value={props.gate.fullScreenIntent ? "Allowed" : "Needs permission"} />
        <InfoLine label="Battery unrestricted" value={props.gate.batteryUnrestricted ? "Allowed" : "Needs permission"} />
        <Text style={styles.tokenText}>{props.pushToken ? `Token ready: ${props.pushToken.slice(0, 16)}...` : "Token not ready yet"}</Text>
        {!props.gate.fullScreenIntent ? (
          <PrimaryButton label="Allow full screen alerts" onPress={props.gate.openFullScreenIntentSettings} />
        ) : null}
        {!props.gate.batteryUnrestricted ? (
          <SecondaryButton label="Allow unrestricted battery" onPress={props.gate.requestBatteryExemption} />
        ) : null}
      </Card>
      <Card>
        <Text style={styles.cardTitle}>App</Text>
        <SecondaryButton label="Refresh data" onPress={props.onRefresh} />
        <DangerButton label="Sign out" onPress={props.onLogout} />
      </Card>
    </ScrollView>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiTitle}>{title}</Text>
    </View>
  );
}

function BookingRow({ booking, onPress }: { booking: BookingSummary; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.bookingRow}>
      <View style={styles.bookingRowTop}>
        <Text style={styles.bookingRef}>{booking.reference}</Text>
        <StatusBadge status={booking.status} />
      </View>
      <Text style={styles.bookingCustomer}>{booking.customer.name ?? "Customer"}</Text>
      <Text style={styles.bookingRoute} numberOfLines={2}>
        {booking.pickupAddress} to {booking.dropoffAddress}
      </Text>
      <View style={styles.bookingFooter}>
        <Text style={styles.bookingDate}>{shortDate(booking.scheduledDate)} - {booking.scheduledTime}</Text>
        <Text style={styles.bookingPrice}>{gbp(booking.quotedPrice)}</Text>
      </View>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const tone = statusTone(status);
  return (
    <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.statusText, { color: tone.color }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function LoginField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon: string;
  disabled?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.loginFieldWrap}>
      <Text style={styles.loginFieldLabel}>{props.label}</Text>
      <View style={[styles.loginInputShell, props.disabled ? styles.loginInputShellDisabled : null]}>
        <View style={styles.loginInputIcon}>
          <Text style={styles.loginInputIconText}>{props.icon}</Text>
        </View>
        <TextInput
          value={props.value}
          onChangeText={props.onChange}
          editable={!props.disabled}
          secureTextEntry={props.secureTextEntry}
          keyboardType={props.keyboardType}
          autoCapitalize={props.autoCapitalize}
          autoCorrect={false}
          placeholder={props.placeholder}
          placeholderTextColor="#98A2B3"
          style={styles.loginInput}
        />
      </View>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  editable?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        editable={props.editable ?? true}
        secureTextEntry={props.secureTextEntry}
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize}
        style={styles.input}
        placeholderTextColor="#98A2B3"
      />
    </View>
  );
}

function OptionField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionInput}>
        <Text style={styles.optionValue}>{value}</Text>
        <Text style={styles.optionChevron}>v</Text>
      </View>
    </Pressable>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={styles.toggleWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.switchTrack, value ? styles.switchTrackOn : null]}>
        <View style={[styles.switchThumb, value ? styles.switchThumbOn : null]} />
      </View>
      <Text style={styles.toggleValue}>{value ? "Yes" : "No"}</Text>
    </Pressable>
  );
}

function NumberStepper(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  compact?: boolean;
  onChange: (value: number) => void;
}) {
  const set = (next: number) => props.onChange(Math.max(props.min, Math.min(props.max, next)));
  return (
    <View style={[styles.stepperWrap, props.compact ? styles.stepperCompact : null]}>
      {props.label ? <Text style={styles.label}>{props.label}</Text> : null}
      <View style={styles.stepper}>
        <Pressable onPress={() => set(props.value - 1)} style={styles.stepperButton}>
          <Text style={styles.stepperButtonText}>-</Text>
        </Pressable>
        <TextInput
          value={String(props.value)}
          keyboardType="numeric"
          onChangeText={(raw) => set(Number.parseInt(raw || "0", 10) || 0)}
          style={styles.stepperInput}
        />
        <Pressable onPress={() => set(props.value + 1)} style={styles.stepperButton}>
          <Text style={styles.stepperButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function PrimaryButton(props: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={props.disabled ? undefined : props.onPress}
      style={[styles.primaryButton, props.disabled ? styles.buttonDisabled : null]}
    >
      <Text style={styles.primaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

function SecondaryButton(props: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress} style={styles.secondaryButton}>
      <Text style={styles.secondaryButtonText}>{props.label}</Text>
    </Pressable>
  );
}

function DangerButton(props: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress} style={styles.dangerButton}>
      <Text style={styles.dangerButtonText}>{props.label}</Text>
    </Pressable>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <View style={styles.emptyBlock}>
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
}

function LoadingBlock() {
  return (
    <View style={styles.emptyBlock}>
      <ActivityIndicator color={palette.blue} />
    </View>
  );
}

function Tabs({ active, onChange }: { active: ScreenKey; onChange: (screen: ScreenKey) => void }) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom + 14, Platform.OS === "android" ? 34 : 22);
  const tabs: Array<{ key: ScreenKey; label: string }> = [
    { key: "home", label: "Home" },
    { key: "bookings", label: "Bookings" },
    { key: "settings", label: "Settings" },
  ];
  return (
    <View style={[styles.tabs, { paddingBottom: bottomPadding }]}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={[styles.tab, active === tab.key ? styles.tabActive : null]}
        >
          <Text style={[styles.tabText, active === tab.key ? styles.tabTextActive : null]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SelectorModal({ selector, onClose }: { selector: SelectorState; onClose: () => void }) {
  return (
    <Modal transparent visible={Boolean(selector)} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalShade} onPress={onClose}>
        <Pressable style={styles.selectorCard}>
          <Text style={styles.selectorTitle}>{selector?.title}</Text>
          <ScrollView>
            {selector?.options.map((option) => (
              <Pressable
                key={option.value}
                style={styles.selectorOption}
                onPress={() => {
                  selector.onSelect(option.value);
                  onClose();
                }}
              >
                <Text style={styles.selectorOptionText}>{option.label}</Text>
                {option.helper ? <Text style={styles.selectorHelper}>{option.helper}</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NewBookingModal(props: {
  booking: BookingSummary | null;
  onDismiss: () => void;
  onOpen: (id: string) => void;
}) {
  const scale = useRef(new Animated.Value(0.96)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!props.booking) return;
    Vibration.vibrate([0, 450, 200, 650]);
    const audio = playBrowserNewBookingSound();
    scale.setValue(0.96);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    return () => {
      try {
        audio?.pause();
        if (audio) audio.currentTime = 0;
      } catch {
        /* noop */
      }
      Vibration.cancel();
    };
  }, [opacity, props.booking?.id, scale]);

  return (
    <Modal transparent visible={Boolean(props.booking)} animationType="none" onRequestClose={props.onDismiss}>
      <View style={styles.modalShade}>
        <Animated.View style={[styles.newBookingCard, { opacity, transform: [{ scale }] }]}>
          <View style={styles.popupTop}>
            <View style={styles.priceBubble}>
              <Text style={styles.priceBubbleText}>{gbp(props.booking?.quotedPrice)}</Text>
            </View>
            <Text style={styles.popupTitle}>New booking</Text>
          </View>
          <Text style={styles.popupCustomer}>{props.booking?.customer.name ?? "Customer"}</Text>
          <Text style={styles.popupRoute} numberOfLines={3}>
            {props.booking?.pickupAddress} to {props.booking?.dropoffAddress}
          </Text>
          <View style={styles.popupActions}>
            <Pressable onPress={props.onDismiss} style={styles.popupDismissButton}>
              <Text style={styles.popupDismissText}>Dismiss</Text>
            </Pressable>
            <Pressable
              onPress={() => props.booking && props.onOpen(props.booking.id)}
              style={styles.popupOpenButton}
            >
              <Text style={styles.popupOpenText}>Open booking</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.white,
  },
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.white,
  },
  loadingText: {
    marginTop: 12,
    color: palette.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  loginRoot: {
    flex: 1,
    backgroundColor: "#F3F6FB",
  },
  loginScroll: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 18,
  },
  loginShell: {
    width: "100%",
    maxWidth: 920,
    alignSelf: "center",
    borderRadius: 28,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: "#D9E2F1",
    overflow: "hidden",
    boxShadow: "0px 18px 40px rgba(15, 23, 42, 0.12)",
    elevation: 6,
  },
  loginShellWide: {
    flexDirection: "row",
    minHeight: 540,
  },
  loginBrandPanel: {
    backgroundColor: "#071225",
    padding: 26,
  },
  loginBrandPanelWide: {
    width: "42%",
    justifyContent: "space-between",
  },
  loginLogoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  loginLogoFrame: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 22,
    overflow: "visible",
    boxShadow: "0px 0px 30px rgba(56, 189, 248, 0.92), 0px 0px 58px rgba(37, 99, 235, 0.58)",
    elevation: 14,
  },
  loginLogoOrbitHalo: {
    position: "absolute",
    left: -14,
    top: -14,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(14, 165, 233, 0.34)",
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.78)",
  },
  loginLogoOrbitOuterRing: {
    position: "absolute",
    left: -10,
    top: -10,
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: "rgba(56, 189, 248, 0.42)",
    borderTopColor: "#7DD3FC",
    borderRightColor: "rgba(37, 99, 235, 1)",
    borderBottomColor: "rgba(56, 189, 248, 0.96)",
  },
  loginLogoOrbitInnerRing: {
    position: "absolute",
    left: -2,
    top: -2,
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.68)",
    borderBottomColor: "rgba(56, 189, 248, 1)",
    borderLeftColor: "rgba(29, 78, 216, 1)",
    borderTopColor: "rgba(96, 165, 250, 0.82)",
  },
  loginLogoOrbitDotPrimary: {
    position: "absolute",
    top: -6,
    right: 21,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#7DD3FC",
    borderWidth: 2,
    borderColor: "#071225",
  },
  loginLogoOrbitDotSecondary: {
    position: "absolute",
    bottom: 2,
    left: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563EB",
  },
  loginLogo: {
    width: 58,
    height: 58,
    zIndex: 1,
  },
  loginBrandCopy: {
    flexShrink: 1,
  },
  loginBrandName: {
    color: palette.white,
    fontSize: 23,
    fontWeight: "900",
  },
  loginBrandTag: {
    color: "#60A5FA",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 3,
  },
  loginHeroTitleWrap: {
    alignSelf: "flex-start",
    marginTop: 44,
  },
  loginHeroTitle: {
    color: palette.white,
    fontSize: 38,
    fontWeight: "900",
    lineHeight: 44,
    maxWidth: 360,
    textShadowColor: "rgba(56, 189, 248, 0.52)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  loginHeroUnderline: {
    width: 156,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#38BDF8",
    marginTop: 7,
    boxShadow: "0px 0px 14px rgba(56, 189, 248, 0.88)",
  },
  loginHeroText: {
    color: "#C7D2FE",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 25,
    marginTop: 14,
    maxWidth: 390,
  },
  loginStatusPanel: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 20,
    padding: 16,
    marginTop: 32,
  },
  loginStatusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  loginStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    marginRight: 10,
  },
  loginStatusText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: "900",
  },
  loginStatusDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
    marginVertical: 13,
  },
  loginStatusMeta: {
    color: "#BFDBFE",
    fontSize: 14,
    fontWeight: "800",
  },
  loginCard: {
    flex: 1,
    backgroundColor: palette.card,
    padding: 28,
    justifyContent: "center",
  },
  loginFormHeader: {
    marginBottom: 28,
  },
  loginKicker: {
    color: palette.blue,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  loginTitle: {
    color: palette.ink,
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 42,
  },
  loginSubtitle: {
    color: palette.muted,
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
    lineHeight: 23,
  },
  loginFieldWrap: {
    marginBottom: 16,
  },
  loginFieldLabel: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 8,
  },
  loginInputShell: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D0D8E8",
    backgroundColor: "#F8FAFC",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  loginInputShellDisabled: {
    opacity: 0.72,
  },
  loginInputIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: palette.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  loginInputIconText: {
    color: palette.blue,
    fontSize: 16,
    fontWeight: "900",
  },
  loginInput: {
    flex: 1,
    color: palette.ink,
    fontSize: 17,
    fontWeight: "800",
    minHeight: 54,
  },
  loginErrorBox: {
    backgroundColor: palette.redSoft,
    borderWidth: 1,
    borderColor: "#FECDD3",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    color: palette.red,
    fontWeight: "900",
  },
  loginFootnote: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 16,
  },
  header: {
    backgroundColor: palette.white,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 2,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.green,
    marginRight: 6,
  },
  liveText: {
    color: palette.green,
    fontWeight: "800",
  },
  content: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  homeHero: {
    paddingVertical: 8,
    marginBottom: 10,
  },
  homeTitle: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: "900",
  },
  homeSub: {
    color: palette.muted,
    fontSize: 15,
    marginTop: 2,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },
  kpiCard: {
    width: "50%",
    padding: 5,
  },
  kpiValue: {
    backgroundColor: palette.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 18,
    paddingHorizontal: 16,
    color: palette.ink,
    fontSize: 23,
    fontWeight: "900",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: palette.border,
  },
  kpiTitle: {
    backgroundColor: palette.card,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    color: palette.muted,
    fontSize: 13,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: palette.border,
  },
  sectionHeader: {
    marginTop: 22,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
  },
  linkButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkButtonText: {
    color: palette.blue,
    fontWeight: "900",
  },
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 68,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  filterChip: {
    minHeight: 42,
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: palette.border,
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: {
    backgroundColor: palette.blue,
    borderColor: palette.blue,
  },
  filterChipText: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 18,
  },
  filterChipTextActive: {
    color: palette.white,
  },
  filterChipCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  filterChipCountActive: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  filterChipCountText: {
    color: palette.blue,
    fontSize: 12,
    fontWeight: "900",
  },
  filterChipCountTextActive: {
    color: palette.white,
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 110,
  },
  bookingRow: {
    backgroundColor: palette.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 12,
  },
  bookingRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bookingRef: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  bookingCustomer: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 10,
  },
  bookingRoute: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  bookingFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  bookingDate: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  bookingPrice: {
    color: palette.blue,
    fontSize: 18,
    fontWeight: "900",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "900",
  },
  detailHeader: {
    backgroundColor: palette.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: palette.surface,
  },
  backButtonText: {
    color: palette.ink,
    fontWeight: "900",
  },
  detailTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  detailRef: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  detailPrice: {
    color: palette.blue,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  editorContent: {
    padding: 16,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: 14,
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  miniMeta: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  driverListRow: {
    minHeight: 58,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  driverAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: palette.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  driverAvatarText: {
    color: palette.blue,
    fontSize: 15,
    fontWeight: "900",
  },
  driverListCopy: {
    flex: 1,
    minWidth: 0,
  },
  driverListName: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  driverListEmail: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  driverStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginLeft: 8,
  },
  driverStatusActive: {
    backgroundColor: palette.greenSoft,
  },
  driverStatusInactive: {
    backgroundColor: palette.surface,
  },
  driverStatusText: {
    fontSize: 11,
    fontWeight: "900",
  },
  driverStatusTextActive: {
    color: palette.green,
  },
  driverStatusTextInactive: {
    color: palette.muted,
  },
  fieldWrap: {
    marginBottom: 12,
  },
  label: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    color: palette.ink,
    backgroundColor: palette.white,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: "700",
  },
  noteInput: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  customerNotePreview: {
    color: palette.blue,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
    marginTop: 4,
  },
  optionInput: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.white,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionValue: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  optionChevron: {
    color: palette.muted,
    fontSize: 18,
    fontWeight: "900",
  },
  twoCol: {
    flexDirection: "row",
    marginHorizontal: -5,
  },
  toggleWrap: {
    flex: 1,
    marginHorizontal: 5,
    marginBottom: 12,
  },
  toggleValue: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 6,
  },
  switchTrack: {
    width: 54,
    height: 32,
    borderRadius: 999,
    backgroundColor: "#D0D5DD",
    padding: 3,
  },
  switchTrackOn: {
    backgroundColor: palette.blue,
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.white,
  },
  switchThumbOn: {
    transform: [{ translateX: 22 }],
  },
  stepperWrap: {
    flex: 1,
    marginHorizontal: 5,
    marginBottom: 12,
  },
  stepperCompact: {
    flex: 0,
    marginHorizontal: 0,
    marginBottom: 0,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: "hidden",
    backgroundColor: palette.white,
  },
  stepperButton: {
    width: 42,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.blueSoft,
  },
  stepperButtonText: {
    color: palette.blue,
    fontSize: 24,
    fontWeight: "900",
  },
  stepperInput: {
    width: 46,
    height: 46,
    color: palette.ink,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "900",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingVertical: 12,
  },
  itemTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  itemName: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  itemMeta: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 2,
  },
  summaryText: {
    color: palette.blue,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8,
  },
  infoLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  infoLabel: {
    color: palette.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  infoValue: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "900",
    maxWidth: "58%",
    textAlign: "right",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: palette.blue,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  primaryButtonText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 8,
    flex: 1,
  },
  secondaryButtonText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  dangerButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: palette.redSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 8,
    flex: 1,
  },
  dangerButtonText: {
    color: palette.red,
    fontSize: 15,
    fontWeight: "900",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  actionRow: {
    flexDirection: "row",
    marginHorizontal: -5,
    marginTop: 8,
  },
  emptyBlock: {
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  emptyText: {
    color: palette.muted,
    fontSize: 15,
    fontWeight: "700",
  },
  tokenText: {
    color: palette.muted,
    fontSize: 13,
    marginBottom: 10,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: palette.white,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingHorizontal: 10,
    paddingTop: 10,
    shadowColor: "#101828",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 14,
  },
  tabActive: {
    backgroundColor: palette.blue,
  },
  tabText: {
    color: palette.muted,
    fontWeight: "900",
  },
  tabTextActive: {
    color: palette.white,
  },
  modalShade: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  selectorCard: {
    width: "100%",
    maxHeight: "76%",
    backgroundColor: palette.white,
    borderRadius: 20,
    padding: 16,
  },
  selectorTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12,
  },
  selectorOption: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  selectorOptionText: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "900",
  },
  selectorHelper: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 3,
  },
  newBookingCard: {
    width: "100%",
    maxWidth: 580,
    alignSelf: "center",
    backgroundColor: palette.white,
    borderRadius: 24,
    padding: 22,
  },
  popupTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  priceBubble: {
    backgroundColor: palette.blue,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginRight: 12,
  },
  priceBubbleText: {
    color: palette.white,
    fontSize: 18,
    fontWeight: "900",
  },
  popupTitle: {
    color: palette.ink,
    fontSize: 24,
    fontWeight: "900",
  },
  popupCustomer: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  popupRoute: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  popupActions: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
  },
  popupDismissButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  popupDismissText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  popupOpenButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: palette.blue,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  popupOpenText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: "900",
  },
});
