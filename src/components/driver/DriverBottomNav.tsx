"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiGrid, FiClipboard, FiTruck, FiMessageSquare } from "react-icons/fi";
import { colors } from "@/lib/tokens";

const TABS = [
  { label: "Dashboard",  href: "/driver/dashboard", icon: FiGrid },
  { label: "Available",  href: "/driver/jobs",       icon: FiClipboard },
  { label: "My Jobs",    href: "/driver/my-jobs",    icon: FiTruck },
  { label: "Messages",   href: "/driver/messages",   icon: FiMessageSquare },
];

export function DriverBottomNav() {
  const pathname = usePathname();

  return (
    <nav style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      background: colors.midnight,
      borderTop: "1px solid rgba(255,255,255,0.08)",
      display: "flex",
      height: 64,
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {TABS.map(({ label, href, icon: Icon }) => {
        const active = href === "/driver/dashboard"
          ? pathname === href
          : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              textDecoration: "none",
              color: active ? colors.emerald : "rgba(255,255,255,0.4)",
              transition: "color 0.15s",
              position: "relative",
            }}
          >
            {active && (
              <div style={{
                position: "absolute",
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: 28,
                height: 2,
                background: colors.emerald,
                borderRadius: "0 0 2px 2px",
              }} />
            )}
            <Icon size={20} />
            <span style={{
              fontSize: 10,
              fontWeight: active ? 700 : 500,
              lineHeight: 1,
            }}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
