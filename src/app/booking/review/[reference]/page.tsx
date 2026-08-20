"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { colors } from "@/lib/tokens";

function ReviewForm({ reference }: { reference: string }) {
  const searchParams = useSearchParams();
  const email = searchParams?.get("email") ?? "";
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a star rating.");
      return;
    }
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/booking/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, email, rating, comment }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setError(d.error ?? "Failed to submit review.");
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 22,
            fontWeight: 800,
            color: colors.ink,
            margin: "0 0 8px",
          }}
        >
          Thank you!
        </h2>
        <p style={{ fontSize: 14, color: "#64748B" }}>
          Your review has been submitted and will be published after approval.
        </p>
        <a
          href="/"
          style={{
            display: "inline-block",
            marginTop: 20,
            color: colors.emerald,
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          ← Back to Home
        </a>
      </div>
    );
  }

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
        <div style={{ fontSize: 36, marginBottom: 12 }}>⭐</div>
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 24,
            fontWeight: 800,
            color: colors.ink,
            margin: "0 0 6px",
          }}
        >
          Rate Your Experience
        </h1>
        <p style={{ fontSize: 14, color: "#64748B", margin: "0 0 28px" }}>
          How was your move with MA Removals?
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Stars */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 36,
                  padding: 2,
                  transition: "transform 0.1s",
                  transform: n <= (hovered || rating) ? "scale(1.15)" : "scale(1)",
                  color: n <= (hovered || rating) ? colors.amber : "#E2E8F0",
                }}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
              >
                ★
              </button>
            ))}
          </div>

          {/* Comment */}
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
              Tell us more (optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 2000))}
              placeholder="How was the experience?"
              rows={4}
              style={{
                width: "100%",
                padding: "11px 14px",
                border: "1.5px solid #E2E8F0",
                borderRadius: 10,
                fontSize: 14,
                background: "#F8FAFC",
                color: colors.ink,
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: "#EF4444" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "13px 0",
              background: submitting ? "#94A3B8" : colors.emerald,
              border: "none",
              borderRadius: 10,
              color: "white",
              fontWeight: 700,
              fontSize: 15,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function BookingReviewPage({
  params,
}: {
  params: { reference: string };
}) {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading...</div>}>
      <ReviewForm reference={params.reference} />
    </Suspense>
  );
}
