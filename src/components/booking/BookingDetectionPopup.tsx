"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiMapPin } from "react-icons/fi";
import { colors } from "@/lib/tokens";

interface ActiveBooking {
  reference: string;
  service: string;
  date: string;
  time: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmed ✅",
  IN_PROGRESS: "In Progress 🚛",
};

const DISMISSED_KEY = "ma-booking-popup-dismissed";
const EMAIL_KEY = "ma-booking-email";

export function BookingDetectionPopup() {
  const [booking, setBooking] = useState<ActiveBooking | null>(null);
  const [show, setShow] = useState(false);
  const pathname = usePathname();

  // Don't show on these pages
  const excluded = ["/book", "/admin", "/driver", "/auth"];
  const isExcluded = excluded.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (isExcluded) return;

    try {
      const dismissed = sessionStorage.getItem(DISMISSED_KEY);
      if (dismissed) return;

      const email = localStorage.getItem(EMAIL_KEY);
      if (!email) return;

      fetch(`/api/booking/check?email=${encodeURIComponent(email)}`)
        .then((r) => r.json())
        .then(
          (data: {
            hasActiveBooking: boolean;
            booking?: ActiveBooking;
          }) => {
            if (data.hasActiveBooking && data.booking) {
              setBooking(data.booking);
              setShow(true);
            }
          }
        )
        .catch(() => {});
    } catch {}
  }, [isExcluded]);

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && booking && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={dismiss}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(4px)",
              zIndex: 9990,
            }}
          />

          {/* Panel — bottom sheet on mobile, centered on desktop */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 9991,
              background: "white",
              borderRadius: "20px 20px 0 0",
              padding: "24px 20px 32px",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
              maxWidth: 480,
              margin: "0 auto",
            }}
          >
            {/* Drag handle */}
            <div
              style={{
                width: 36,
                height: 4,
                background: "#E2E8F0",
                borderRadius: 2,
                margin: "0 auto 20px",
              }}
            />

            {/* Close */}
            <button
              onClick={dismiss}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94A3B8",
                padding: 4,
              }}
              aria-label="Close"
            >
              <FiX size={18} />
            </button>

            {/* Icon */}
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>

            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: 20,
                fontWeight: 800,
                color: colors.ink,
                margin: "0 0 6px",
              }}
            >
              Welcome Back!
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "#64748B",
                margin: "0 0 16px",
              }}
            >
              You have an active booking:
            </p>

            {/* Booking card */}
            <div
              style={{
                background: "#F8FAFC",
                border: "1.5px solid #E2E8F0",
                borderRadius: 12,
                padding: "14px 16px",
                marginBottom: 20,
              }}
            >
              <p
                style={{
                  margin: "0 0 4px",
                  fontWeight: 700,
                  fontSize: 15,
                  color: colors.ink,
                }}
              >
                {booking.service}
              </p>
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  color: "#64748B",
                }}
              >
                {booking.reference}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  fontSize: 13,
                  color: "#64748B",
                  flexWrap: "wrap",
                }}
              >
                <span>📅 {booking.date}</span>
                <span>⏰ {booking.time}</span>
              </div>
              <div style={{ marginTop: 8 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: colors.emerald,
                    background: "rgba(16,185,129,0.1)",
                    padding: "3px 10px",
                    borderRadius: 20,
                  }}
                >
                  Status: {STATUS_LABEL[booking.status] ?? booking.status}
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              <a
                href={`/booking/track?ref=${booking.reference}`}
                style={{
                  flex: 1,
                  display: "block",
                  padding: "12px 0",
                  background: colors.emerald,
                  color: "white",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 14,
                  textAlign: "center",
                  textDecoration: "none",
                }}
                onClick={dismiss}
              >
                Track Booking
              </a>
              <button
                onClick={dismiss}
                style={{
                  flex: 1,
                  padding: "12px 0",
                  background: "#F1F5F9",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 14,
                  color: "#64748B",
                  cursor: "pointer",
                }}
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
