"use client";

import { motion } from "framer-motion";

const MotionDiv = motion.div;

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  height?: number;
  animated?: boolean;
  showGlow?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  color = "#2563EB",
  height = 8,
  animated = true,
  showGlow = false,
}: ProgressBarProps) {
  const percentage = Math.min((value / (max || 1)) * 100, 100);

  return (
    <div
      style={{
        width: "100%",
        height,
        background: "rgba(255,255,255,0.08)",
        borderRadius: 9999,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <MotionDiv
        style={{
          height: "100%",
          background: color,
          borderRadius: 9999,
          position: "relative",
        }}
        initial={animated ? { width: "0%" } : { width: `${percentage}%` }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
      >
        {showGlow && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: color,
              boxShadow: `0 0 8px 2px ${color}`,
            }}
          />
        )}
      </MotionDiv>
    </div>
  );
}
