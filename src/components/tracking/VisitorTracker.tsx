"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const ENABLE_LOCAL_TRACKING =
  process.env.NEXT_PUBLIC_ENABLE_LOCAL_TRACKING === "true";

function shouldTrackVisitors() {
  if (typeof window === "undefined") return false;
  if (ENABLE_LOCAL_TRACKING) return true;

  const host = window.location.hostname;
  return (
    process.env.NODE_ENV === "production" &&
    host !== "localhost" &&
    host !== "127.0.0.1" &&
    host !== "::1" &&
    host !== "[::1]"
  );
}

function getOrCreateSessionId(): string {
  const key = "ma_sid";
  try {
    let sid = sessionStorage.getItem(key);
    if (!sid) {
      sid = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem(key, sid);
    }
    return sid;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

export function VisitorTracker() {
  const pathname = usePathname();
  const sessionRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // Initialize session once on mount
  useEffect(() => {
    if (!shouldTrackVisitors()) return;

    const sid = getOrCreateSessionId();
    sessionRef.current = sid;
    startTimeRef.current = Date.now();

    fetch("/api/tracking/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid,
        landingPage: window.location.pathname,
        referrer: document.referrer || undefined,
      }),
    }).catch(() => {});

    // Heartbeat every 30 seconds while the tab is visible.
    const hb = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/tracking/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid }),
      }).catch(() => {});
    }, 30_000);

    // Exit via sendBeacon for reliability
    const handleUnload = () => {
      const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
      navigator.sendBeacon(
        "/api/tracking/exit",
        JSON.stringify({ sessionId: sid, duration })
      );
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      clearInterval(hb);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (!shouldTrackVisitors()) return;

    const sid = sessionRef.current;
    if (!sid) return;

    fetch("/api/tracking/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid,
        type: "page_view",
        page: pathname,
      }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}

// Standalone helper for button click tracking — import where needed
export function trackClick(element: string, page?: string) {
  if (typeof window !== "undefined" && !shouldTrackVisitors()) return;

  let sid: string | null = null;
  try {
    sid = typeof window !== "undefined" ? sessionStorage.getItem("ma_sid") : null;
  } catch {
    sid = null;
  }
  if (!sid) return;
  fetch("/api/tracking/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: sid,
      type: "button_click",
      page: page ?? window.location.pathname,
      element,
    }),
  }).catch(() => {});
}
