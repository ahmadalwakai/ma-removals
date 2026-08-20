"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { FiClipboard, FiTruck, FiStar, FiDollarSign, FiArrowRight } from "react-icons/fi";
import { JobCard } from "@/components/driver/JobCard";
import { PushNotificationPrompt } from "@/components/driver/PushNotificationPrompt";
import { colors } from "@/lib/tokens";

interface DashboardData {
  driver: {
    name: string;
    vehicleType: string;
    licensePlate: string;
    rating: number;
    jobsCompleted: number;
  };
  stats: {
    todayCount: number;
    pendingOffers: number;
    totalCompleted: number;
    earningsThisMonth: number;
  };
  todaysJobs: BookingRow[];
  upcomingJobs: BookingRow[];
}

interface BookingRow {
  id: string;
  reference: string;
  serviceName: string;
  scheduledDate: string;
  scheduledTime: string;
  pickupAddress: string;
  dropoffAddress: string;
  distanceMiles: number;
  quotedPrice: number;
  helpersCount: number;
  notes: string | null;
  status: string;
}

function StatCard({ icon: Icon, label, value, color, href }: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: string | number;
  color: string;
  href?: string;
}) {
  const inner = (
    <div style={{
      background: "#1E293B",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.07)",
      padding: "16px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      textDecoration: "none",
    }}>
      <div style={{
        width: 42,
        height: 42,
        borderRadius: 12,
        background: `${color}20`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "white", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );

  return href ? <Link href={href} style={{ display: "block", textDecoration: "none" }}>{inner}</Link> : <div>{inner}</div>;
}

export default function DriverDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    const res = await fetch("/api/driver/dashboard");
    if (res.ok) setData(await res.json() as DashboardData);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch_();
    const t = setInterval(fetch_, 30_000);
    return () => clearInterval(t);
  }, [fetch_]);

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: "rgba(255,255,255,0.3)" }}>
        Loading…
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 24, color: "#fca5a5", textAlign: "center" }}>
        Failed to load dashboard. Please refresh.
      </div>
    );
  }

  const firstName = data.driver.name?.split(" ")[0] ?? "Driver";

  return (
    <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 24 }}>
      <PushNotificationPrompt />

      {/* Welcome banner */}
      <div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>{today}</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "white", margin: "0 0 2px", fontFamily: "var(--font-heading)" }}>
          {greeting}, {firstName} 👋
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "2px 8px" }}>
            🚐 {data.driver.vehicleType.replace(/_/g, " ")}
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "2px 8px" }}>
            {data.driver.licensePlate}
          </span>
        </div>
      </div>

      {/* Pending offers alert */}
      {data.stats.pendingOffers > 0 && (
        <Link href="/driver/jobs" style={{ textDecoration: "none" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(37,99,235,0.12)",
            border: "1px solid rgba(37,99,235,0.3)",
            borderRadius: 12,
            padding: "14px 16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>📬</span>
              <div>
                <div style={{ fontWeight: 700, color: "#2563EB", fontSize: 14 }}>
                  {data.stats.pendingOffers} job offer{data.stats.pendingOffers > 1 ? "s" : ""} waiting
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Tap to view and respond</div>
              </div>
            </div>
            <FiArrowRight size={18} color="#2563EB" />
          </div>
        </Link>
      )}

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <StatCard icon={FiClipboard} label="Today's jobs"      value={data.stats.todayCount}            color="#2563EB"        href="/driver/my-jobs" />
        <StatCard icon={FiTruck}     label="Total completed"   value={data.stats.totalCompleted}         color={colors.emerald} href="/driver/my-jobs" />
        <StatCard icon={FiStar}      label="Rating"            value={data.driver.rating.toFixed(1)}    color="#2563EB" />
        <StatCard icon={FiDollarSign} label="Earnings (month)" value={`£${data.stats.earningsThisMonth.toFixed(0)}`} color="#A78BFA" />
      </div>

      {/* Today's jobs */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "white", margin: 0, fontFamily: "var(--font-heading)" }}>
            Today&apos;s Jobs
          </h2>
          <Link href="/driver/my-jobs" style={{ fontSize: 12, color: colors.emerald, textDecoration: "none" }}>
            View all →
          </Link>
        </div>

        {data.todaysJobs.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "28px 20px",
            background: "#1E293B",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>No jobs scheduled for today</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {data.todaysJobs.map((job) => (
              <JobCard key={job.id} booking={job}>
                <Link
                  href={`/driver/my-jobs?id=${job.id}`}
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "10px",
                    background: colors.emerald,
                    color: "white",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  View Job Details
                </Link>
              </JobCard>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming this week */}
      {data.upcomingJobs.length > 0 && (
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "white", margin: "0 0 12px", fontFamily: "var(--font-heading)" }}>
            Coming Up This Week
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.upcomingJobs.map((job) => (
              <div
                key={job.id}
                style={{
                  background: "#1E293B",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.06)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                    {new Date(job.scheduledDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · {job.scheduledTime}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "white", marginTop: 2 }}>{job.serviceName}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{job.pickupAddress.split(",")[0]}</div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 800, color: colors.emerald, flexShrink: 0 }}>
                  £{job.quotedPrice.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
