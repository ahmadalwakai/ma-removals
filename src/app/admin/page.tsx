import Link from "next/link";
import { db } from "@/lib/db";
import { colors, shadows } from "@/lib/tokens";
import { KpiCards } from "@/components/admin/dashboard/KpiCards";

export const dynamic = "force-dynamic";

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
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: 9999,
      fontSize: 11,
      fontWeight: 600,
      background: s.bg,
      color: s.color,
    }}>
      {status.replace("_", " ")}
    </span>
  );
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [
    totalBookings,
    thisMonthBookings,
    lastMonthBookings,
    revenueThisMonth,
    revenueLastMonth,
    activeDrivers,
    pendingCount,
    recentBookings,
  ] = await Promise.all([
    db.booking.count(),
    db.booking.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.booking.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
    db.booking.aggregate({
      where: { isPaid: true, createdAt: { gte: startOfMonth } },
      _sum: { totalPaid: true },
    }),
    db.booking.aggregate({
      where: { isPaid: true, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
      _sum: { totalPaid: true },
    }),
    db.driverProfile.count({ where: { isActive: true } }),
    db.booking.count({ where: { status: "CONFIRMED" } }),
    db.booking.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { customer: { select: { name: true, email: true } } },
    }),
  ]);

  const revenueNow = revenueThisMonth._sum.totalPaid ?? 0;
  const revenuePrev = revenueLastMonth._sum.totalPaid ?? 0;

  const kpiData = {
    totalBookings,
    thisMonthBookings,
    lastMonthBookings,
    revenueNow,
    revenuePrev,
    activeDrivers,
    pendingCount,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* KPI cards — client component for count-up */}
      <KpiCards data={kpiData} />

      {/* Recent Bookings */}
      <section>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: colors.ink, marginBottom: 14 }}>
          Recent Bookings
        </h2>
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: shadows.card }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  {["Reference", "Customer", "Service", "Date", "Status", "Total", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: colors.muted, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b, i) => (
                  <tr key={b.id} style={{ borderBottom: i < recentBookings.length - 1 ? "1px solid #F1F5F9" : undefined }}>
                    <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                      <Link href={`/admin/bookings/${b.id}`} style={{ color: colors.emerald, fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>
                        {b.reference}
                      </Link>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 500, color: colors.ink }}>{b.customer.name ?? "—"}</div>
                      <div style={{ fontSize: 11, color: colors.muted }}>{b.customer.email}</div>
                    </td>
                    <td style={{ padding: "12px 14px", color: colors.ink }}>{b.serviceName}</td>
                    <td style={{ padding: "12px 14px", color: colors.muted, whiteSpace: "nowrap" }}>
                      {b.scheduledDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ padding: "12px 14px" }}>{statusBadge(b.status)}</td>
                    <td style={{ padding: "12px 14px", fontFamily: "var(--font-mono)", fontWeight: 600, color: colors.ink }}>
                      £{b.totalPaid.toFixed(2)}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <Link href={`/admin/bookings/${b.id}`} style={{
                        display: "inline-block", padding: "4px 12px",
                        background: "#F1F5F9", borderRadius: 6,
                        fontSize: 12, fontWeight: 600, color: colors.ink,
                      }}>
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {recentBookings.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 32, textAlign: "center", color: colors.muted }}>No bookings yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: 16, fontWeight: 700, color: colors.ink, marginBottom: 14 }}>
          Quick Actions
        </h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { label: "Add Driver",       href: "/admin/drivers" },
            { label: "View Job Board",   href: "/admin/jobs" },
          ].map(({ label, href }) => (
            <Link key={href} href={href} style={{
              display: "inline-block",
              padding: "10px 20px",
              background: colors.emerald,
              color: "white",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              textDecoration: "none",
            }}>
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
