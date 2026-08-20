"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiBell, FiBellOff, FiX } from "react-icons/fi";
import { colors } from "@/lib/tokens";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  href?: string;
  isRead: boolean;
  createdAt: string;
}

const MotionDiv = motion.div;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevUnreadRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) return;
      const data = await res.json() as { notifications: Notification[]; unreadCount: number };
      setNotifications(data.notifications);

      // Play sound if new unreads arrived
      if (data.unreadCount > prevUnreadRef.current && prevUnreadRef.current >= 0 && !muted) {
        audioRef.current?.play().catch(() => {});
      }
      prevUnreadRef.current = data.unreadCount;
      setUnreadCount(data.unreadCount);
    } catch {}
  }, [muted]);

  useEffect(() => {
    // Initialize prev ref so first load doesn't trigger sound
    prevUnreadRef.current = -1;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    await fetch("/api/admin/notifications/read", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    prevUnreadRef.current = 0;
  };

  const markOneRead = async (id: string) => {
    await fetch(`/api/admin/notifications/${id}`, { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const timeAgo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* Hidden audio element */}
      <audio ref={audioRef} src="/sounds/notification.mp3" preload="auto" />

      {/* Bell button */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Mute toggle */}
        <button
          onClick={() => setMuted((m) => !m)}
          title={muted ? "Unmute notifications" : "Mute notifications"}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: muted ? "#94A3B8" : colors.emerald,
            display: "flex",
            alignItems: "center",
            padding: 4,
          }}
        >
          {muted ? <FiBellOff size={15} /> : null}
        </button>

        {/* Bell */}
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            position: "relative",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: colors.ink,
            display: "flex",
            alignItems: "center",
            padding: 4,
          }}
        >
          <MotionDiv
            animate={unreadCount > 0 && !open ? { rotate: [0, -15, 15, -10, 10, 0] } : { rotate: 0 }}
            transition={{ duration: 0.6, repeat: unreadCount > 0 ? Infinity : 0, repeatDelay: 4 }}
          >
            <FiBell size={20} />
          </MotionDiv>

          {unreadCount > 0 && (
            <span style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: "#EF4444",
              color: "white",
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
            }}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <MotionDiv
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: 340,
              background: "white",
              border: "1px solid #E2E8F0",
              borderRadius: 12,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              zIndex: 100,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderBottom: "1px solid #F1F5F9",
            }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: colors.ink }}>
                Notifications {unreadCount > 0 && <span style={{ color: "#EF4444" }}>({unreadCount})</span>}
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12,
                      color: colors.emerald,
                      fontWeight: 500,
                    }}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setMuted((m) => !m)}
                  title={muted ? "Unmute" : "Mute"}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: muted ? "#94A3B8" : colors.ink,
                  }}
                >
                  {muted ? <FiBellOff size={14} /> : <FiBell size={14} />}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94A3B8" }}
                >
                  <FiX size={14} />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {notifications.length === 0 ? (
                <div style={{ padding: "24px 16px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
                  No notifications
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => { markOneRead(n.id); if (n.href) window.location.href = n.href; }}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "12px 16px",
                      cursor: "pointer",
                      background: n.isRead ? "transparent" : "rgba(16,185,129,0.04)",
                      borderBottom: "1px solid #F8FAFC",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = n.isRead ? "transparent" : "rgba(16,185,129,0.04)")}
                  >
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: n.isRead ? "transparent" : colors.emerald,
                      flexShrink: 0,
                      marginTop: 5,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: colors.ink, marginBottom: 2 }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4, lineHeight: 1.4 }}>
                        {n.body}
                      </div>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>{timeAgo(n.createdAt)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}
