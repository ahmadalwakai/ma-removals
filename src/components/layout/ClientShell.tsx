"use client";

import { useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PageTransition } from "@/components/shared/PageTransition";
import { VisitorTracker } from "@/components/tracking/VisitorTracker";
import { CookieConsent } from "@/components/layout/CookieConsent";
import { AnalyticsPixels } from "@/components/tracking/AnalyticsPixels";
import { BookingDetectionPopup } from "@/components/booking/BookingDetectionPopup";
import { FloatingActions } from "@/components/shared/FloatingActions";

export function ClientShell({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Admin pages render their own AdminShell — skip public chrome entirely
  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <VisitorTracker />
      <AnalyticsPixels />
      {mounted && <CookieConsent />}
      {mounted && <BookingDetectionPopup />}
      {mounted ? (
        <Navbar />
      ) : (
        <div style={{ height: "72px", background: "#0B1120" }} />
      )}
      <main style={{ minHeight: "calc(100vh - 72px)" }}>
        <PageTransition>{children}</PageTransition>
      </main>
      {mounted ? <Footer /> : null}
      {mounted && <FloatingActions />}
    </>
  );
}


