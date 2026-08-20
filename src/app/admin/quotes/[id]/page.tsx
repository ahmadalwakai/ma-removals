import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { colors, shadows } from "@/lib/tokens";
import { QuoteReviewActions } from "@/components/admin/quotes/QuoteReviewActions";

export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 12, padding: 18, boxShadow: shadows.card, marginBottom: 16 }}>
      <h2 style={{ margin: "0 0 12px", fontFamily: "var(--font-heading)", fontSize: 15, color: colors.ink }}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, borderBottom: "1px solid #F1F5F9", padding: "7px 0", fontSize: 13 }}>
      <span style={{ color: colors.muted }}>{label}</span>
      <span style={{ color: colors.ink, fontWeight: 700, textAlign: "right" }}>{value}</span>
    </div>
  );
}

export default async function AdminQuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await db.quote.findUnique({
    where: { id },
    include: {
      pricingVersion: { select: { version: true, status: true } },
      booking: { select: { id: true, reference: true } },
    },
  });
  if (!quote) notFound();

  const audit = await db.pricingAuditLog.findMany({
    where: { entityType: "Quote", entityId: quote.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div style={{ maxWidth: 980 }}>
      <Link href="/admin/quotes" style={{ color: colors.muted, fontSize: 13, textDecoration: "none" }}>← All quotes</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, margin: "12px 0 16px" }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-heading)", fontSize: 24, color: colors.ink }}>{quote.reference}</h1>
          <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 13 }}>{quote.customerName} · {quote.customerEmail}</p>
        </div>
        <span style={{ borderRadius: 999, padding: "6px 12px", background: quote.status === "MANUAL_REVIEW" ? "#FFFBEB" : "rgba(37,99,235,0.10)", color: quote.status === "MANUAL_REVIEW" ? "#92400E" : colors.emerald, fontWeight: 800, fontSize: 12 }}>
          {quote.status.replace("_", " ")}
        </span>
      </div>

      <QuoteReviewActions quoteId={quote.id} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <Section title="Quote">
          <Row label="Move type" value={quote.moveType.replace(/-/g, " ")} />
          <Row label="Pricing version" value={quote.pricingVersion ? `v${quote.pricingVersion.version} (${quote.pricingVersion.status})` : "None"} />
          <Row label="Total" value={quote.finalTotalPence == null ? "Manual review" : `£${(quote.finalTotalPence / 100).toFixed(2)}`} />
          <Row label="Expires" value={quote.expiresAt.toLocaleString("en-GB")} />
          <Row label="Booking" value={quote.booking ? <Link href={`/admin/bookings/${quote.booking.id}`}>{quote.booking.reference}</Link> : "Not booked"} />
        </Section>
        <Section title="Manual Review Reasons">
          {quote.manualReviewReasons.length === 0 ? (
            <p style={{ color: colors.muted, margin: 0, fontSize: 13 }}>No active manual-review reasons.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, color: colors.ink, fontSize: 13 }}>
              {quote.manualReviewReasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Customer-Facing Breakdown">
        <pre style={preStyle}>{JSON.stringify(quote.customerBreakdown, null, 2)}</pre>
      </Section>
      <Section title="Internal Calculation Snapshot">
        <pre style={preStyle}>{JSON.stringify(quote.internalBreakdown, null, 2)}</pre>
      </Section>
      <Section title="Normalised Input">
        <pre style={preStyle}>{JSON.stringify(quote.normalisedInput, null, 2)}</pre>
      </Section>
      <Section title="Audit Trail">
        {audit.length === 0 ? (
          <p style={{ color: colors.muted, margin: 0, fontSize: 13 }}>No review actions logged yet.</p>
        ) : audit.map((entry) => (
          <div key={entry.id} style={{ borderBottom: "1px solid #F1F5F9", padding: "8px 0", fontSize: 13 }}>
            <strong>{entry.action}</strong> · {entry.reason ?? "No reason"} · {entry.createdAt.toLocaleString("en-GB")}
          </div>
        ))}
      </Section>
    </div>
  );
}

const preStyle: React.CSSProperties = {
  margin: 0,
  whiteSpace: "pre-wrap",
  background: "#0B1120",
  color: "white",
  borderRadius: 10,
  padding: 12,
  fontSize: 12,
  maxHeight: 360,
  overflow: "auto",
};
