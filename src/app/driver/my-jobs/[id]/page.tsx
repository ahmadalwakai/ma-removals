"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FiArrowLeft, FiMapPin, FiCalendar, FiClock, FiTruck } from "react-icons/fi";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { LocationSharingButton } from "@/components/driver/LocationSharingButton";
import { colors } from "@/lib/tokens";

interface BookingDetail {
  id: string;
  reference: string;
  serviceName: string;
  serviceVariant?: string;
  scheduledDate: string;
  scheduledTime: string;
  pickupAddress: string;
  dropoffAddress: string;
  distanceMiles: number;
  quotedPrice: number;
  helpersCount: number;
  needsPacking: boolean;
  needsAssembly: boolean;
  notes: string | null;
  status: string;
  customer: { name: string | null; phone: string | null } | null;
  conversationId?: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  CONFIRMED: colors.emerald,
  IN_PROGRESS: "#2563EB",
  COMPLETED: "#64748B",
  CANCELLED: colors.crimson,
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        fontSize: 13,
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.5)" }}>{label}</span>
      <span style={{ color: "white", fontWeight: 600, textAlign: "right", maxWidth: "55%" }}>{value}</span>
    </div>
  );
}

export default function DriverJobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/driver/my-jobs")
      .then((r) => r.json())
      .then((d: { upcoming?: BookingDetail[]; inProgress?: BookingDetail[]; completed?: BookingDetail[] }) => {
        const all = [
          ...(d.upcoming ?? []),
          ...(d.inProgress ?? []),
          ...(d.completed ?? []),
        ];
        const found = all.find((b: BookingDetail) => b.id === id);
        if (found) setBooking(found);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
        Loading...
      </div>
    );
  }

  if (!booking) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Job not found.</p>
        <button
          onClick={() => router.push("/driver/my-jobs")}
          style={{
            marginTop: 12,
            background: colors.emerald,
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Back to My Jobs
        </button>
      </div>
    );
  }

  const statusColor = STATUS_COLOR[booking.status] ?? "white";
  const schedDate = new Date(booking.scheduledDate).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Back header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px",
          background: "#1E293B",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <button
          onClick={() => router.push("/driver/my-jobs")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "rgba(255,255,255,0.7)",
            padding: 4,
            display: "flex",
          }}
        >
          <FiArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 800,
              color: "white",
              fontFamily: "var(--font-mono)",
            }}
          >
            {booking.reference}
          </p>
          <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
            {booking.serviceName}
          </p>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: statusColor,
            background: `${statusColor}20`,
            borderRadius: 6,
            padding: "3px 8px",
          }}
        >
          {booking.status.replace("_", " ")}
        </span>
      </div>

      <div style={{ padding: "16px" }}>
        {/* Addresses */}
        <div
          style={{
            background: "#1E293B",
            borderRadius: 12,
            padding: "16px",
            marginBottom: 16,
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "rgba(16,185,129,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <FiMapPin size={14} color={colors.emerald} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>
                PICKUP
              </p>
              <p style={{ margin: 0, fontSize: 14, color: "white", fontWeight: 600 }}>
                {booking.pickupAddress}
              </p>
            </div>
          </div>
          <div
            style={{
              height: 20,
              width: 1,
              background: "rgba(255,255,255,0.1)",
              margin: "0 0 14px 14px",
            }}
          />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "rgba(37,99,235,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <FiMapPin size={14} color="#2563EB" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>
                DROP-OFF
              </p>
              <p style={{ margin: 0, fontSize: 14, color: "white", fontWeight: 600 }}>
                {booking.dropoffAddress}
              </p>
            </div>
          </div>
        </div>

        {/* Quick details */}
        <div
          style={{
            background: "#1E293B",
            borderRadius: 12,
            padding: "16px",
            marginBottom: 16,
            border: "1px solid rgba(255,255,255,0.07)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {[
            { icon: <FiCalendar size={14} />, label: "Date", value: schedDate },
            { icon: <FiClock size={14} />, label: "Time", value: booking.scheduledTime },
            { icon: <FiTruck size={14} />, label: "Distance", value: `${booking.distanceMiles.toFixed(1)} mi` },
            { icon: null, label: "Helpers", value: booking.helpersCount > 0 ? `${booking.helpersCount}` : "None" },
          ].map((item) => (
            <div key={item.label}>
              <p style={{ margin: "0 0 2px", fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {item.label}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "white", fontWeight: 600 }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* Location Sharing */}
        <LocationSharingButton bookingId={booking.id} isActive={booking.status === "IN_PROGRESS"} />

        {/* Details table */}
        <div
          style={{
            background: "#1E293B",
            borderRadius: 12,
            padding: "16px",
            marginBottom: 16,
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
            Job Details
          </p>
          <Row label="Service" value={booking.serviceName + (booking.serviceVariant ? ` (${booking.serviceVariant})` : "")} />
          <Row label="Packing" value={booking.needsPacking ? "Yes" : "No"} />
          <Row label="Assembly" value={booking.needsAssembly ? "Yes" : "No"} />
          <Row label="Quote" value={`£${booking.quotedPrice.toFixed(2)}`} />
          {booking.customer?.phone && (
            <Row
              label="Customer Phone"
              value={
                <a href={`tel:${booking.customer.phone}`} style={{ color: colors.emerald }}>
                  {booking.customer.phone}
                </a>
              }
            />
          )}
          {booking.notes && <Row label="Notes" value={booking.notes} />}
        </div>

        {/* Chat */}
        {booking.conversationId && session?.user?.id && (
          <div
            style={{
              background: "#1E293B",
              borderRadius: 12,
              padding: "16px",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <p style={{ margin: "0 0 12px", fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
              Messages
            </p>
            <ChatWindow
              conversationId={booking.conversationId}
              currentUserId={session.user.id}
              currentUserRole="DRIVER"
              height="350px"
            />
          </div>
        )}
      </div>
    </div>
  );
}
