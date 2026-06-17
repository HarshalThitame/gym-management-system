"use client";

import { useState, useEffect, useCallback } from "react";

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

type ScriptStatus = "loading" | "loaded" | "error";

export function useRazorpayScript(): ScriptStatus {
  const [status, setStatus] = useState<ScriptStatus>("loading");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.Razorpay) {
      setStatus("loaded");
      return;
    }

    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => setStatus("loaded"));
      existing.addEventListener("error", () => setStatus("error"));
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => setStatus("loaded");
    script.onerror = () => setStatus("error");
    document.body.appendChild(script);

    return () => {
      // Cleanup not needed; script stays in DOM
    };
  }, []);

  return status;
}

export type { ScriptStatus };
