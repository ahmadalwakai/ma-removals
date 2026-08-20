"use client";

import { useState, useEffect, useCallback } from "react";
import { Box } from "@chakra-ui/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { heroImages } from "@/lib/hero-images";

const MotionBox = motion.create(Box);

const INTERVAL = 5000;
const FADE_DURATION = 1.2;
const ZOOM_DURATION = 8;
const ZOOM_SCALE = 1.06;

// Mobile: first 12 images, slower interval
const MOBILE_COUNT = 12;
const MOBILE_INTERVAL = 6000;

export function HeroSlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const shouldReduce = useReducedMotion();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const activeImages = isMobile ? heroImages.slice(0, MOBILE_COUNT) : heroImages;
  const activeInterval = isMobile ? MOBILE_INTERVAL : INTERVAL;
  // heroImages is a non-empty static array; index is always in-bounds
  const current = activeImages[currentIndex] ?? activeImages[0]!;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % activeImages.length);
  }, [activeImages.length]);

  // Auto-advance
  useEffect(() => {
    if (shouldReduce || isPaused) return;
    const timer = setInterval(nextSlide, activeInterval);
    return () => clearInterval(timer);
  }, [nextSlide, shouldReduce, isPaused, activeInterval]);

  // Preload next image
  useEffect(() => {
    const nextIdx = (currentIndex + 1) % activeImages.length;
    const next = activeImages[nextIdx];
    if (!next) return;
    const img = new window.Image();
    img.src = next.src;
  }, [currentIndex, activeImages]);

  const DOT_COUNT = Math.min(activeImages.length, 8);
  const visibleDots = activeImages.slice(0, DOT_COUNT);

  return (
    <Box
      position="absolute"
      inset={0}
      zIndex={0}
      overflow="hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="popLayout">
        <MotionBox
          key={currentIndex}
          position="absolute"
          inset={0}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_DURATION, ease: "easeInOut" }}
        >
          {/* Ken Burns zoom wrapper */}
          <motion.div
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            initial={shouldReduce ? { scale: 1 } : { scale: ZOOM_SCALE }}
            animate={{ scale: 1 }}
            transition={{ duration: shouldReduce ? 0 : ZOOM_DURATION, ease: "linear" }}
          >
            <Image
              src={current.src}
              alt={current.alt}
              fill
              sizes="100vw"
              style={{ objectFit: "cover" }}
              priority={currentIndex === 0}
              quality={90}
            />
          </motion.div>
        </MotionBox>
      </AnimatePresence>

      {/* Directional scrim — dark behind the copy (left/bottom), image stays visible on the right */}
      <Box
        position="absolute"
        inset={0}
        zIndex={1}
        display={{ base: "none", lg: "block" }}
        style={{
          background:
            "linear-gradient(105deg, rgba(11,17,32,0.72) 0%, rgba(11,17,32,0.52) 32%, rgba(11,17,32,0.22) 62%, rgba(11,17,32,0.06) 100%)",
        }}
        pointerEvents="none"
      />
      {/* Mobile scrim */}
      <Box
        position="absolute"
        inset={0}
        zIndex={1}
        display={{ base: "block", lg: "none" }}
        style={{
          background:
            "linear-gradient(to bottom, rgba(11,17,32,0.45) 0%, rgba(11,17,32,0.32) 45%, rgba(11,17,32,0.50) 100%)",
        }}
        pointerEvents="none"
      />

      {/* Slide progress dots — bottom-left, above scrim */}
      <Box
        position="absolute"
        bottom={6}
        left={6}
        zIndex={3}
        display="flex"
        gap="6px"
        alignItems="center"
        pointerEvents="none"
      >
        {visibleDots.map((_, i) => {
          const active = i === (currentIndex % DOT_COUNT);
          return (
            <Box
              key={i}
              borderRadius="full"
              overflow="hidden"
              style={{
                width: active ? "24px" : "6px",
                height: "6px",
                background: "rgba(255,255,255,0.3)",
                transition: "width 0.35s cubic-bezier(0.4,0,0.2,1), background 0.35s",
              }}
            >
              {active && !shouldReduce && (
                <Box
                  h="full"
                  bg="white"
                  borderRadius="full"
                  style={{
                    animation: `maFill ${activeInterval}ms linear forwards`,
                    animationPlayState: isPaused ? "paused" : "running",
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
