"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { colors } from "@/lib/tokens";

const PROMPT_KEY = "ma-push-prompted";

export function PushNotificationPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    try {
      const already = localStorage.getItem(PROMPT_KEY);
      if (already) return;
    } catch {}

    // Delay 3 seconds so it doesn't appear immediately
    const t = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const enable = async () => {
    try {
      localStorage.setItem(PROMPT_KEY, "1");
    } catch {}
    setShow(false);
    if (!("Notification" in window)) return;
    await Notification.requestPermission();
  };

  const dismiss = () => {
    try {
      localStorage.setItem(PROMPT_KEY, "1");
    } catch {}
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          style={{
            position: "fixed",
            bottom: 80, // above bottom nav
            left: 16,
            right: 16,
            background: "#1E293B",
            borderRadius: 14,
            padding: "16px 18px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            zIndex: 1000,
            maxWidth: 400,
            margin: "0 auto",
          }}
        >
          <p
            style={{
              margin: "0 0 4px",
              fontWeight: 800,
              fontSize: 15,
              color: "white",
              fontFamily: "var(--font-heading)",
            }}
          >
            🔔 Enable Notifications?
          </p>
          <p
            style={{
              margin: "0 0 14px",
              fontSize: 13,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.5,
            }}
          >
            Get alerts when new jobs are posted or you receive a message.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={enable}
              style={{
                flex: 1,
                padding: "10px 0",
                background: colors.emerald,
                border: "none",
                borderRadius: 8,
                color: "white",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Enable
            </button>
            <button
              onClick={dismiss}
              style={{
                flex: 1,
                padding: "10px 0",
                background: "rgba(255,255,255,0.08)",
                border: "none",
                borderRadius: 8,
                color: "rgba(255,255,255,0.6)",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Not Now
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function showBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  new Notification(title, {
    body,
    icon: "/logo-mark.png",
    badge: "/logo-mark.png",
  });
}
