"use client";

import { useState } from "react";
import { colors } from "@/lib/tokens";

export function QuoteReviewActions({ quoteId }: { quoteId: string }) {
  const [message, setMessage] = useState("");

  async function send(action: "approve" | "reject" | "contact") {
    const reason = window.prompt(
      action === "approve"
        ? "Reason for approving or overriding this quote"
        : action === "reject"
          ? "Reason for rejecting this quote"
          : "Customer contact note"
    );
    if (!reason) return;

    let finalTotalPence: number | undefined;
    if (action === "approve") {
      const amount = window.prompt("Fixed customer total in GBP");
      if (!amount) return;
      const parsed = Number(amount);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setMessage("Enter a valid positive amount.");
        return;
      }
      finalTotalPence = Math.round(parsed * 100);
    }

    const response = await fetch(`/api/admin/quotes/${quoteId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason, finalTotalPence }),
    });
    const data = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      setMessage(data?.error ?? "Action failed.");
      return;
    }
    setMessage("Saved.");
    location.reload();
  }

  return (
    <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 12, padding: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button onClick={() => void send("approve")} style={button(colors.emerald, "white")}>Approve / Edit Price</button>
      <button onClick={() => void send("reject")} style={button(colors.crimson, "white")}>Reject</button>
      <button onClick={() => void send("contact")} style={button(colors.amber, colors.midnight)}>Contact Logged</button>
      {message && <span style={{ alignSelf: "center", fontSize: 13, color: colors.muted }}>{message}</span>}
    </div>
  );
}

function button(background: string, color: string): React.CSSProperties {
  return {
    border: "none",
    borderRadius: 8,
    padding: "9px 12px",
    background,
    color,
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 13,
  };
}
