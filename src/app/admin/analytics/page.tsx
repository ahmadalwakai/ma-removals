import { db } from "@/lib/db";
import { gbpFormatter } from "@/lib/quotes/schemas";
import { colors, shadows } from "@/lib/tokens";

export const dynamic = "force-dynamic";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ background: "white", borderRadius: 12, border: "1px solid #E2E8F0", padding: "20px 20px 16px", flex: "1 1 160px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 700, color: colors.ink }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function formatPence(value: number | null | undefined) {
  return gbpFormatter.format((value ?? 0) / 100);
}

export default async function AdminAnalyticsPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [
    totalRevenue,
    monthRevenue,
    yearRevenue,
    totalBookings,
    completedBookings,
    cancelledBookings,
    avgValue,
    topService,
    quoteCounts,
    monthQuoteTotals,
    promotedQuoteTotals,
    monthQuoteEvents,
    redemptionStats,
    recoveryStats,
    campaignMetrics,
  ] = await Promise.all([
    db.booking.aggregate({ where: { isPaid: true }, _sum: { totalPaid: true } }),
    db.booking.aggregate({ where: { isPaid: true, createdAt: { gte: startOfMonth } }, _sum: { totalPaid: true } }),
    db.booking.aggregate({ where: { isPaid: true, createdAt: { gte: startOfYear } }, _sum: { totalPaid: true } }),
    db.booking.count(),
    db.booking.count({ where: { status: "COMPLETED" } }),
    db.booking.count({ where: { status: { in: ["CANCELLED", "REFUNDED"] } } }),
    db.booking.aggregate({ where: { isPaid: true }, _avg: { totalPaid: true } }),
    db.booking.groupBy({
      by: ["serviceName"],
      where: { isPaid: true },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
    db.quote.groupBy({
      by: ["status"],
      where: { createdAt: { gte: startOfMonth } },
      _count: { id: true },
    }),
    db.quote.aggregate({
      where: { createdAt: { gte: startOfMonth }, status: { in: ["FIXED", "ACCEPTED", "CONSUMED"] } },
      _sum: { finalTotalPence: true, discountTotalPence: true, contributionPence: true },
      _avg: { grossMarginPercentage: true },
    }),
    db.quote.aggregate({
      where: { createdAt: { gte: startOfMonth }, discountTotalPence: { gt: 0 } },
      _count: { id: true },
      _sum: { discountTotalPence: true, finalTotalPence: true },
    }),
    db.quoteEvent.groupBy({
      by: ["type"],
      where: { createdAt: { gte: startOfMonth } },
      _count: { id: true },
    }),
    db.promotionRedemption.groupBy({
      by: ["status"],
      where: { reservedAt: { gte: startOfMonth } },
      _count: { id: true },
      _sum: { discountPence: true },
    }),
    db.quoteRecoveryEvent.groupBy({
      by: ["status"],
      where: { createdAt: { gte: startOfMonth } },
      _count: { id: true },
    }),
    db.quote.groupBy({
      by: ["promotionCampaignId"],
      where: { createdAt: { gte: startOfMonth }, promotionCampaignId: { not: null } },
      _count: { id: true },
      _sum: { discountTotalPence: true, finalTotalPence: true, contributionPence: true },
      orderBy: { _count: { id: "desc" } },
      take: 8,
    }),
  ]);

  const campaignIds = campaignMetrics
    .map((row) => row.promotionCampaignId)
    .filter((id): id is string => Boolean(id));
  const campaignNames = campaignIds.length > 0
    ? await db.promotionCampaign.findMany({
        where: { id: { in: campaignIds } },
        select: { id: true, customerLabel: true, internalName: true, type: true },
      })
    : [];
  const campaignNameById = new Map(campaignNames.map((campaign) => [
    campaign.id,
    `${campaign.customerLabel} (${campaign.type.replace(/_/g, " ").toLowerCase()})`,
  ]));

  const totalRev = totalRevenue._sum.totalPaid ?? 0;
  const monthRev = monthRevenue._sum.totalPaid ?? 0;
  const yearRev = yearRevenue._sum.totalPaid ?? 0;
  const avg = avgValue._avg.totalPaid ?? 0;
  const completionRate = totalBookings > 0 ? (completedBookings / totalBookings * 100).toFixed(1) : "0";
  const quoteCountByStatus = new Map(quoteCounts.map((row) => [row.status, row._count.id]));
  const monthQuotes = quoteCounts.reduce((sum, row) => sum + row._count.id, 0);
  const monthFixedQuotes = quoteCountByStatus.get("FIXED") ?? 0;
  const monthAcceptedQuotes = quoteCountByStatus.get("ACCEPTED") ?? 0;
  const eventCountByType = new Map(monthQuoteEvents.map((row) => [row.type, row._count.id]));
  const redemptionCount = redemptionStats.reduce((sum, row) => sum + row._count.id, 0);
  const redeemedDiscount = redemptionStats
    .filter((row) => row.status === "REDEEMED")
    .reduce((sum, row) => sum + (row._sum.discountPence ?? 0), 0);
  const recoverySent = recoveryStats
    .filter((row) => row.status === "sent")
    .reduce((sum, row) => sum + row._count.id, 0);
  const averageMargin = monthQuoteTotals._avg.grossMarginPercentage == null
    ? "n/a"
    : `${(monthQuoteTotals._avg.grossMarginPercentage * 100).toFixed(1)}%`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* KPI row */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatCard label="Total Revenue" value={`£${totalRev.toFixed(0)}`} />
        <StatCard label="This Month" value={`£${monthRev.toFixed(0)}`} />
        <StatCard label="This Year" value={`£${yearRev.toFixed(0)}`} />
        <StatCard label="Avg Booking Value" value={`£${avg.toFixed(0)}`} />
        <StatCard label="Total Bookings" value={totalBookings} />
        <StatCard label="Completed" value={completedBookings} sub={`${completionRate}% completion rate`} />
        <StatCard label="Cancelled" value={cancelledBookings} />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatCard label="Quotes This Month" value={monthQuotes} sub={`${monthFixedQuotes} fixed · ${monthAcceptedQuotes} accepted`} />
        <StatCard label="Quote Events" value={eventCountByType.get("quote_step_view") ?? 0} sub={`${eventCountByType.get("quote_generated") ?? 0} generated`} />
        <StatCard label="Promo Quotes" value={promotedQuoteTotals._count.id} sub={`${formatPence(promotedQuoteTotals._sum.discountTotalPence)} discount cost`} />
        <StatCard label="Quote Value" value={formatPence(monthQuoteTotals._sum.finalTotalPence)} sub={`${formatPence(monthQuoteTotals._sum.contributionPence)} contribution`} />
        <StatCard label="Avg Quote Margin" value={averageMargin} />
        <StatCard label="Redemptions" value={redemptionCount} sub={`${formatPence(redeemedDiscount)} redeemed`} />
        <StatCard label="Recovery Sent" value={recoverySent} />
      </div>

      {/* Top services */}
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #E2E8F0", padding: "20px 24px", boxShadow: shadows.card }}>
        <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 15, fontWeight: 700, color: colors.ink, marginBottom: 16 }}>Top Services</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {topService.map((s, i) => {
            const pct = totalBookings > 0 ? (s._count.id / totalBookings * 100) : 0;
            return (
              <div key={s.serviceName} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 20, fontSize: 12, fontWeight: 700, color: colors.muted }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: 13, color: colors.ink }}>{s.serviceName || "—"}</span>
                <div style={{ width: 160, background: "#F1F5F9", borderRadius: 4, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: colors.emerald, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600, color: colors.ink, minWidth: 32, textAlign: "right" }}>
                  {s._count.id}
                </span>
              </div>
            );
          })}
          {topService.length === 0 && <div style={{ color: colors.muted, fontSize: 13 }}>No data yet.</div>}
        </div>
      </div>

      <div style={{ background: "white", borderRadius: 12, border: "1px solid #E2E8F0", padding: "20px 24px", boxShadow: shadows.card }}>
        <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 15, fontWeight: 700, color: colors.ink, marginBottom: 16 }}>Campaign Analytics</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {campaignMetrics.map((row) => {
            const id = row.promotionCampaignId ?? "";
            return (
              <div
                key={id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(180px, 1fr) 90px 120px 120px 120px",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid #F1F5F9",
                  fontSize: 13,
                }}
              >
                <span style={{ color: colors.ink, fontWeight: 700 }}>{campaignNameById.get(id) ?? "Unknown campaign"}</span>
                <span style={{ color: colors.muted }}>{row._count.id} quotes</span>
                <span style={{ color: colors.ink, fontFamily: "var(--font-mono)" }}>{formatPence(row._sum.finalTotalPence)}</span>
                <span style={{ color: colors.ink, fontFamily: "var(--font-mono)" }}>{formatPence(row._sum.discountTotalPence)}</span>
                <span style={{ color: colors.ink, fontFamily: "var(--font-mono)" }}>{formatPence(row._sum.contributionPence)}</span>
              </div>
            );
          })}
          {campaignMetrics.length === 0 && <div style={{ color: colors.muted, fontSize: 13 }}>No campaign-attributed quotes this month.</div>}
        </div>
      </div>
    </div>
  );
}
