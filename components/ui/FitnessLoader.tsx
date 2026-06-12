"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const taglines = [
  "POWERING UP",
  "GETTING PUMPED",
  "LIFTING YOUR EXPERIENCE",
  "PUSHING LIMITS",
  "BUILDING STRENGTH",
  "STAYING STRONG",
];

const BAR_COLOR = "var(--foreground)";
const ACCENT_COLOR = "var(--color-accent, #c8f24a)";
const MUTED_COLOR = "var(--muted, #737780)";

function Dumbbell() {
  return (
    <motion.svg
      width="120"
      height="60"
      viewBox="0 0 120 60"
      fill="none"
      animate={{ rotate: [-8, 8, -8] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      style={{ originX: "50%", originY: "50%" }}
    >
      <defs>
        <linearGradient id="plateGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT_COLOR} />
          <stop offset="100%" stopColor={ACCENT_COLOR} stopOpacity="0.6" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Left outer plate */}
      <rect x="8" y="18" width="10" height="24" rx="3" fill="url(#plateGrad)" filter="url(#glow)" />
      {/* Left inner plate */}
      <rect x="22" y="14" width="10" height="32" rx="3" fill="url(#plateGrad)" filter="url(#glow)" />

      {/* Handle bar */}
      <rect x="32" y="25" width="56" height="10" rx="5" fill={BAR_COLOR} />

      {/* Right inner plate */}
      <rect x="88" y="14" width="10" height="32" rx="3" fill="url(#plateGrad)" filter="url(#glow)" />
      {/* Right outer plate */}
      <rect x="102" y="18" width="10" height="24" rx="3" fill="url(#plateGrad)" filter="url(#glow)" />

      {/* Collar markers */}
      <rect x="34" y="23" width="4" height="14" rx="1" fill={MUTED_COLOR} />
      <rect x="82" y="23" width="4" height="14" rx="1" fill={MUTED_COLOR} />
    </motion.svg>
  );
}

function PulseRing() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        className="size-28 rounded-full border-2"
        style={{ borderColor: ACCENT_COLOR }}
        animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute size-36 rounded-full border"
        style={{ borderColor: ACCENT_COLOR }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0, 0.2] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
      />
    </div>
  );
}

function PulseLine() {
  return (
    <svg width="200" height="32" viewBox="0 0 200 32" className="overflow-visible">
      <defs>
        <linearGradient id="pulseGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={ACCENT_COLOR} stopOpacity="0" />
          <stop offset="20%" stopColor={ACCENT_COLOR} stopOpacity="1" />
          <stop offset="80%" stopColor={ACCENT_COLOR} stopOpacity="1" />
          <stop offset="100%" stopColor={ACCENT_COLOR} stopOpacity="0" />
        </linearGradient>
      </defs>

      <motion.path
        d="M0 24 L40 24 L55 8 L70 24 L85 24 L100 8 L115 24 L130 24 L145 8 L160 24 L200 24"
        stroke="url(#pulseGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      />

    </svg>
  );
}

export function FitnessLoader({ fullPage = true, className }: { fullPage?: boolean; className?: string }) {
  const [tagIndex, setTagIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTagIndex((prev) => (prev + 1) % taglines.length);
    }, 2600);
    return () => clearInterval(interval);
  }, []);

  const content = (
    <div className={`flex flex-col items-center justify-center gap-8 ${className ?? ""}`}>
      {/* Animated dumbbell with pulse rings */}
      <div className="relative flex items-center justify-center">
        <PulseRing />
        <Dumbbell />
      </div>

      {/* Pulse line */}
      <div className="h-8">
        <PulseLine />
      </div>

      {/* Cycling tagline */}
      <div className="relative h-8 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={taglines[tagIndex]}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="text-xs font-black tracking-[0.2em]"
            style={{ color: ACCENT_COLOR }}
          >
            {taglines[tagIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        {content}
      </div>
    );
  }

  return content;
}
