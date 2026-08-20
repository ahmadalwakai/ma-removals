"use client";

import { useState, useEffect, useCallback } from "react";

interface StatusHistoryItem {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  changedByRole: string | null;
  note: string | null;
  timestamp: string;
}

interface TrackingEventItem {
  id: string;
  type: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  timestamp: string;
}

interface StatusData {
  currentStatus: string;
  history: StatusHistoryItem[];
  events: TrackingEventItem[];
}

const ALL_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "REFUNDED",
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#94A3B8",
  CONFIRMED: "#2563EB",
  IN_PROGRESS: "#2563EB",
  COMPLETED: "#2563EB",
  CANCELLED: "#EF4444",
  REFUNDED: "#8B5CF6",
};

function fmtTs(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminStatusControls({
  bookingId,
  currentStatus: initialStatus,
}: {
  bookingId: string;
  currentStatus: string;
}) {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [note, setNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventPublic, setEventPublic] = useState(true);
  const [addingEvent, setAddingEvent] = useState(false);
  const [eventMsg, setEventMsg] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/status`);
      if (res.ok) {
        const d = (await res.json()) as StatusData;
        setData(d);
        setSelectedStatus(d.currentStatus);
      }
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusUpdate = async () => {
    if (selectedStatus === data?.currentStatus && !note) return;
    setUpdating(true);
    setUpdateMsg("");
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedStatus, note: note || undefined }),
      });
      if (res.ok) {
        setUpdateMsg("Status updated successfully.");
        setNote("");
        setTimeout(() => window.location.reload(), 800);
      } else {
        const err = (await res.json()) as { error?: string };
        setUpdateMsg(err.error ?? "Update failed.");
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleAddEvent = async () => {
    if (!eventTitle.trim()) return;
    setAddingEvent(true);
    setEventMsg("");
    try {
      const res = await fetch(`/api/booking/${bookingId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: eventTitle,
          description: eventDesc || undefined,
          isPublic: eventPublic,
        }),
      });
      if (res.ok) {
        setEventMsg("Event added.");
        setEventTitle("");
        setEventDesc("");
        fetchData();
      } else {
        setEventMsg("Failed to add event.");
      }
    } finally {
      setAddingEvent(false);
    }
  };

  const s: Record<string, React.CSSProperties> = {
    card: {
      background: "#1E293B",
      borderRadius: 12,
      padding: "20px 24px",
      marginBottom: 20,
      border: "1px solid rgba(255,255,255,0.07)",
    },
    label: {
      fontSize: 11,
      fontWeight: 700,
      color: "#64748B",
      textTransform: "uppercase" as const,
      letterSpacing: "0.06em",
      marginBottom: 8,
      display: "block",
    },
    input: {
      background: "#0F172A",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 8,
      padding: "9px 12px",
      fontSize: 13,
      color: "white",
      width: "100%",
      boxSizing: "border-box" as const,
    },
    select: {
      background: "#0F172A",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 8,
      padding: "9px 12px",
      fontSize: 13,
      color: "white",
      width: "100%",
    },
    btn: {
      padding: "9px 20px",
      borderRadius: 8,
      fontWeight: 700,
      fontSize: 13,
      border: "none",
      cursor: "pointer",
      background: "#2563EB",
      color: "white",
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: 700,
      color: "rgba(255,255,255,0.9)",
      margin: "0 0 16px",
    },
  };

  if (loading) {
    return <div style={{ padding: 16, color: "#64748B", fontSize: 13 }}>Loading status controls…</div>;
  }

  return (
    <div>
      {/* Status Update */}
      <div style={s.card}>
        <p style={s.sectionTitle}>Update Status</p>
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={s.label}>Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={s.select}
            >
              {ALL_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 2 }}>
            <label style={s.label}>Note (optional)</label>
            <input
              type="text"
              placeholder="Internal note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={s.input}
            />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={handleStatusUpdate}
            disabled={updating}
            style={{
              ...s.btn,
              opacity: updating ? 0.6 : 1,
            }}
          >
            {updating ? "Updating…" : "Update Status"}
          </button>
          {updateMsg && (
                <span
              style={{
                fontSize: 13,
                color: updateMsg.includes("success") ? "#2563EB" : "#EF4444",
              }}
            >
              {updateMsg}
            </span>
          )}
        </div>
      </div>

      {/* Status History */}
      {data && data.history.length > 0 && (
        <div style={s.card}>
          <p style={s.sectionTitle}>Status History</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.history
              .slice()
              .reverse()
              .map((item) => {
                const toColor = STATUS_COLORS[item.toStatus] ?? "#64748B";
                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      padding: "8px 12px",
                      background: "#0F172A",
                      borderRadius: 8,
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        {item.fromStatus && (
                          <>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: STATUS_COLORS[item.fromStatus] ?? "#64748B",
                                background: `${STATUS_COLORS[item.fromStatus] ?? "#64748B"}20`,
                                padding: "2px 7px",
                                borderRadius: 4,
                              }}
                            >
                              {item.fromStatus}
                            </span>
                            <span style={{ color: "#64748B", fontSize: 12 }}>→</span>
                          </>
                        )}
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: toColor,
                            background: `${toColor}20`,
                            padding: "2px 7px",
                            borderRadius: 4,
                          }}
                        >
                          {item.toStatus}
                        </span>
                        {item.changedByRole && (
                          <span style={{ fontSize: 11, color: "#475569" }}>
                            by {item.changedByRole}
                          </span>
                        )}
                      </div>
                      {item.note && (
                        <p style={{ margin: 0, fontSize: 12, color: "#94A3B8", fontStyle: "italic" }}>
                          {item.note}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: "#475569", flexShrink: 0, marginTop: 2 }}>
                      {fmtTs(item.timestamp)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Tracking Events */}
      <div style={s.card}>
        <p style={s.sectionTitle}>Tracking Events</p>

        {/* Add Event Form */}
        <div
          style={{
            background: "#0F172A",
            borderRadius: 10,
            padding: "14px 16px",
            marginBottom: 16,
          }}
        >
          <p style={{ ...s.label, marginBottom: 10 }}>Add Manual Event</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input
              type="text"
              placeholder="Event title (required)"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              style={s.input}
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={eventDesc}
              onChange={(e) => setEventDesc(e.target.value)}
              style={s.input}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#94A3B8", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={eventPublic}
                  onChange={(e) => setEventPublic(e.target.checked)}
                />
                Visible to customer
              </label>
              <button
                onClick={handleAddEvent}
                disabled={addingEvent || !eventTitle.trim()}
                style={{
                  ...s.btn,
                  background: "#2563EB",
                  opacity: addingEvent || !eventTitle.trim() ? 0.5 : 1,
                }}
              >
                {addingEvent ? "Adding…" : "Add Event"}
              </button>
            </div>
            {eventMsg && (
              <p style={{ margin: 0, fontSize: 12, color: "#2563EB" }}>{eventMsg}</p>
            )}
          </div>
        </div>

        {/* Events list */}
        {data && data.events.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.events
              .slice()
              .reverse()
              .map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    padding: "8px 12px",
                    background: "#0F172A",
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                      {ev.title}
                    </p>
                    {ev.description && (
                      <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>{ev.description}</p>
                    )}
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        color: ev.isPublic ? "#2563EB" : "#64748B",
                        background: ev.isPublic ? "rgba(37,99,235,0.1)" : "rgba(100,116,139,0.1)",
                        padding: "1px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {ev.isPublic ? "Public" : "Internal"}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: "#475569", flexShrink: 0, marginTop: 2 }}>
                    {fmtTs(ev.timestamp)}
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>No tracking events yet.</p>
        )}
      </div>
    </div>
  );
}
