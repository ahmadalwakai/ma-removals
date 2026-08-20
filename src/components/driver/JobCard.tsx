"use client";

import { colors } from "@/lib/tokens";

export const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  CONFIRMED:   { bg: "rgba(37,99,235,0.15)",  text: "#2563EB", label: "Confirmed" },
  IN_PROGRESS: { bg: "rgba(37,99,235,0.15)",  text: "#2563EB", label: "In Progress" },
  COMPLETED:   { bg: "rgba(16,185,129,0.15)",  text: colors.emerald, label: "Completed" },
  CANCELLED:   { bg: "rgba(239,68,68,0.12)",   text: "#FCA5A5", label: "Cancelled" },
  PENDING:     { bg: "rgba(148,163,184,0.15)", text: "#94A3B8", label: "Pending" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? STATUS_COLORS.PENDING!;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "3px 10px",
      borderRadius: 999,
      background: s.bg,
      color: s.text,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      flexShrink: 0,
    }}>
      {s.label}
    </span>
  );
}

export function JobCard({
  booking,
  children,
}: {
  booking: {
    reference: string;
    serviceName: string;
    scheduledDate: string;
    scheduledTime: string;
    pickupAddress: string;
    dropoffAddress: string;
    distanceMiles: number;
    quotedPrice: number;
    helpersCount: number;
    notes?: string | null;
    status: string;
  };
  children?: React.ReactNode;
}) {
  const date = new Date(booking.scheduledDate);
  const dateStr = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div style={{
      background: "#1E293B",
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.07)",
      overflow: "hidden",
    }}>
      {/* Header row */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>
            {booking.reference}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "white" }}>{booking.serviceName}</div>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {/* Date + time */}
      <div style={{
        display: "flex",
        gap: 16,
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
      }}>
        <Detail icon="📅" label="Date" value={dateStr} />
        <Detail icon="🕐" label="Time" value={booking.scheduledTime} />
        <Detail icon="📏" label="Distance" value={`${booking.distanceMiles.toFixed(1)} mi`} />
      </div>

      {/* Addresses */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <AddressRow icon="🟢" label="Pickup" address={booking.pickupAddress} />
        <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.1)", marginLeft: 7, marginBottom: 2 }} />
        <AddressRow icon="🔴" label="Drop-off" address={booking.dropoffAddress} />
      </div>

      {/* Price + helpers */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        borderBottom: children ? "1px solid rgba(255,255,255,0.06)" : "none",
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: colors.emerald }}>
          £{booking.quotedPrice.toFixed(2)}
        </span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
          {booking.helpersCount > 0 ? `+${booking.helpersCount} helper${booking.helpersCount > 1 ? "s" : ""}` : "Solo job"}
        </span>
      </div>

      {booking.notes && (
        <div style={{
          padding: "10px 16px",
          fontSize: 12,
          color: "rgba(255,255,255,0.5)",
          background: "rgba(37,99,235,0.05)",
          borderBottom: children ? "1px solid rgba(255,255,255,0.06)" : "none",
        }}>
          📝 {booking.notes}
        </div>
      )}

      {children && (
        <div style={{ padding: "12px 16px" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function Detail({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>{icon} {value}</div>
    </div>
  );
}

function AddressRow({ icon, label, address }: { icon: string; label: string; address: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 2 }}>
      <span style={{ fontSize: 10, marginTop: 2, flexShrink: 0 }}>{icon}</span>
      <div>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginRight: 4 }}>{label}</span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>{address}</span>
      </div>
    </div>
  );
}
