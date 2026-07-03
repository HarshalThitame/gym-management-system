"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { QrCode, CheckCircle2 } from "lucide-react";

type SelfCheckInButtonProps = {
  memberId: string;
};

export function SelfCheckInButton({ memberId }: SelfCheckInButtonProps) {
  const [checkedIn, setCheckedIn] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/attendance/self-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId })
      });
      if (res.ok) setCheckedIn(true);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  if (checkedIn) {
    return (
      <motion.div
        className="flex items-center justify-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-6"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
        >
          <CheckCircle2 className="size-8 text-green-500" />
        </motion.div>
        <div>
          <p className="font-black text-green-800">Checked In!</p>
          <p className="text-sm font-semibold text-green-600">Have a great workout</p>
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
      className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-accent to-purple-600 p-6 text-white shadow-glow hover:shadow-glow-lg transition-all disabled:opacity-70 btn-ripple"
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
          <QrCode className="size-7" />
        </motion.div>
        <div className="text-left">
          <p className="text-lg font-black">{loading ? "Checking in..." : "Check In Now"}</p>
          <p className="text-sm font-semibold text-white/80">Tap to record your gym visit</p>
        </div>
      </div>
    </motion.button>
  );
}
