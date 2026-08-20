"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { JobCard, StatusBadge } from "@/components/driver/JobCard";
import { colors } from "@/lib/tokens";

interface BookingRow {
  id: string;
  reference: string;
  serviceName: string;
  scheduledDate: string;
  scheduledTime: string;
  pickupAddress: string;
  dropoffAddress: string;
  distanceMiles: number;
  quotedPrice: number;
  helpersCount: number;
  notes: string | null;
  status: string;
}

interface MyJobsData {
  upcoming: BookingRow[];
  inProgress: BookingRow[];
  completed: BookingRow[];
  cancelled: BookingRow[];
}

const TABS = [
  { key: "inProgress", label: "In Progress", emoji: "🔥" },
  { key: "upcoming",   label: "Upcoming",    emoji: "📅" },
  { key: "completed",  label: "Completed",   emoji: "✅" },
  { key: "cancelled",  label: "Cancelled",   emoji: "❌" },
] as const;

type TabKey = typeof TABS[number]["key"];

function StatusButton({
  bookingId,
  currentStatus,
  onSuccess,
}: {
  bookingId: string;
  currentStatus: string;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (currentStatus === "COMPLETED" || done) return null;

  const label = currentStatus === "CONFIRMED" ? "🚚 Start Job" : "✓ Mark Complete";
  const next  = currentStatus === "CONFIRMED" ? "IN_PROGRESS" : "COMPLETED";
  const bg    = currentStatus === "CONFIRMED" ? "#2563EB" : colors.emerald;

  async function update() {
    setLoading(true);
    const res = await fetch("/api/driver/my-jobs/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, status: next }),
    });
    setLoading(false);
    if (res.ok) { setDone(true); onSuccess(); }
  }

  return (
    <button
      disabled={loading}
      onClick={update}
      style={{
        width: "100%",
        padding: "11px",
        background: bg,
        border: "none",
        borderRadius: 10,
        color: "white",
        fontSize: 14,
        fontWeight: 700,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? "Updating…" : label}
    </button>
  );
}

function DetailPanel({ booking, onStatusChange }: { booking: BookingRow; onStatusChange: () => void }) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 60,
      background: "#0F172A",
      overflowY: "auto",
    }}>
      {/* handled by parent — close via back button placeholder */}
      <JobCard booking={booking}>
        <StatusButton
          bookingId={booking.id}
          currentStatus={booking.status}
          onSuccess={onStatusChange}
        />
      </JobCard>
    </div>
  );
}

function MyJobsContent() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get("id");

  const [data, setData] = useState<MyJobsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("inProgress");
  const [selected, setSelected] = useState<BookingRow | null>(null);

  const fetchJobs = useCallback(async () => {
    const res = await fetch("/api/driver/my-jobs");
    if (res.ok) {
      const json = await res.json() as MyJobsData;
      setData(json);

      // Auto-open focused booking from query param
      if (focusId && !selected) {
        const all = [...json.inProgress, ...json.upcoming, ...json.completed, ...json.cancelled];
        const found = all.find((b) => b.id === focusId);
        if (found) setSelected(found);
      }
    }
    setLoading(false);
  }, [focusId, selected]);

  useEffect(() => {
    fetchJobs();
    const t = setInterval(fetchJobs, 30_000);
    return () => clearInterval(t);
  }, [fetchJobs]);

  const handleStatusChange = () => {
    fetchJobs();
    setSelected(null);
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)" }}>Loading…</div>;
  }

  const allJobs = data ? [...data.inProgress, ...data.upcoming, ...data.completed, ...data.cancelled] : [];
  const focusedBooking = focusId ? allJobs.find((b) => b.id === focusId) : null;

  return (
    <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "white", margin: 0, fontFamily: "var(--font-heading)" }}>
        My Jobs
      </h1>

      {/* Tab bar */}
      <div style={{
        display: "flex",
        gap: 6,
        overflowX: "auto",
        paddingBottom: 4,
      }}>
        {TABS.map(({ key, label, emoji }) => {
          const count = data ? data[key].length : 0;
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                flexShrink: 0,
                padding: "7px 14px",
                borderRadius: 999,
                border: active ? "none" : "1px solid rgba(255,255,255,0.1)",
                background: active ? colors.emerald : "transparent",
                color: active ? "white" : "rgba(255,255,255,0.5)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {emoji} {label} {count > 0 && (
                <span style={{
                  background: active ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.15)",
                  borderRadius: 999,
                  padding: "0 6px",
                  fontSize: 10,
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Job list */}
      {data && (() => {
        const jobs = data[activeTab];
        if (jobs.length === 0) {
          return (
            <div style={{
              textAlign: "center",
              padding: "32px 20px",
              background: "#1E293B",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>No {TABS.find(t => t.key === activeTab)?.label.toLowerCase()} jobs</div>
            </div>
          );
        }
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {jobs.map((job) => (
              <div key={job.id} onClick={() => setSelected(job)} style={{ cursor: "pointer" }}>
                <JobCard booking={job}>
                  {(job.status === "CONFIRMED" || job.status === "IN_PROGRESS") && (
                    <StatusButton bookingId={job.id} currentStatus={job.status} onSuccess={handleStatusChange} />
                  )}
                </JobCard>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Full-screen detail panel */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "#0F172A", overflowY: "auto" }}>
          <div style={{ padding: "16px" }}>
            <button
              onClick={() => setSelected(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(255,255,255,0.07)",
                border: "none",
                borderRadius: 8,
                padding: "8px 14px",
                color: "white",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                marginBottom: 16,
              }}
            >
              ← Back
            </button>
            <JobCard booking={selected}>
              <StatusButton
                bookingId={selected.id}
                currentStatus={selected.status}
                onSuccess={handleStatusChange}
              />
            </JobCard>
          </div>
        </div>
      )}

      {/* Handle focusId from dashboard */}
      {focusedBooking && !selected && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "#0F172A", overflowY: "auto" }}>
          <div style={{ padding: "16px" }}>
            <a href="/driver/my-jobs" style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.07)",
              borderRadius: 8,
              padding: "8px 14px",
              color: "white",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              marginBottom: 16,
            }}>
              ← Back
            </a>
            <JobCard booking={focusedBooking}>
              <StatusButton
                bookingId={focusedBooking.id}
                currentStatus={focusedBooking.status}
                onSuccess={handleStatusChange}
              />
            </JobCard>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyJobsPage() {
  return (
    <Suspense>
      <MyJobsContent />
    </Suspense>
  );
}
