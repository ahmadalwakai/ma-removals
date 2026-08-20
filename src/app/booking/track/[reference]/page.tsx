"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getPusherClient } from "@/lib/pusher-client";
import { shadows } from "@/lib/tokens";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrackingEvent {
  id: string;
  type: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  timestamp: string;
}

interface BookingData {
  id: string;
  reference: string;
  status: string;
  paymentStatus: string;
  serviceName: string;
  serviceVariant: string | null;
  scheduledDate: string;
  scheduledTime: string;
  pickupAddress: string;
  dropoffAddress: string;
  distanceMiles: number;
  helpersCount: number;
  needsPacking: boolean;
  needsAssembly: boolean;
  totalPaid: number;
  driverName: string | null;
  hasReview: boolean;
  conversationId: string | null;
  customerName: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STEPS = [
  { key: "CONFIRMED", label: "Confirmed", icon: "✓" },
  { key: "IN_PROGRESS", label: "In Progress", icon: "🚚" },
  { key: "COMPLETED", label: "Complete", icon: "🎉" },
];

const EVENT_ICONS: Record<string, string> = {
  status_change: "🔄",
  driver_assigned: "👤",
  driver_location: "📍",
  driver_en_route: "🚚",
  arrived_pickup: "📍",
  loading: "📦",
  in_transit: "🚛",
  arrived_dropoff: "🏠",
  unloading: "📤",
  completed: "✅",
  note_added: "📝",
  payment_received: "💳",
  eta_update: "⏱️",
};

function statusColor(status: string): string {
  const map: Record<string, string> = {
    CONFIRMED: "#2563EB",
    IN_PROGRESS: "#2563EB",
    COMPLETED: "#2563EB",
    CANCELLED: "#EF4444",
    REFUNDED: "#8B5CF6",
    PENDING: "#94A3B8",
  };
  return map[status] ?? "#64748B";
}

function fmtTs(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Main Content ─────────────────────────────────────────────────────────────

function TrackingContent() {
  const params = useParams<{ reference: string }>();
  const searchParams = useSearchParams();
  const reference = decodeURIComponent(params?.reference ?? "");
  const email = searchParams?.get("email") ?? "";

  const [booking, setBooking] = useState<BookingData | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [driverLoc, setDriverLoc] = useState<{
    lat: number;
    lng: number;
    eta?: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isLive, setIsLive] = useState(false);

  const fetchData = useCallback(async () => {
    if (!reference || !email) {
      setError("Missing booking reference or email.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/booking/track/${encodeURIComponent(reference)}?email=${encodeURIComponent(email)}`
      );
      if (res.status === 403) {
        setError("Email address doesn't match this booking.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("Booking not found. Please check your reference.");
        setLoading(false);
        return;
      }
      const data = (await res.json()) as {
        booking: BookingData;
        events: TrackingEvent[];
      };
      setBooking(data.booking);
      setEvents(data.events ?? []);
    } catch {
      setError("Unable to load booking data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [reference, email]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time Pusher subscription
  useEffect(() => {
    if (!booking?.id) return;
    const pusher = getPusherClient();
    if (!pusher) {
      const t = setInterval(fetchData, 15000);
      return () => clearInterval(t);
    }
    const channel = pusher.subscribe(`booking-${booking.id}`);
    setIsLive(true);
    channel.bind("tracking-event", (data: TrackingEvent) => {
      if (data.isPublic) {
        setEvents((prev) => {
          if (prev.find((e) => e.id === data.id)) return prev;
          return [...prev, data];
        });
      }
    });
    channel.bind("status-update", (data: { status: string }) => {
      setBooking((prev) => (prev ? { ...prev, status: data.status } : prev));
    });
    channel.bind(
      "driver-location",
      (data: { lat: number; lng: number; eta?: number | null }) => {
        setDriverLoc(data);
      }
    );
    return () => {
      pusher.unsubscribe(`booking-${booking.id}`);
      setIsLive(false);
    };
  }, [booking?.id, fetchData]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#64748B", fontSize: 15 }}>Loading your booking…</p>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div style={{ minHeight: "100vh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: "white", borderRadius: 16, padding: "40px 32px", maxWidth: 400, width: "100%", textAlign: "center", boxShadow: shadows.card }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>😕</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1E293B", margin: "0 0 8px" }}>Booking not found</h2>
          <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 24px" }}>{error || "Please check your reference and email address."}</p>
          <a href="/booking/track" style={{ display: "inline-block", padding: "11px 28px", background: "#2563EB", color: "white", borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
            Try Again
          </a>
        </div>
      </div>
    );
  }

  const sc = statusColor(booking.status);
  const isCancelled = booking.status === "CANCELLED" || booking.status === "REFUNDED";
  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === booking.status);
  const progressPct = currentStepIdx === 0 ? 0 : currentStepIdx === 1 ? 50 : 100;
  const schedDate = new Date(booking.scheduledDate).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ background: "#0B1120", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>MA Removals — Track Your Move</p>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "white", fontFamily: "var(--font-mono)", marginTop: 2 }}>{booking.reference}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isLive && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#2563EB", display: "flex", alignItems: "center", gap: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563EB", display: "inline-block" }} />
              Live
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 700, color: sc, background: `${sc}25`, padding: "4px 10px", borderRadius: 20 }}>
            {booking.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 580, margin: "0 auto", padding: "20px 16px" }}>
        {/* Progress Stepper */}
        {!isCancelled && (
          <div style={{ background: "white", borderRadius: 12, padding: "20px 24px", marginBottom: 16, border: "1px solid #E2E8F0", boxShadow: shadows.card }}>
            <div style={{ display: "flex", alignItems: "flex-start", position: "relative", paddingBottom: 4 }}>
              <div style={{ position: "absolute", top: 18, left: "15%", right: "15%", height: 3, background: "#E2E8F0", borderRadius: 4 }} />
              <div style={{ position: "absolute", top: 18, left: "15%", width: `${progressPct * 0.7}%`, height: 3, background: "#2563EB", borderRadius: 4, transition: "width 0.6s ease", boxShadow: shadows.emerald }} />
              {STATUS_STEPS.map((step, i) => {
                const done = i < currentStepIdx;
                const current = i === currentStepIdx;
                return (
                  <div key={step.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative", zIndex: 2 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: done || current ? "#2563EB" : "white", border: `2.5px solid ${done || current ? "#2563EB" : "#E2E8F0"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: done || current ? "white" : "#CBD5E1", boxShadow: done || current ? shadows.emerald : "none", transition: "all 0.3s" }}>
                      {done ? "✓" : step.icon}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: current ? 700 : 500, color: done || current ? "#2563EB" : "#94A3B8", textAlign: "center" }}>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isCancelled && (
          <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "16px 20px", marginBottom: 16, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#EF4444" }}>This booking has been {booking.status.toLowerCase()}.</p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748B" }}>For questions, contact us at <a href="mailto:info@maremovals.co.uk" style={{ color: "#2563EB" }}>info@maremovals.co.uk</a></p>
          </div>
        )}

        {/* Booking Summary */}
        <div style={{ background: "white", borderRadius: 12, padding: "20px 24px", marginBottom: 16, border: "1px solid #E2E8F0", boxShadow: shadows.card }}>
          <h2 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {booking.serviceName}{booking.serviceVariant ? ` · ${booking.serviceVariant}` : ""}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            {[
              { label: "Date", value: schedDate },
              { label: "Time", value: booking.scheduledTime },
              { label: "Driver", value: booking.driverName ?? "Being arranged" },
              { label: "Distance", value: `${booking.distanceMiles.toFixed(1)} mi` },
            ].map((item) => (
              <div key={item.label}>
                <p style={{ margin: "0 0 2px", fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>{item.label}</p>
                <p style={{ margin: 0, fontSize: 13, color: "#1E293B", fontWeight: 600 }}>{item.value}</p>
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(37,99,235,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, color: "#2563EB", fontWeight: 700 }}>A</div>
              <div>
                <p style={{ margin: "0 0 1px", fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>Pickup</p>
                <p style={{ margin: 0, fontSize: 13, color: "#334155" }}>{booking.pickupAddress}</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(37,99,235,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, color: "#2563EB", fontWeight: 700 }}>B</div>
              <div>
                <p style={{ margin: "0 0 1px", fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.04em" }}>Drop-off</p>
                <p style={{ margin: 0, fontSize: 13, color: "#334155" }}>{booking.dropoffAddress}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Driver Location */}
        {driverLoc && (
          <div style={{ background: "white", borderRadius: 12, padding: "16px 20px", marginBottom: 16, border: "1.5px solid #2563EB", boxShadow: "0 0 0 3px rgba(37,99,235,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#1E293B" }}>🚚 Driver Location</p>
              {driverLoc.eta ? (
                <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Estimated arrival in <strong style={{ color: "#2563EB" }}>~{driverLoc.eta} min</strong></p>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Location updated just now</p>
              )}
            </div>
            <a href={`https://www.google.com/maps?q=${driverLoc.lat},${driverLoc.lng}`} target="_blank" rel="noopener noreferrer" style={{ padding: "9px 16px", background: "#2563EB", color: "white", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none", flexShrink: 0 }}>
              Open Map
            </a>
          </div>
        )}

        {/* Event Timeline */}
        <div style={{ background: "white", borderRadius: 12, padding: "20px 24px", marginBottom: 16, border: "1px solid #E2E8F0", boxShadow: shadows.card }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 14, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Updates</h2>
          {events.length === 0 ? (
            <p style={{ color: "#94A3B8", fontSize: 14, textAlign: "center", padding: "24px 0" }}>No updates yet — we&apos;ll notify you as your move progresses.</p>
          ) : (
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: 17, top: 20, bottom: 20, width: 2, background: "#F1F5F9" }} />
              {[...events].reverse().map((event, i) => {
                const isLatest = i === 0;
                return (
                  <div key={event.id} style={{ display: "flex", gap: 14, paddingBottom: i < events.length - 1 ? 20 : 0, position: "relative" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: isLatest ? "#EFF9F5" : "#F8FAFC", border: `2px solid ${isLatest ? "#2563EB" : "#E2E8F0"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0, zIndex: 1, position: "relative" }}>
                      {EVENT_ICONS[event.type] ?? "•"}
                    </div>
                    <div style={{ flex: 1, paddingTop: 5 }}>
                      <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: isLatest ? 700 : 600, color: isLatest ? "#0F172A" : "#334155", lineHeight: 1.35 }}>{event.title}</p>
                      {event.description && <p style={{ margin: "0 0 3px", fontSize: 13, color: "#64748B", lineHeight: 1.4 }}>{event.description}</p>}
                      <p style={{ margin: 0, fontSize: 11, color: "#94A3B8" }}>{fmtTs(event.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <a href={`/api/booking/${booking.id}/invoice?email=${encodeURIComponent(email)}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "18px 12px", background: "white", border: "1.5px solid #E2E8F0", borderRadius: 12, textDecoration: "none" }}>
            <span style={{ fontSize: 26 }}>🧾</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>Invoice PDF</span>
          </a>
          {booking.status === "COMPLETED" && !booking.hasReview ? (
            <a href={`/booking/review/${booking.reference}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "18px 12px", background: "white", border: "1.5px solid #E2E8F0", borderRadius: 12, textDecoration: "none" }}>
              <span style={{ fontSize: 26 }}>⭐</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>Leave Review</span>
            </a>
          ) : (
            <a href="tel:07426467112" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "18px 12px", background: "white", border: "1.5px solid #E2E8F0", borderRadius: 12, textDecoration: "none" }}>
              <span style={{ fontSize: 26 }}>📞</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>Call Us</span>
            </a>
          )}
        </div>

        {/* Help bar */}
        <div style={{ background: "#F1F5F9", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>Questions about your move?</p>
          <div style={{ display: "flex", gap: 12 }}>
            <a href="tel:07426467112" style={{ fontSize: 13, fontWeight: 700, color: "#10B981", textDecoration: "none" }}>📞 07426 467 112</a>
            <a href="mailto:info@maremovals.co.uk" style={{ fontSize: 13, fontWeight: 700, color: "#10B981", textDecoration: "none" }}>✉ Email Us</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingTrackRefPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#F8FAFC" }} />}>
      <TrackingContent />
    </Suspense>
  );
}
