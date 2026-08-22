"use client";

import { usePathname } from "next/navigation";
import { FiMenu } from "react-icons/fi";
import { colors } from "@/lib/tokens";
import { NotificationBell } from "@/components/admin/NotificationBell";

const TITLES: Record<string, string> = {
  "/admin":            "Dashboard",
  "/admin/bookings":   "Bookings",
  "/admin/drivers":    "Drivers",
  "/admin/jobs":       "Job Board Control",
  "/admin/content":    "Site Content",
  "/admin/analytics":  "Analytics",
  "/admin/visitors":   "Visitor Analytics",
  "/admin/settings":   "Settings",
};

interface Props { adminName: string; onMenuClick: () => void; }

export function AdminTopBar({ adminName, onMenuClick }: Props) {
  const pathname = usePathname();

  // Find the best matching title (exact or prefix for nested routes)
  const title = Object.entries(TITLES)
    .filter(([k]) => pathname === k || pathname.startsWith(k + "/"))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? "Admin";

  const breadcrumbs: { label: string; href: string }[] = [{ label: "Admin", href: "/admin" }];
  if (title !== "Dashboard") breadcrumbs.push({ label: title, href: pathname });

  return (
    <div style={{
      height: 60,
      background: "white",
      borderBottom: "1px solid #E2E8F0",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 20px",
      flexShrink: 0,
      position: "sticky",
      top: 0,
      zIndex: 10,
    }}>
      {/* Left: hamburger (mobile) + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          className="admin-hamburger"
          onClick={onMenuClick}
          style={{
            background: "transparent", border: "none",
            cursor: "pointer", color: colors.ink,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 4,
          }}
        >
          <FiMenu size={20} />
        </button>
        <div>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 700, color: colors.ink, margin: 0 }}>
            {title}
          </h1>
          <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 1 }}>
            {breadcrumbs.map((b, i) => (
              <span key={b.href} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {i > 0 && <span style={{ color: "#CBD5E0", fontSize: 11 }}>/</span>}
                <a href={b.href} style={{ fontSize: 11, color: i === breadcrumbs.length - 1 ? colors.muted : colors.emerald, textDecoration: "none" }}>
                  {b.label}
                </a>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right: notification bell + admin avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <NotificationBell />
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: `linear-gradient(135deg, ${colors.emerald}, #2563EB)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 13, color: "white",
        }}>
          {adminName.charAt(0).toUpperCase()}
        </div>
        <span style={{ fontSize: 13, fontWeight: 500, color: colors.ink }}>{adminName}</span>
      </div>
    </div>
  );
}
