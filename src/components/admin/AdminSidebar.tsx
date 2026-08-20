"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  FiGrid, FiCalendar, FiUsers, FiDollarSign, FiClipboard,
  FiEdit, FiBarChart2, FiSettings, FiLogOut, FiMenu, FiX, FiEye,
  FiFileText,
} from "react-icons/fi";
import { colors } from "@/lib/tokens";

const NAV = [
  { label: "Dashboard",         href: "/admin",           icon: FiGrid },
  { label: "Bookings",          href: "/admin/bookings",  icon: FiCalendar },
  { label: "Quote Review",      href: "/admin/quotes",    icon: FiFileText },
  { label: "Drivers",           href: "/admin/drivers",   icon: FiUsers },
  { label: "Pricing",           href: "/admin/pricing",   icon: FiDollarSign },
  { label: "Job Board Control", href: "/admin/jobs",      icon: FiClipboard },
  { label: "Site Content",      href: "/admin/content",   icon: FiEdit },
  { label: "Analytics",         href: "/admin/analytics", icon: FiBarChart2 },
  { label: "Visitors",          href: "/admin/visitors",  icon: FiEye },
  { label: "Settings",          href: "/admin/settings",  icon: FiSettings },
];

interface Props { adminName: string; mobileOpen: boolean; onMobileClose: () => void; }

export function AdminSidebar({ adminName, mobileOpen, onMobileClose }: Props) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const sidebarContent = (
    <div style={{
      width: 260,
      minHeight: "100vh",
      background: colors.midnight,
      borderRight: "1px solid rgba(255,255,255,0.08)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
    }}>
      {/* Logo / brand */}
      <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${colors.emerald}, #2563EB)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16, color: "white",
          }}>M</div>
          <div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14, color: "white" }}>
              MA Removals
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>Admin Panel</div>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: "12px 0", overflowY: "auto" }}>
        {NAV.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                color: active ? colors.emerald : "rgba(255,255,255,0.6)",
                borderLeft: active ? `3px solid ${colors.emerald}` : "3px solid transparent",
                background: active ? "rgba(37,99,235,0.06)" : "transparent",
                textDecoration: "none",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer: admin name + logout */}
      <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {adminName}
        </div>
        <button
          onClick={() => void signOut({ callbackUrl: "/" })}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8, color: "rgba(255,255,255,0.5)", cursor: "pointer",
            fontSize: 13, padding: "7px 12px", width: "100%",
          }}
        >
          <FiLogOut size={14} />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="admin-sidebar-desktop">{sidebarContent}</div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
          }}
          onClick={onMobileClose}
        >
          <div onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </div>
          <button
            onClick={onMobileClose}
            style={{
              position: "absolute", top: 16, right: 16,
              background: "rgba(255,255,255,0.1)", border: "none",
              borderRadius: 8, width: 36, height: 36,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "white",
            }}
          >
            <FiX size={18} />
          </button>
        </div>
      )}
    </>
  );
}
