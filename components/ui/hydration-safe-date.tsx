"use client";

import { useEffect, useState } from "react";

type Props = {
  date: string | Date;
  format?: "date" | "datetime" | "time";
  fallback?: string;
};

export function HydrationSafeDate({ date, format = "date", fallback = "-" }: Props) {
  const [formatted, setFormatted] = useState(fallback);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      try {
        const d = typeof date === "string" ? new Date(date) : date;
        switch (format) {
          case "datetime":
            setFormatted(d.toLocaleString());
            break;
          case "time":
            setFormatted(d.toLocaleTimeString());
            break;
          default:
            setFormatted(d.toLocaleDateString());
        }
      } catch {
        setFormatted(fallback);
      }
    }
  }, [date, format, fallback, mounted]);

  return <>{formatted}</>;
}
