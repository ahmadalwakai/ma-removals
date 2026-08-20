"use client";

import { useState } from "react";

export function LocationSharingButton({
  bookingId,
  isActive,
}: {
  bookingId: string;
  isActive: boolean;
}) {
  const [eta, setEta] = useState("");
  const [sharing, setSharing] = useState(false);
  const [lastShared, setLastShared] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (!isActive) return null;

  const handleShare = () => {
    setError("");
    setSharing(true);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setSharing(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/booking/${bookingId}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              eta: eta ? parseInt(eta, 10) : undefined,
            }),
          });
          if (res.ok) {
            setLastShared(
              new Date().toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })
            );
          } else {
            const d = (await res.json()) as { error?: string };
            setError(d.error ?? "Failed to share location.");
          }
        } catch {
          setError("Network error. Please try again.");
        } finally {
          setSharing(false);
        }
      },
      (err) => {
        setError(
          err.code === 1
            ? "Location access denied. Please enable it in browser settings."
            : "Could not get your location. Please try again."
        );
        setSharing(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div
      style={{
        background: "#1E293B",
        borderRadius: 12,
        padding: "20px 24px",
        border: "1px solid rgba(255,255,255,0.07)",
        marginBottom: 20,
      }}
    >
      <p
        style={{
          margin: "0 0 4px",
          fontSize: 14,
          fontWeight: 700,
          color: "rgba(255,255,255,0.9)",
        }}
      >
        📍 Share Your Location
      </p>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748B" }}>
        Share your current location with the customer so they can track your progress.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div>
          <label
            htmlFor="eta-input"
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              color: "#64748B",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            ETA (minutes, optional)
          </label>
          <input
            id="eta-input"
            type="number"
            min={1}
            max={240}
            placeholder="e.g. 15"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
            style={{
              background: "#0F172A",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "9px 12px",
              fontSize: 13,
              color: "white",
              width: 120,
            }}
          />
        </div>
        <button
          onClick={handleShare}
          disabled={sharing}
          style={{
            padding: "10px 20px",
            background: sharing ? "#475569" : "#2563EB",
            color: "white",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            border: "none",
            cursor: sharing ? "default" : "pointer",
            transition: "background 0.2s",
          }}
        >
          {sharing ? "Getting location…" : "Share Now"}
        </button>
      </div>

      {lastShared && !error && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#2563EB" }}>
          ✓ Location shared at {lastShared}
        </p>
      )}
      {error && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "#EF4444" }}>{error}</p>
      )}
    </div>
  );
}
