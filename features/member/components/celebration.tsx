"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ConfettiPiece = {
  id: number;
  x: number;
  y: number;
  rotation: number;
  color: string;
  size: number;
  delay: number;
};

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#f59e0b", "#ec4899", "#16a34a", "#dc2626", "#8b5cf6"];

function generatePieces(count: number): ConfettiPiece[] {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -(Math.random() * 40 + 10),
    rotation: Math.random() * 360,
    color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? "#6366f1",
    size: Math.random() * 8 + 4,
    delay: Math.random() * 0.5
  }));
}

type CelebrationProps = {
  show: boolean;
  onComplete?: () => void;
  message?: string;
};

export function Celebration({ show, onComplete, message }: CelebrationProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (show) {
      setPieces(generatePieces(60));
      const timer = setTimeout(() => {
        if (onComplete) onComplete();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 pointer-events-none z-[200]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {pieces.map((piece) => (
            <motion.div
              key={piece.id}
              className="absolute rounded-sm"
              style={{
                left: `${piece.x}%`,
                top: `${piece.y}%`,
                width: piece.size,
                height: piece.size * 0.6,
                backgroundColor: piece.color,
                rotate: piece.rotation
              }}
              initial={{ y: -100, opacity: 1, rotate: 0 }}
              animate={{
                y: typeof window !== "undefined" ? window.innerHeight + 100 : 1000,
                opacity: [1, 1, 0],
                rotate: piece.rotation + 720,
                x: [0, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 300]
              }}
              transition={{
                duration: 2 + Math.random(),
                delay: piece.delay,
                ease: [0.1, 0.25, 0.3, 1]
              }}
            />
          ))}
          {message && (
            <motion.div
              className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.3 }}
            >
              <div className="inline-block rounded-2xl bg-surface/90 backdrop-blur-lg border border-accent/30 px-8 py-5 shadow-premium-lg">
                <p className="text-2xl font-black gradient-text">🎉</p>
                <p className="mt-2 text-lg font-black">{message}</p>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useCelebration() {
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");

  const celebrate = useCallback((msg?: string) => {
    setMessage(msg ?? "");
    setShow(true);
  }, []);

  const dismiss = useCallback(() => {
    setShow(false);
  }, []);

  return { show, message, celebrate, dismiss };
}
