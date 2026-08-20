"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { colors } from "@/lib/tokens";

function TrackForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [ref, setRef] = useState(searchParams?.get("ref") ?? "");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!ref.trim() || !email.trim()) {
      setError("Please enter both your booking reference and email.");
      return;
    }
    setLoading(true);
    const res = await fetch(
      `/api/booking/track/${encodeURIComponent(ref.trim())}?email=${encodeURIComponent(email.trim())}`
    );
    setLoading(false);
    if (res.status === 403) {
      setError("Email doesn't match this booking reference.");
      return;
    }
    if (!res.ok) {
      setError("Booking not found. Please check your reference.");
      return;
    }
    router.push(`/booking/track/${encodeURIComponent(ref.trim())}?email=${encodeURIComponent(email.trim())}`);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8FAFC",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: "40px 32px",
          maxWidth: 440,
          width: "100%",
          boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 16 }}>📦</div>
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 24,
            fontWeight: 800,
            color: colors.ink,
            margin: "0 0 8px",
          }}
        >
          Track Your Booking
        </h1>
        <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 28px" }}>
          Enter your booking reference and email to see the status of your move.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#64748B",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "block",
                marginBottom: 6,
              }}
            >
              Booking Reference
            </label>
            <input
              type="text"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="MAR-2026-XXXXXX"
              style={{
                width: "100%",
                padding: "11px 14px",
                border: "1.5px solid #E2E8F0",
                borderRadius: 10,
                fontSize: 14,
                fontFamily: "var(--font-mono)",
                background: "#F8FAFC",
                color: colors.ink,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#64748B",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "block",
                marginBottom: 6,
              }}
            >
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                width: "100%",
                padding: "11px 14px",
                border: "1.5px solid #E2E8F0",
                borderRadius: 10,
                fontSize: 14,
                background: "#F8FAFC",
                color: colors.ink,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: "#EF4444" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "13px 0",
              background: loading ? "#94A3B8" : colors.emerald,
              border: "none",
              borderRadius: 10,
              color: "white",
              fontWeight: 700,
              fontSize: 15,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: 4,
            }}
          >
            {loading ? "Searching..." : "Track My Booking"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function BookingTrackPage() {
  return (
    <Suspense>
      <TrackForm />
    </Suspense>
  );
}
