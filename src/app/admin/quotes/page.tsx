import Link from "next/link";
import { db } from "@/lib/db";
import { colors, shadows } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export default async function AdminQuotesPage() {
  const quotes = await db.quote.findMany({
    where: { status: { in: ["MANUAL_REVIEW", "FIXED", "ACCEPTED"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { pricingVersion: { select: { version: true } } },
  });

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ margin: "0 0 4px", fontFamily: "var(--font-heading)", fontSize: 24, color: colors.ink }}>Quote Review</h1>
      <p style={{ margin: "0 0 18px", color: colors.muted, fontSize: 13 }}>Manual review, accepted quotes, and fixed quote requests.</p>
      <div style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 12, boxShadow: shadows.card, overflow: "hidden" }}>
        {quotes.length === 0 ? (
          <div style={{ padding: 24, color: colors.muted }}>No quotes awaiting review.</div>
        ) : (
          quotes.map((quote) => (
            <Link
              key={quote.id}
              href={`/admin/quotes/${quote.id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 130px minmax(180px, 1fr) 160px 120px",
                gap: 12,
                alignItems: "center",
                padding: "14px 16px",
                borderBottom: "1px solid #F1F5F9",
                textDecoration: "none",
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)", color: colors.ink, fontWeight: 800, fontSize: 12 }}>{quote.reference}</span>
              <span style={{ color: quote.status === "MANUAL_REVIEW" ? colors.amber : colors.emerald, fontWeight: 800, fontSize: 12 }}>{quote.status.replace("_", " ")}</span>
              <span style={{ color: colors.ink, fontSize: 13 }}>{quote.customerName ?? "Customer"} · {quote.customerEmail ?? "No email"}</span>
              <span style={{ color: colors.muted, fontSize: 12 }}>{quote.moveType.replace(/-/g, " ")}</span>
              <span style={{ color: colors.ink, fontFamily: "var(--font-mono)", fontWeight: 800, textAlign: "right" }}>
                {quote.finalTotalPence == null ? "Review" : `£${(quote.finalTotalPence / 100).toFixed(2)}`}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
