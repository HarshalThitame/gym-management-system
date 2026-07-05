"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, LocateFixed } from "lucide-react";

type SelfCheckInButtonProps = {
  memberId: string;
};

export function SelfCheckInButton({ memberId }: SelfCheckInButtonProps) {
  const [checkedIn, setCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleCheckIn = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const location = await getCurrentPosition();
      const res = await fetch("/api/attendance/self-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          latitude: location?.coords.latitude ?? undefined,
          longitude: location?.coords.longitude ?? undefined,
          accuracyM: location?.coords.accuracy ?? undefined,
        })
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        setCheckedIn(true);
        setMessage("Check-in recorded.");
        return;
      }
      setMessage(json?.error?.message ?? "Check-in failed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Check-in failed.");
    } finally {
      setLoading(false);
    }
  };

  if (checkedIn) {
    return (
      <motion.div
        className="flex items-center justify-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
        >
          <CheckCircle2 className="size-8 text-emerald-400" />
        </motion.div>
        <div>
          <p className="font-black text-emerald-300">Checked In!</p>
          <p className="text-sm font-semibold text-emerald-400/80">Have a great workout</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.button
      onClick={handleCheckIn}
      disabled={loading}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="relative w-full overflow-hidden rounded-2xl gradient-accent-bpp-bg p-6 text-white shadow-[0_12px_40px_rgba(30,136,255,0.2)] hover:shadow-[0_12px_40px_rgba(30,136,255,0.35)] transition-all disabled:opacity-70 btn-ripple"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
        <div className="absolute inset-0 bg-gradient-mesh opacity-20" />
        <div className="relative z-10 flex items-center justify-center gap-4">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <LocateFixed className="size-7" />
          </motion.div>
          <div className="text-left">
            <p className="text-lg font-black">{loading ? "Checking in..." : "Check In Now"}</p>
            <p className="text-sm font-semibold text-white/80">Tap to record your gym visit with location verification</p>
          </div>
        </div>
        {message ? <p className="relative z-10 mt-4 text-left text-xs font-semibold text-white/85">{message}</p> : null}
      </motion.button>
    );
  }

function getCurrentPosition() {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(new Error("Location services are unavailable in this browser."));
  }

  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    });
  });
}
