"use client";

import { useState, useEffect, useCallback } from "react";
import { JobCard } from "@/components/driver/JobCard";
import { colors } from "@/lib/tokens";

interface OfferItem {
  offerId: string;
  expiresAt: string | null;
  booking: {
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
  };
}

type RespondStatus = "idle" | "loading" | "done" | "error";

function CountdownBadge({ expiresAt }: { expiresAt: string | null }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(h > 0 ? `${h}h ${m}m left` : `${m}m left`);
    };
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (!expiresAt) return null;
  return (
    <span style={{
      fontSize: 11,
      color: "#2563EB",
      background: "rgba(37,99,235,0.12)",
      border: "1px solid rgba(37,99,235,0.2)",
      borderRadius: 999,
      padding: "2px 8px",
      fontWeight: 600,
    }}>
      ⏱ {remaining}
    </span>
  );
}

export default function AvailableJobsPage() {
  const [jobs, setJobs] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<Record<string, RespondStatus>>({});
  const [note, setNote] = useState<Record<string, string>>({});

  const fetchJobs = useCallback(async () => {
    const res = await fetch("/api/driver/jobs");
    if (res.ok) {
      const data = await res.json() as { jobs: OfferItem[] };
      setJobs(data.jobs);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchJobs();
    const t = setInterval(fetchJobs, 15_000);
    return () => clearInterval(t);
  }, [fetchJobs]);

  async function respond(offerId: string, action: "accept" | "reject") {
    setResponding((p) => ({ ...p, [offerId]: "loading" }));
    const res = await fetch("/api/driver/jobs/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId, action, note: note[offerId] }),
    });
    if (res.ok) {
      setResponding((p) => ({ ...p, [offerId]: "done" }));
      // Remove from list after short delay
      setTimeout(() => setJobs((prev) => prev.filter((j) => j.offerId !== offerId)), 800);
    } else {
      setResponding((p) => ({ ...p, [offerId]: "error" }));
    }
  }

  return (
    <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "white", margin: "0 0 4px", fontFamily: "var(--font-heading)" }}>
          Available Jobs
        </h1>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>
          Job offers from the admin team. Respond before they expire.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)" }}>Loading…</div>
      ) : jobs.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "40px 20px",
          background: "#1E293B",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
          <div style={{ color: "white", fontWeight: 600, fontSize: 15, marginBottom: 6 }}>No offers right now</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
            Check back later — this page refreshes automatically every 15 seconds.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {jobs.map(({ offerId, expiresAt, booking }) => {
            const status = responding[offerId] ?? "idle";
            const isDone = status === "done";

            return (
              <div key={offerId} style={{ opacity: isDone ? 0.5 : 1, transition: "opacity 0.4s" }}>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                  <CountdownBadge expiresAt={expiresAt} />
                </div>
                <JobCard booking={booking}>
                  {status === "done" ? (
                    <div style={{ textAlign: "center", color: colors.emerald, fontWeight: 700, padding: "8px 0" }}>
                      ✓ Response sent
                    </div>
                  ) : status === "error" ? (
                    <div style={{ textAlign: "center", color: "#fca5a5", fontSize: 13, padding: "8px 0" }}>
                      Failed to respond. Please try again.
                    </div>
                  ) : (
                    <>
                      <textarea
                        placeholder="Optional note (e.g. reason for declining)…"
                        value={note[offerId] ?? ""}
                        onChange={(e) => setNote((p) => ({ ...p, [offerId]: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 8,
                          color: "white",
                          fontSize: 13,
                          resize: "none",
                          marginBottom: 10,
                          boxSizing: "border-box",
                          outline: "none",
                          minHeight: 60,
                          fontFamily: "inherit",
                        }}
                      />
                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          disabled={status === "loading"}
                          onClick={() => respond(offerId, "reject")}
                          style={{
                            flex: 1,
                            padding: "11px",
                            background: "rgba(239,68,68,0.12)",
                            border: "1px solid rgba(239,68,68,0.25)",
                            borderRadius: 10,
                            color: "#fca5a5",
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          ✕ Decline
                        </button>
                        <button
                          disabled={status === "loading"}
                          onClick={() => respond(offerId, "accept")}
                          style={{
                            flex: 2,
                            padding: "11px",
                            background: colors.emerald,
                            border: "none",
                            borderRadius: 10,
                            color: "white",
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: status === "loading" ? "not-allowed" : "pointer",
                            opacity: status === "loading" ? 0.7 : 1,
                          }}
                        >
                          {status === "loading" ? "Sending…" : "✓ Accept Job"}
                        </button>
                      </div>
                    </>
                  )}
                </JobCard>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
