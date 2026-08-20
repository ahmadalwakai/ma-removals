"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, shadows } from "@/lib/tokens";

interface Props {
  booking: { id: string; status: string; totalPaid: number; scheduledDate: string; stripePaymentId: string | null };
  drivers: { id: string; name: string }[];
}

export function BookingDetailActions({ booking, drivers }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [refundModal, setRefundModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [dispatchedKey, setDispatchedKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function showToast(kind: "ok" | "err", text: string) {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 4000);
  }

  /**
   * Dispatch the booking to the selected driver. Reuses the existing
   * assign-driver route, which assigns the job, updates customer/admin
   * tracking and fires the driver's Android push. Guards against double
   * clicks (disabled while loading) and re-sending the same driver+booking.
   */
  async function sendToDriver() {
    if (!selectedDriver || loading === "dispatch") return;
    const key = `${booking.id}:${selectedDriver}`;
    if (dispatchedKey === key) {
      showToast("err", "تم الإرسال لهذا السائق مسبقاً / Already sent to this driver");
      return;
    }
    setLoading("dispatch");
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/assign-driver`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: selectedDriver }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDispatchedKey(key);
      showToast("ok", "تم إرسال المهمة للسائق / Sent to driver");
      router.refresh();
    } catch {
      showToast("err", "تعذّر الإرسال، حاول مرة أخرى / Failed to send");
    } finally {
      setLoading(null);
    }
  }

  async function changeStatus(status: string) {
    setLoading("status");
    await fetch(`/api/admin/bookings/${booking.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setLoading(null);
    router.refresh();
  }

  async function assignDriver(driverId: string) {
    setLoading("driver");
    await fetch(`/api/admin/bookings/${booking.id}/assign-driver`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId }),
    });
    setLoading(null);
    router.refresh();
  }

  function computeRefundAmount() {
    const scheduled = new Date(booking.scheduledDate).getTime();
    const hours = (scheduled - Date.now()) / 3_600_000;
    if (hours > 48) return { amount: booking.totalPaid, policy: "Full refund (>48h notice)" };
    if (hours > 24) return { amount: booking.totalPaid * 0.5, policy: "50% refund (24-48h notice)" };
    return { amount: 0, policy: "No refund (<24h notice)" };
  }

  async function processRefund() {
    const { amount } = computeRefundAmount();
    if (amount <= 0) return;
    setLoading("refund");
    await fetch(`/api/admin/bookings/${booking.id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    setLoading(null);
    setRefundModal(false);
    router.refresh();
  }

  const { amount: refundAmt, policy: refundPolicy } = computeRefundAmount();

  const btnStyle = (bg: string, color = "white") => ({
    padding: "10px 18px",
    borderRadius: 8,
    border: "none",
    background: bg,
    color,
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  });

  return (
    <div style={{ background: "white", borderRadius: 12, border: "1px solid #E2E8F0", padding: "20px 24px", marginBottom: 16, boxShadow: shadows.card }}>
      <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 14, fontWeight: 700, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>Actions</h3>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {/* Change status */}
        <select
          defaultValue={booking.status}
          onChange={(e) => void changeStatus(e.target.value)}
          disabled={loading === "status"}
          style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, cursor: "pointer" }}
        >
          {["PENDING","CONFIRMED","IN_PROGRESS","COMPLETED","CANCELLED"].map((s) => (
            <option key={s} value={s}>{s.replace("_"," ")}</option>
          ))}
        </select>

        {/* Assign driver (legacy immediate assign) */}
        <select
          onChange={(e) => void assignDriver(e.target.value)}
          disabled={loading === "driver"}
          style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, cursor: "pointer" }}
        >
          <option value="">Assign driver…</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        {/* Dispatch to a driver (sends Android job alert) */}
        <select
          title="Select driver to dispatch"
          value={selectedDriver}
          onChange={(e) => { setSelectedDriver(e.target.value); setDispatchedKey(null); }}
          disabled={loading === "dispatch"}
          style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13, cursor: "pointer" }}
        >
          <option value="">Select driver…</option>
          {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button
          onClick={() => void sendToDriver()}
          disabled={!selectedDriver || loading === "dispatch"}
          style={btnStyle(selectedDriver ? colors.emerald : "#94A3B8")}
        >
          {loading === "dispatch" ? "Sending…" : "Send to driver / إرسال للسائق"}
        </button>

        {/* Contact customer */}
        <a href={`mailto:`} style={{ ...btnStyle("#F1F5F9", colors.ink) }}>
          Contact Customer
        </a>

        {/* Refund */}
        {booking.totalPaid > 0 && booking.status !== "REFUNDED" && (
          <button onClick={() => setRefundModal(true)} style={btnStyle("rgba(239,68,68,0.1)", colors.crimson)}>
            Refund
          </button>
        )}
      </div>

      {toast && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            background: toast.kind === "ok" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
            color: toast.kind === "ok" ? colors.emerald : colors.crimson,
          }}
        >
          {toast.text}
        </div>
      )}

      {refundModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 16, padding: 28, maxWidth: 420, width: "90%" }}>
            <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Confirm Refund</h3>
            <p style={{ fontSize: 14, color: colors.muted, marginBottom: 8 }}>{refundPolicy}</p>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>
              Amount: <span style={{ fontFamily: "var(--font-mono)", color: refundAmt > 0 ? colors.emerald : colors.crimson }}>£{refundAmt.toFixed(2)}</span>
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setRefundModal(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #E2E8F0", background: "white", cursor: "pointer" }}>Cancel</button>
              {refundAmt > 0 && (
                <button onClick={() => void processRefund()} disabled={loading === "refund"} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: colors.crimson, color: "white", cursor: "pointer", fontWeight: 700 }}>
                  {loading === "refund" ? "Processing…" : `Refund £${refundAmt.toFixed(2)}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
