"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { colors, shadows } from "@/lib/tokens";

interface BookingRow {
  id: string;
  reference: string;
  customerId: string;
  customer: { name: string | null; email: string | null; phone: string | null };
  serviceName: string;
  pickupAddress: string;
  dropoffAddress: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  totalPaid: number;
  driver: { user: { name: string | null } } | null;
}

interface DriverOption { id: string; name: string; }

interface Props { bookings: BookingRow[]; drivers: DriverOption[]; }

const STATUSES = ["All", "PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REFUNDED"];
const PER_PAGE = 20;

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string }> = {
    CONFIRMED:   { bg: "rgba(37,99,235,0.12)",  color: "#2563EB" },
    IN_PROGRESS: { bg: "rgba(37,99,235,0.15)",    color: "#2563EB" },
    COMPLETED:   { bg: "rgba(100,116,139,0.12)",  color: "#64748B" },
    CANCELLED:   { bg: "rgba(239,68,68,0.12)",    color: "#EF4444" },
    REFUNDED:    { bg: "rgba(239,68,68,0.08)",    color: "#F87171" },
    PENDING:     { bg: "rgba(37,99,235,0.10)",    color: "#2563EB" },
  };
  const s = map[status] ?? { bg: "#F1F5F9", color: "#64748B" };
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      {status.replace("_", " ")}
    </span>
  );
}

function exportCsv(rows: BookingRow[]) {
  const headers = ["Reference", "Customer", "Email", "Phone", "Service", "Pickup", "Dropoff", "Date", "Time", "Status", "Total", "Driver"];
  const lines = rows.map((b) => [
    b.reference,
    b.customer.name ?? "",
    b.customer.email ?? "",
    b.customer.phone ?? "",
    b.serviceName,
    `"${b.pickupAddress}"`,
    `"${b.dropoffAddress}"`,
    new Date(b.scheduledDate).toLocaleDateString("en-GB"),
    b.scheduledTime,
    b.status,
    b.totalPaid.toFixed(2),
    b.driver?.user.name ?? "Unassigned",
  ].join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

export function BookingsTable({ bookings, drivers }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<"scheduledDate" | "totalPaid" | "reference">("scheduledDate");
  const [sortAsc, setSortAsc] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>({});
  const [localDrivers, setLocalDrivers] = useState<Record<string, string>>({});
  const [refundModal, setRefundModal] = useState<{ id: string; amount: number; policy: string } | null>(null);

  const filtered = useMemo(() => {
    let rows = [...bookings];

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((b) =>
        b.reference.toLowerCase().includes(q) ||
        (b.customer.name ?? "").toLowerCase().includes(q) ||
        (b.customer.email ?? "").toLowerCase().includes(q) ||
        (b.customer.phone ?? "").includes(q)
      );
    }

    if (statusFilter !== "All") rows = rows.filter((b) => (localStatuses[b.id] ?? b.status) === statusFilter);

    rows.sort((a, b) => {
      let av: string | number, bv: string | number;
      if (sortCol === "scheduledDate") { av = a.scheduledDate; bv = b.scheduledDate; }
      else if (sortCol === "totalPaid") { av = a.totalPaid; bv = b.totalPaid; }
      else { av = a.reference; bv = b.reference; }
      return sortAsc ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });

    return rows;
  }, [bookings, search, statusFilter, sortCol, sortAsc, localStatuses]);

  const pages = Math.ceil(filtered.length / PER_PAGE);
  const pageRows = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const sortHeader = (col: typeof sortCol, label: string) => (
    <th
      onClick={() => { if (sortCol === col) setSortAsc(!sortAsc); else { setSortCol(col); setSortAsc(false); } }}
      style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: colors.muted, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" }}
    >
      {label} {sortCol === col ? (sortAsc ? "↑" : "↓") : ""}
    </th>
  );

  async function changeStatus(bookingId: string, status: string) {
    setActionLoading(bookingId + "-status");
    try {
      await fetch(`/api/admin/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setLocalStatuses((prev) => ({ ...prev, [bookingId]: status }));
    } finally {
      setActionLoading(null);
    }
  }

  async function assignDriver(bookingId: string, driverId: string) {
    setActionLoading(bookingId + "-driver");
    try {
      await fetch(`/api/admin/bookings/${bookingId}/assign-driver`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId }),
      });
      setLocalDrivers((prev) => ({ ...prev, [bookingId]: driverId }));
    } finally {
      setActionLoading(null);
    }
  }

  function openRefund(b: BookingRow) {
    const scheduled = new Date(b.scheduledDate).getTime();
    const now = Date.now();
    const hoursUntil = (scheduled - now) / 3_600_000;
    let pct = 0;
    let policy = "No refund (less than 24h notice)";
    if (hoursUntil > 48) { pct = 1; policy = "Full refund (more than 48h notice)"; }
    else if (hoursUntil > 24) { pct = 0.5; policy = "50% refund (24-48h notice)"; }
    const amount = Math.round(b.totalPaid * pct * 100) / 100;
    setRefundModal({ id: b.id, amount, policy });
  }

  async function processRefund() {
    if (!refundModal) return;
    setActionLoading("refund");
    try {
      await fetch(`/api/admin/bookings/${refundModal.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: refundModal.amount }),
      });
    } finally {
      setActionLoading(null);
      setRefundModal(null);
    }
  }

  const selectStyle = {
    background: "white",
    border: "1px solid #E2E8F0",
    borderRadius: 8,
    padding: "7px 10px",
    fontSize: 13,
    color: colors.ink,
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search reference, name, email..."
          style={{ ...selectStyle, flex: "1 1 220px", minWidth: 0 }}
        />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} style={selectStyle}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button
          onClick={() => exportCsv(filtered)}
          style={{ ...selectStyle, background: colors.ink, color: "white", fontWeight: 600, border: "none" }}
        >
          Export CSV
        </button>
        <span style={{ marginLeft: "auto", fontSize: 13, color: colors.muted }}>
          {filtered.length} booking{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: shadows.card }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {sortHeader("reference", "Reference")}
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: colors.muted, fontSize: 12 }}>Customer</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: colors.muted, fontSize: 12 }}>Service</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: colors.muted, fontSize: 12 }}>Route</th>
                {sortHeader("scheduledDate", "Date")}
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: colors.muted, fontSize: 12 }}>Status</th>
                {sortHeader("totalPaid", "Total")}
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: colors.muted, fontSize: 12 }}>Driver</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: colors.muted, fontSize: 12 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((b, i) => {
                const currentStatus = localStatuses[b.id] ?? b.status;
                const assignedDriverId = localDrivers[b.id];
                const assignedDriverName = assignedDriverId
                  ? drivers.find((d) => d.id === assignedDriverId)?.name
                  : (b.driver?.user.name ?? null);
                return (
                  <tr key={b.id} style={{ borderBottom: i < pageRows.length - 1 ? "1px solid #F1F5F9" : undefined }}>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <Link href={`/admin/bookings/${b.id}`} style={{ color: colors.emerald, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>
                        {b.reference}
                      </Link>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 500, color: colors.ink }}>{b.customer.name ?? "—"}</div>
                      <div style={{ fontSize: 11, color: colors.muted }}>{b.customer.phone}</div>
                    </td>
                    <td style={{ padding: "12px 14px", color: colors.ink }}>{b.serviceName}</td>
                    <td style={{ padding: "12px 14px", maxWidth: 180 }}>
                      <div style={{ fontSize: 11, color: colors.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.pickupAddress}</div>
                      <div style={{ fontSize: 11, color: colors.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>→ {b.dropoffAddress}</div>
                    </td>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap", color: colors.muted }}>
                      {new Date(b.scheduledDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}<br />
                      <span style={{ fontSize: 11 }}>{b.scheduledTime}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>{statusBadge(currentStatus)}</td>
                    <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontWeight: 600, color: colors.ink }}>
                      £{b.totalPaid.toFixed(2)}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {assignedDriverName
                        ? <span style={{ fontSize: 12, color: colors.ink }}>{assignedDriverName}</span>
                        : <span style={{ fontSize: 11, color: colors.muted }}>Unassigned</span>}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
                        <Link href={`/admin/bookings/${b.id}`} style={{ padding: "4px 10px", background: "#F1F5F9", borderRadius: 6, fontSize: 12, fontWeight: 600, color: colors.ink }}>
                          View
                        </Link>
                        <select
                          value={currentStatus}
                          disabled={actionLoading === b.id + "-status"}
                          onChange={(e) => void changeStatus(b.id, e.target.value)}
                          style={{ fontSize: 11, border: "1px solid #E2E8F0", borderRadius: 6, padding: "3px 6px", background: "white", cursor: "pointer" }}
                        >
                          {["PENDING","CONFIRMED","IN_PROGRESS","COMPLETED","CANCELLED"].map((s) => (
                            <option key={s} value={s}>{s.replace("_"," ")}</option>
                          ))}
                        </select>
                        <select
                          value={localDrivers[b.id] ?? b.driver?.user.name ?? ""}
                          disabled={actionLoading === b.id + "-driver"}
                          onChange={(e) => void assignDriver(b.id, e.target.value)}
                          style={{ fontSize: 11, border: "1px solid #E2E8F0", borderRadius: 6, padding: "3px 6px", background: "white", cursor: "pointer" }}
                        >
                          <option value="">Assign driver</option>
                          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        {b.totalPaid > 0 && currentStatus !== "REFUNDED" && (
                          <button
                            onClick={() => openRefund(b)}
                            style={{ padding: "4px 8px", background: "rgba(239,68,68,0.08)", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, color: colors.crimson, cursor: "pointer" }}
                          >
                            Refund
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: colors.muted }}>No bookings match your filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #E2E8F0", background: "white", cursor: page === 0 ? "not-allowed" : "pointer", opacity: page === 0 ? 0.4 : 1 }}>
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: colors.muted }}>Page {page + 1} of {pages}</span>
          <button onClick={() => setPage(Math.min(pages - 1, page + 1))} disabled={page === pages - 1} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #E2E8F0", background: "white", cursor: page === pages - 1 ? "not-allowed" : "pointer", opacity: page === pages - 1 ? 0.4 : 1 }}>
            Next →
          </button>
        </div>
      )}

      {/* Refund Modal */}
      {refundModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 16, padding: 28, maxWidth: 420, width: "90%", boxShadow: shadows.cardHover }}>
            <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 700, color: colors.ink, marginBottom: 12 }}>Confirm Refund</h3>
            <p style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>{refundModal.policy}</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: colors.ink, marginBottom: 24 }}>
              Refund amount: <span style={{ fontFamily: "var(--font-mono)", color: refundModal.amount > 0 ? colors.emerald : colors.crimson }}>£{refundModal.amount.toFixed(2)}</span>
            </p>
            {refundModal.amount === 0 && (
              <p style={{ fontSize: 13, color: colors.crimson, marginBottom: 16 }}>No refund is applicable under the cancellation policy.</p>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setRefundModal(null)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #E2E8F0", background: "white", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                Cancel
              </button>
              {refundModal.amount > 0 && (
                <button onClick={() => void processRefund()} disabled={actionLoading === "refund"} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: colors.crimson, color: "white", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                  {actionLoading === "refund" ? "Processing..." : `Refund £${refundModal.amount.toFixed(2)}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
