"use client";

import { useState } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopBar } from "./AdminTopBar";

interface Props { children: React.ReactNode; adminName: string; }

export function AdminShell({ children, adminName }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F1F5F9" }}>
      <AdminSidebar
        adminName={adminName}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflowX: "hidden" }}>
        <AdminTopBar adminName={adminName} onMenuClick={() => setMobileOpen(true)} />
        <main style={{ flex: 1, padding: "24px 20px", maxWidth: 1400, width: "100%" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
