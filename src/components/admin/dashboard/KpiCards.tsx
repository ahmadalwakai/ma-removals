"use client";

import { useEffect, useRef, useState } from "react";
import { colors } from "@/lib/tokens";

interface KpiData {
  totalBookings: number;
  thisMonthBookings: number;
  lastMonthBookings: number;
  revenueNow: number;
  revenuePrev: number;
  activeDrivers: number;
  pendingCount: number;
}

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * ease));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);
  return value;
}

function trendPct(now: number, prev: number) {
  if (prev === 0) return null;
  return ((now - prev) / prev) * 100;
}

function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: up ? colors.emerald : colors.crimson, marginTop: 4, display: "block" }}>
      {up ? "↑" : "↓"} {Math.abs(pct).toFixed(1)}% vs last month
    </span>
  );
}

function KpiCard({ label, value, prefix = "", suffix = "", trend, accent }: {
  label: string; value: number; prefix?: string; suffix?: string;
  trend: number | null; accent: string;
}) {
  const display = useCountUp(value);
  return (
    <div style={{
      background: "white",
      borderRadius: 12,
      border: "1px solid #E2E8F0",
      borderTop: `3px solid ${accent}`,
      padding: "20px 20px 16px",
      flex: "1 1 200px",
      minWidth: 0,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: colors.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 700, color: colors.ink }}>
        {prefix}{display.toLocaleString()}{suffix}
      </div>
      <Trend pct={trend} />
    </div>
  );
}

export function KpiCards({ data }: { data: KpiData }) {
  const revTrend = trendPct(data.revenueNow, data.revenuePrev);
  const bookTrend = trendPct(data.thisMonthBookings, data.lastMonthBookings);

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <KpiCard
        label="Total Bookings"
        value={data.totalBookings}
        trend={bookTrend}
        accent={colors.emerald}
      />
      <KpiCard
        label="Revenue (this month)"
        value={Math.round(data.revenueNow)}
        prefix="£"
        trend={revTrend}
        accent="#2563EB"
      />
      <KpiCard
        label="Active Drivers"
        value={data.activeDrivers}
        trend={null}
        accent="#6366F1"
      />
      <KpiCard
        label="Pending Bookings"
        value={data.pendingCount}
        trend={null}
        accent={colors.crimson}
      />
    </div>
  );
}
