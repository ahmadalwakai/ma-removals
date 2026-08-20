"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { motion } from "framer-motion";
import { FiUsers, FiActivity, FiEye, FiClock } from "react-icons/fi";
import { ProgressBar } from "@/components/admin/ProgressBar";
import { useCountUp } from "@/hooks/useCountUp";
import { colors, shadows } from "@/lib/tokens";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Analytics {
  activeVisitors: number;
  totalToday: number;
  totalWeek: number;
  pageViewsToday: number;
  topPages: { page: string; count: number }[];
  hourlyTraffic: { hour: number; views: number }[];
  buttonClicks: { element: string; count: number }[];
  deviceBreakdown: { name: string; value: number }[];
  browserBreakdown: { name: string; value: number }[];
  recentVisitors: {
    id: string;
    device: string;
    browser: string;
    landingPage: string | null;
    lastPage: string | null;
    lastSeenAt: string;
    pageCount: number;
    duration: number | null;
    referrer: string | null;
  }[];
}

// ─── Human-readable helpers ──────────────────────────────────────────────────

const PAGE_LABELS: Record<string, string> = {
  "/": "Home",
  "/booking": "Booking",
  "/booking/items": "Booking — Items",
  "/booking/quote": "Booking — Quote",
  "/booking/details": "Booking — Details",
  "/booking/payment": "Booking — Payment",
  "/booking/confirmation": "Booking — Confirmation",
  "/services": "Services",
  "/services/house-removals": "House Removals",
  "/services/office-removals": "Office Removals",
  "/services/man-with-van": "Man & Van",
  "/services/packing": "Packing",
  "/about": "About Us",
  "/contact": "Contact",
  "/quote": "Get a Quote",
};

const ELEMENT_LABELS: Record<string, string> = {
  hero_cta_quote: "Hero CTA — Get Quote",
  hero_cta_services: "Hero CTA — Services",
  nav_quote: "Nav — Quote",
  nav_booking: "Nav — Book Now",
  service_card_cta: "Service Card CTA",
  booking_next: "Booking — Next",
  booking_confirm: "Booking — Confirm",
  contact_submit: "Contact Form — Submit",
};

function labelPage(page: string) {
  return PAGE_LABELS[page] ?? (page.replace(/\//g, " / ").replace(/^\//, "").replace(/-/g, " ") || "Home");
}

function labelElement(element: string) {
  return ELEMENT_LABELS[element] ?? element.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

const MotionDiv = motion.div;

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: number;
  sub?: string;
  color: string;
}) {
  const displayed = useCountUp(value);
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background: "white",
        borderRadius: 16,
        padding: "20px 24px",
        border: "1px solid #E2E8F0",
        flex: "1 1 200px",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12, color: "#64748B", fontWeight: 500, marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: colors.ink, lineHeight: 1 }}>{displayed.toLocaleString()}</div>
          {sub && <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>{sub}</div>}
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${color}18`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Icon size={20} color={color} />
        </div>
      </div>
    </MotionDiv>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "white",
      borderRadius: 16,
      border: "1px solid #E2E8F0",
      boxShadow: shadows.card,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "16px 24px",
        borderBottom: "1px solid #F1F5F9",
        fontFamily: "var(--font-heading)",
        fontWeight: 700,
        fontSize: 15,
        color: colors.ink,
      }}>
        {title}
      </div>
      <div style={{ padding: "20px 24px" }}>
        {children}
      </div>
    </div>
  );
}

// ─── Chart colors ─────────────────────────────────────────────────────────────

const PALETTE = ["#2563EB", "#2563EB", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VisitorsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/visitors");
      if (res.ok) {
        const json = await res.json() as Analytics;
        setData(json);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400, color: "#94A3B8" }}>
        Loading analytics…
      </div>
    );
  }

  if (!data) return null;

  const maxPageCount = data.topPages[0]?.count ?? 1;
  const maxClickCount = data.buttonClicks[0]?.count ?? 1;

  const hourlyLabels = data.hourlyTraffic.map((h) => ({
    ...h,
    label: h.hour < 12 ? `${h.hour || 12}am` : `${h.hour === 12 ? 12 : h.hour - 12}pm`,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "0 0 40px" }}>

      {/* Active visitors banner */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "rgba(37,99,235,0.08)",
        border: "1px solid rgba(37,99,235,0.25)",
        borderRadius: 12,
        padding: "12px 20px",
      }}>
        <span style={{
          width: 10, height: 10, borderRadius: "50%",
          background: colors.emerald,
          boxShadow: `0 0 0 3px rgba(16,185,129,0.25)`,
          animation: "pulse 2s infinite",
          flexShrink: 0,
        }} />
        <style>{`@keyframes pulse { 0%,100%{ box-shadow:0 0 0 3px rgba(16,185,129,.25) } 50%{ box-shadow:0 0 0 6px rgba(16,185,129,0) } }`}</style>
        <span style={{ fontWeight: 700, color: colors.emerald, fontSize: 15 }}>{data.activeVisitors}</span>
        <span style={{ fontSize: 14, color: "#334155" }}>
          visitor{data.activeVisitors !== 1 ? "s" : ""} active right now (updated every 10s)
        </span>
      </div>

      {/* Row 1 — KPI cards */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <KpiCard icon={FiUsers}    label="Visitors Today"      value={data.totalToday}       color={colors.emerald} />
        <KpiCard icon={FiActivity} label="Visitors This Week"  value={data.totalWeek}        color="#2563EB" />
        <KpiCard icon={FiEye}      label="Page Views Today"    value={data.pageViewsToday}   color="#2563EB" />
        <KpiCard icon={FiClock}    label="Active Right Now"    value={data.activeVisitors}   color="#EF4444" sub="last 5 minutes" />
      </div>

      {/* Row 2 — Visits over time */}
      <Section title="Visits Over Time (last 24h — by hour)">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hourlyLabels} margin={{ top: 0, right: 0, bottom: 0, left: -24 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#94A3B8" }}
              interval={2}
              axisLine={false}
              tickLine={false}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12 }}
              cursor={{ fill: "rgba(16,185,129,0.06)" }}
            />
            <Bar dataKey="views" fill={colors.emerald} radius={[4, 4, 0, 0]} name="Page views" />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      {/* Row 3 — Top pages */}
      <Section title="Top Pages (last 7 days)">
        {data.topPages.length === 0 ? (
          <div style={{ color: "#94A3B8", fontSize: 13 }}>No data yet</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {data.topPages.map((p) => (
              <div key={p.page}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: colors.ink }}>{labelPage(p.page)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: colors.emerald }}>{p.count.toLocaleString()}</span>
                </div>
                <ProgressBar value={p.count} max={maxPageCount} color={colors.emerald} height={6} showGlow={p.count === maxPageCount} />
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Row 4 — Active visitor table */}
      <Section title={`Live Visitors (${data.recentVisitors.length})`}>
        {data.recentVisitors.length === 0 ? (
          <div style={{ color: "#94A3B8", fontSize: 13 }}>No active visitors at the moment</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "#94A3B8", fontWeight: 600, textAlign: "left" }}>
                  {["Landing Page", "Last Page", "Device", "Browser", "Pages", "Duration", "Last seen"].map((h) => (
                    <th key={h} style={{ padding: "0 12px 10px 0", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentVisitors.map((v) => (
                  <tr key={v.id} style={{ borderTop: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "10px 12px 10px 0", color: colors.ink, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{labelPage(v.landingPage ?? "/")}</td>
                    <td style={{ padding: "10px 12px 10px 0", color: "#64748B", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{labelPage(v.lastPage ?? "/")}</td>
                    <td style={{ padding: "10px 12px 10px 0", color: "#64748B", textTransform: "capitalize" }}>{v.device}</td>
                    <td style={{ padding: "10px 12px 10px 0", color: "#64748B" }}>{v.browser}</td>
                    <td style={{ padding: "10px 12px 10px 0", color: "#64748B", textAlign: "center" }}>{v.pageCount}</td>
                    <td style={{ padding: "10px 12px 10px 0", color: "#64748B" }}>{formatDuration(v.duration)}</td>
                    <td style={{ padding: "10px 0 10px 0", color: "#94A3B8", fontSize: 12 }}>{timeAgo(v.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Row 5 — Button click heatmap */}
      <Section title="Button Clicks (last 7 days)">
        {data.buttonClicks.length === 0 ? (
          <div style={{ color: "#94A3B8", fontSize: 13 }}>No button click data yet</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {data.buttonClicks.map((b, i) => (
              <div key={b.element}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: colors.ink }}>{labelElement(b.element)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#2563EB" }}>{b.count.toLocaleString()}</span>
                </div>
                <ProgressBar value={b.count} max={maxClickCount} color={PALETTE[i % PALETTE.length]!} height={6} />
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Row 6 — Device + Browser donut charts */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 300px", minWidth: 0, background: "white", borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: shadows.card }}>
          <div style={{ padding: "16px 24px 0", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 15, color: colors.ink }}>
            Device Breakdown
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data.deviceBreakdown}
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.deviceBreakdown.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ flex: "1 1 300px", minWidth: 0, background: "white", borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: shadows.card }}>
          <div style={{ padding: "16px 24px 0", fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 15, color: colors.ink }}>
            Browser Breakdown
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data.browserBreakdown}
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.browserBreakdown.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
