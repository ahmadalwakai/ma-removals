"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { colors } from "@/lib/tokens";

const CONSENT_KEY = "ma-cookie-consent";
const CONSENT_EVENT = "ma-cookie-consent-change";

export function CookieConsent() {
  const [show, setShow] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (!stored) setShow(true);
    } catch {}
  }, []);

  useEffect(() => {
    const updateCompact = () => setCompact(window.innerWidth < 640);
    updateCompact();
    window.addEventListener("resize", updateCompact);
    return () => window.removeEventListener("resize", updateCompact);
  }, []);

  const accept = (type: "all" | "essential") => {
    try {
      localStorage.setItem(CONSENT_KEY, type);
      window.dispatchEvent(new Event(CONSENT_EVENT));
    } catch {}
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 30 }}
          style={{
            position: "fixed",
            bottom: compact ? 12 : 0,
            left: compact ? 12 : 0,
            right: compact ? 12 : 0,
            zIndex: 9999,
            background: "white",
            boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
            borderRadius: compact ? 12 : 0,
            padding: compact ? "12px" : "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexDirection: compact ? "column" : "row",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: compact ? 12 : 14,
                  lineHeight: 1.45,
                  color: "#334155",
                  flex: 1,
                  minWidth: compact ? 0 : 220,
                }}
              >
                We use cookies to improve your experience and analyse site
                traffic.{" "}
                <a
                  href="/privacy"
                  style={{ color: colors.emerald, textDecoration: "none" }}
                >
                  Privacy Policy
                </a>
              </p>
              <div style={{ display: "flex", flexDirection: compact ? "column" : "row", gap: 8, flexShrink: 0, width: compact ? "100%" : "auto" }}>
                <button
                  onClick={() => accept("essential")}
                  style={{
                    flex: compact ? "none" : "initial",
                    width: compact ? "100%" : "auto",
                    padding: compact ? "9px 10px" : "9px 18px",
                    borderRadius: 8,
                    border: "1.5px solid #E2E8F0",
                    background: "white",
                    fontSize: compact ? 12 : 13,
                    fontWeight: 600,
                    color: "#64748B",
                    cursor: "pointer",
                  }}
                >
                  Essential Only
                </button>
                <button
                  onClick={() => accept("all")}
                  style={{
                    flex: compact ? "none" : "initial",
                    width: compact ? "100%" : "auto",
                    padding: compact ? "9px 10px" : "9px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: colors.amber,
                    fontSize: compact ? 12 : 13,
                    fontWeight: 700,
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  Accept All
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
