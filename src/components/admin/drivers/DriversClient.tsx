"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, shadows } from "@/lib/tokens";

interface Driver {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  vehicleType: string;
  licensePlate: string;
  isActive: boolean;
  rating: number;
  jobsCompleted: number;
  createdAt: string;
}

interface Props { drivers: Driver[]; }

const emptyForm = { name: "", email: "", phone: "", vehicleType: "MEDIUM_VAN", licensePlate: "", password: "" };

export function DriversClient({ drivers: initialDrivers }: Props) {
  const router = useRouter();
  const [drivers, setDrivers] = useState(initialDrivers);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);
  const [pwdFor, setPwdFor] = useState<string | null>(null);

  async function addDriver() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Failed to add driver");
        return;
      }
      setShowModal(false);
      setForm(emptyForm);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    setToggling(id);
    try {
      await fetch(`/api/admin/drivers/${id}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !current }),
      });
      setDrivers((prev) => prev.map((d) => d.id === id ? { ...d, isActive: !current } : d));
    } finally {
      setToggling(null);
    }
  }

  async function setPassword(id: string) {
    const password = window.prompt("Enter a new sign-in password for this driver (min 6 characters):");
    if (password === null) return;
    if (password.length < 6) {
      window.alert("Password must be at least 6 characters.");
      return;
    }
    setPwdFor(id);
    try {
      const res = await fetch(`/api/admin/drivers/${id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        window.alert(d.error ?? "Failed to set password");
        return;
      }
      window.alert("Password updated. The driver can now sign in with their email and this password.");
    } catch {
      window.alert("Network error");
    } finally {
      setPwdFor(null);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid #E2E8F0",
    fontSize: 13,
    color: colors.ink,
    boxSizing: "border-box" as const,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: colors.muted }}>{drivers.length} driver{drivers.length !== 1 ? "s" : ""}</span>
        <button
          onClick={() => setShowModal(true)}
          style={{ padding: "9px 18px", background: colors.emerald, border: "none", borderRadius: 8, color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          + Add New Driver
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: shadows.card }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["Name", "Email", "Phone", "Vehicle", "Plate", "Status", "Jobs", "Rating", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: colors.muted, fontSize: 12, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drivers.map((d, i) => (
                <tr key={d.id} style={{ borderBottom: i < drivers.length - 1 ? "1px solid #F1F5F9" : undefined }}>
                  <td style={{ padding: "12px 14px", fontWeight: 500, color: colors.ink }}>{d.name}</td>
                  <td style={{ padding: "12px 14px", color: colors.muted, fontSize: 12 }}>{d.email}</td>
                  <td style={{ padding: "12px 14px", color: colors.muted }}>{d.phone}</td>
                  <td style={{ padding: "12px 14px", color: colors.ink }}>{d.vehicleType.replace("_", " ")}</td>
                  <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontSize: 12 }}>{d.licensePlate}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 600, background: d.isActive ? "rgba(16,185,129,0.12)" : "rgba(100,116,139,0.12)", color: d.isActive ? colors.emerald : colors.muted }}>
                      {d.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontWeight: 600, color: colors.ink }}>{d.jobsCompleted}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ color: d.rating >= 4.5 ? colors.emerald : d.rating >= 3 ? colors.amber : colors.crimson, fontWeight: 600 }}>
                      ★ {d.rating.toFixed(1)}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => void toggleActive(d.id, d.isActive)}
                        disabled={toggling === d.id}
                        style={{
                          padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                          background: d.isActive ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
                          color: d.isActive ? colors.crimson : colors.emerald,
                          fontWeight: 600, fontSize: 12,
                        }}
                      >
                        {d.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => void setPassword(d.id)}
                        disabled={pwdFor === d.id}
                        style={{
                          padding: "5px 12px", borderRadius: 6, border: "1px solid #E2E8F0", cursor: "pointer",
                          background: "white", color: colors.ink, fontWeight: 600, fontSize: 12,
                        }}
                      >
                        {pwdFor === d.id ? "Saving…" : "Set Password"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {drivers.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: colors.muted }}>No drivers yet. Add one above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Driver Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 16, padding: 28, width: "90%", maxWidth: 460, boxShadow: shadows.cardHover }}>
            <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 20, fontWeight: 700, color: colors.ink, marginBottom: 6 }}>Add New Driver</h3>
            <p style={{ color: colors.muted, fontSize: 13, lineHeight: 1.5, margin: "0 0 20px" }}>
              The driver can sign in with the email and password you set here.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { key: "name",  label: "Name",     type: "text", autoComplete: "name" },
                { key: "phone", label: "Phone",    type: "tel", autoComplete: "tel" },
                { key: "email", label: "Email",    type: "email", autoComplete: "email" },
                { key: "password", label: "Password (min 6 chars)", type: "password", autoComplete: "new-password" },
              ].map(({ key, label, type, autoComplete }) => (
                <div key={key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: colors.muted, display: "block", marginBottom: 4 }}>{label}</label>
                  <input
                    type={type}
                    autoComplete={autoComplete}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              ))}
              {error && <div style={{ color: colors.crimson, fontSize: 13 }}>{error}</div>}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => { setShowModal(false); setError(""); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid #E2E8F0", background: "white", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={() => void addDriver()} disabled={saving} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: colors.emerald, color: "white", cursor: "pointer", fontWeight: 700 }}>
                {saving ? "Adding…" : "Add Driver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
