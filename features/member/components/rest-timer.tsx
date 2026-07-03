"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw, Timer, Volume2, VolumeX } from "lucide-react";

type RestTimerProps = {
  defaultDuration?: number;
  onComplete?: () => void;
  compact?: boolean;
};

export function RestTimer({ defaultDuration = 60, onComplete, compact = false }: RestTimerProps) {
  const [duration, setDuration] = useState(defaultDuration);
  const [remaining, setRemaining] = useState(defaultDuration);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4B/f3+AgH9/f3+AgH9/f4CAf39/f4CAf39/f4CAf39/f4CAf39/f4B/f3+AgH9/f3+AgH9/f4CAf39/f4CAf39/f4B/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f4B/f3+AgH9/f3+AgH9/f4B/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+AgH9/f3+");
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (remaining <= 0) {
      setRemaining(duration);
    }
    setIsRunning(true);
    clearTimer();
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearTimer();
          setIsRunning(false);
          if (soundEnabled && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          }
          if (onComplete) onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [duration, remaining, clearTimer, soundEnabled, onComplete]);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
    clearTimer();
  }, [clearTimer]);

  const resetTimer = useCallback(() => {
    clearTimer();
    setIsRunning(false);
    setRemaining(duration);
  }, [clearTimer, duration]);

  const progress = duration > 0 ? remaining / duration : 0;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const presetDurations = [30, 45, 60, 90, 120];

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="relative size-12">
          <svg className="size-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="#e4e7dd" strokeWidth="3" />
            <motion.circle
              cx="24" cy="24" r="20" fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 20}
              strokeDashoffset={2 * Math.PI * 20 * (1 - (1 - progress))}
              animate={{ strokeDashoffset: 2 * Math.PI * 20 * (1 - progress) }}
              transition={{ duration: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-black">{minutes}:{seconds.toString().padStart(2, "0")}</span>
          </div>
        </div>
        <button onClick={isRunning ? pauseTimer : startTimer} className="btn-ripple rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white hover:shadow-glow transition-all">
          {isRunning ? "Pause" : "Start"}
        </button>
      </div>
    );
  }

  return (
    <motion.div
      className="rounded-2xl border border-border bg-surface p-6 shadow-premium"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="flex flex-col items-center gap-6">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Rest Timer</p>

        <div className="relative">
          <svg className="size-48 -rotate-90" viewBox="0 0 192 192">
            <circle cx="96" cy="96" r="88" fill="none" stroke="#e4e7dd" strokeWidth="6" />
            <motion.circle
              cx="96" cy="96" r="88" fill="none"
              stroke={progress > 0.3 ? "#6366f1" : "#dc2626"}
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 88}
              strokeDashoffset={2 * Math.PI * 88 * (1 - progress)}
              animate={{ strokeDashoffset: 2 * Math.PI * 88 * (1 - progress) }}
              transition={{ duration: 0.5 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className="text-5xl font-black gradient-text"
              key={`${minutes}:${seconds}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {minutes}:{seconds.toString().padStart(2, "0")}
            </motion.span>
            <span className="mt-1 text-xs font-bold text-muted-foreground">
              {remaining === 0 ? "Done!" : `${remaining}s remaining`}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {presetDurations.map((d) => (
            <button
              key={d}
              onClick={() => { setDuration(d); setRemaining(d); setIsRunning(false); clearTimer(); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                duration === d ? "bg-accent text-white shadow-glow-sm" : "border border-border text-muted-foreground hover:border-accent/50"
              }`}
            >
              {d}s
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={resetTimer} className="rounded-lg border border-border p-2.5 text-muted-foreground hover:text-foreground transition-colors" aria-label="Reset">
            <RotateCcw className="size-5" />
          </button>
          <motion.button
            onClick={isRunning ? pauseTimer : startTimer}
            className="rounded-xl bg-gradient-to-r from-accent to-purple-600 px-6 py-3 text-sm font-bold text-white shadow-glow hover:shadow-glow-lg transition-all btn-ripple"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isRunning ? <Pause className="size-5" /> : <Play className="size-5" />}
          </motion.button>
          <button onClick={() => setSoundEnabled(!soundEnabled)} className="rounded-lg border border-border p-2.5 text-muted-foreground hover:text-foreground transition-colors" aria-label="Toggle sound">
            {soundEnabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
