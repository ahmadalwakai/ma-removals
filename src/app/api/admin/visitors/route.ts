import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - 5 * 60 * 1000); // 5-min active window
  const day7ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const day1ago = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    activeVisitors,
    totalToday,
    totalWeek,
    pageViewsToday,
    topPages,
    hourlyData,
    buttonClicks,
    deviceBreakdown,
    browserBreakdown,
    recentVisitors,
  ] = await Promise.all([
    // Active now (heartbeat within 5 min)
    db.visitor.count({ where: { isActive: true, lastSeenAt: { gte: cutoff } } }),

    // Unique visitors today
    db.visitor.count({ where: { createdAt: { gte: day1ago } } }),

    // Unique visitors past 7 days
    db.visitor.count({ where: { createdAt: { gte: day7ago } } }),

    // Page views today
    db.visitorEvent.count({ where: { type: "page_view", createdAt: { gte: day1ago } } }),

    // Top pages (last 7 days)
    db.visitorEvent.groupBy({
      by: ["page"],
      where: { type: "page_view", createdAt: { gte: day7ago } },
      _count: { page: true },
      orderBy: { _count: { page: "desc" } },
      take: 10,
    }),

    // Hourly traffic today (raw events)
    db.visitorEvent.findMany({
      where: { type: "page_view", createdAt: { gte: day1ago } },
      select: { createdAt: true },
    }),

    // Button clicks (last 7 days)
    db.visitorEvent.groupBy({
      by: ["element"],
      where: { type: "button_click", createdAt: { gte: day7ago }, element: { not: null } },
      _count: { element: true },
      orderBy: { _count: { element: "desc" } },
      take: 15,
    }),

    // Device breakdown (last 7 days)
    db.visitor.groupBy({
      by: ["device"],
      where: { createdAt: { gte: day7ago } },
      _count: { device: true },
    }),

    // Browser breakdown (last 7 days)
    db.visitor.groupBy({
      by: ["browser"],
      where: { createdAt: { gte: day7ago } },
      _count: { browser: true },
    }),

    // Recent active visitors for table
    db.visitor.findMany({
      where: { isActive: true, lastSeenAt: { gte: cutoff } },
      orderBy: { lastSeenAt: "desc" },
      take: 20,
      include: {
        events: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { page: true, createdAt: true },
        },
      },
    }),
  ]);

  // Build hourly buckets (0–23)
  const hourBuckets = Array.from({ length: 24 }, (_, i) => ({ hour: i, views: 0 }));
  for (const e of hourlyData) {
    const h = new Date(e.createdAt).getHours();
    hourBuckets[h]!.views++;
  }

  return NextResponse.json({
    activeVisitors,
    totalToday,
    totalWeek,
    pageViewsToday,
    topPages: topPages.map((p) => ({ page: p.page, count: p._count.page })),
    hourlyTraffic: hourBuckets,
    buttonClicks: buttonClicks.map((b) => ({ element: b.element ?? "", count: b._count.element })),
    deviceBreakdown: deviceBreakdown.map((d) => ({ name: d.device, value: d._count.device })),
    browserBreakdown: browserBreakdown.map((b) => ({ name: b.browser, value: b._count.browser })),
    recentVisitors: recentVisitors.map((v) => ({
      id: v.id,
      device: v.device,
      browser: v.browser,
      landingPage: v.landingPage,
      lastPage: v.events[0]?.page ?? v.landingPage,
      lastSeenAt: v.lastSeenAt,
      pageCount: v.pageCount,
      duration: v.duration,
      referrer: v.referrer,
    })),
  });
}
