"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { FiLogOut, FiUser, FiChevronDown } from "react-icons/fi";
import { colors } from "@/lib/tokens";

interface DriverTopBarProps {
  driverName: string;
}

export function DriverTopBar({ driverName }: DriverTopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header style={{
      position: "sticky",
      top: 0,
      zIndex: 50,
      background: colors.midnight,
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      height: 58,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
    }}>
      {/* Logo + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          background: `linear-gradient(135deg, ${colors.emerald}, #2563EB)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-heading)",
          fontWeight: 800,
          fontSize: 15,
          color: "white",
          flexShrink: 0,
        }}>M</div>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14, color: "white", lineHeight: 1.1 }}>
            MA Removals
          </div>
          <div style={{ fontSize: 10, color: colors.emerald, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Driver Portal
          </div>
        </div>
      </div>

      {/* Profile dropdown */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 999,
            padding: "6px 12px 6px 8px",
            cursor: "pointer",
            color: "white",
          }}
        >
          <div style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: colors.emerald,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 700,
            color: "white",
            flexShrink: 0,
          }}>
            {driverName.charAt(0).toUpperCase()}
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {driverName.split(" ")[0]}
          </span>
          <FiChevronDown size={13} style={{ opacity: 0.6 }} />
        </button>

        {menuOpen && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 40 }}
              onClick={() => setMenuOpen(false)}
            />
            <div style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              background: "#1E293B",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              zIndex: 50,
              minWidth: 180,
              overflow: "hidden",
            }}>
              <div style={{
                padding: "14px 16px 10px",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FiUser size={13} color="rgba(255,255,255,0.4)" />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Signed in as</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "white", marginTop: 3 }}>{driverName}</div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/driver-login" })}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 16px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#fca5a5",
                  fontSize: 13,
                  fontWeight: 500,
                  textAlign: "left",
                }}
              >
                <FiLogOut size={14} />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
