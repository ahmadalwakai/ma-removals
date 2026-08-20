"use client";

import { useState } from "react";
import { colors, shadows } from "@/lib/tokens";

interface Job {
  id: string;
  reference: string;
  serviceName: string;
  pickupAddress: string;
  dropoffAddress: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  customer: { name: string; phone: string };
  driver: { name: string } | null;
}

interface DriverOption { id: string; name: string; }

interface Props { jobs: Job[]; drivers: DriverOption[]; }

function statusColor(s: string) {
  if (s === "CONFIRMED")   return { bg: "rgba(37,99,235,0.12)",  color: "#2563EB" };
  if (s === "IN_PROGRESS") return { bg: "rgba(99,102,241,0.12)",  color: "#6366F1" };
  return { bg: "#F1F5F9", color: "#64748B" };
}

export function JobBoardClient({ jobs, drivers }: Props) {
  const [assigning, setAssigning] = useState<string | null>(null);
  const [localDrivers, setLocalDrivers] = useState<Record<string, string>>({});

  async function assignDriver(jobId: string, driverId: string) {
    setAssigning(jobId);
    try {
      await fetch(`/api/admin/bookings/${jobId}/assign-driver`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId }),
      });
      const driverName = drivers.find((d) => d.id === driverId)?.name ?? "Driver";
      setLocalDrivers((prev) => ({ ...prev, [jobId]: driverName }));
    } finally {
      setAssigning(null);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, color: colors.muted }}>{jobs.length} active job{jobs.length !== 1 ? "s" : ""}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {jobs.map((job) => {
          const sc = statusColor(job.status);
          const assignedDriver = localDrivers[job.id] ?? job.driver?.name;
          return (
            <div key={job.id} style={{ background: "white", borderRadius: 12, border: "1px solid #E2E8F0", padding: "16px 20px", boxShadow: shadows.card }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: colors.emerald }}>{job.reference}</span>
                    <span style={{ padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
                      {job.status.replace("_", " ")}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: colors.ink, marginBottom: 4 }}>{job.serviceName}</div>
                  <div style={{ fontSize: 12, color: colors.muted, marginBottom: 2 }}>
                    📍 {job.pickupAddress}
                  </div>
                  <div style={{ fontSize: 12, color: colors.muted }}>
                    🏁 {job.dropoffAddress}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.ink }}>
                    {new Date(job.scheduledDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                  </div>
                  <div style={{ fontSize: 12, color: colors.muted, marginBottom: 8 }}>{job.scheduledTime}</div>
                  <div style={{ fontSize: 12, color: colors.ink }}>👤 {job.customer.name}</div>
                  <div style={{ fontSize: 11, color: colors.muted }}>{job.customer.phone}</div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #F1F5F9", marginTop: 12, paddingTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: assignedDriver ? colors.ink : colors.muted }}>
                  Driver: {assignedDriver ?? "Unassigned"}
                </span>
                <select
                  onChange={(e) => void assignDriver(job.id, e.target.value)}
                  disabled={assigning === job.id}
                  style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12, cursor: "pointer" }}
                >
                  <option value="">Assign driver…</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <a href={`/admin/bookings/${job.id}`} style={{ fontSize: 12, color: colors.emerald, fontWeight: 600 }}>
                  View full booking →
                </a>
              </div>
            </div>
          );
        })}

        {jobs.length === 0 && (
          <div style={{ background: "white", borderRadius: 12, border: "1px solid #E2E8F0", padding: 48, textAlign: "center", color: colors.muted, boxShadow: shadows.card }}>
            No active jobs at the moment.
          </div>
        )}
      </div>
    </div>
  );
}
