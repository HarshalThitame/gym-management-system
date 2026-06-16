"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRtl } from "@/features/organization-owner/lib/rtl-provider";
import { TextSelect } from "lucide-react";

export function RtlToggleClient() {
  const { toggleDir, dir } = useRtl();
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const btn = ref.current;
    if (!btn) return;
    btn.removeAttribute("disabled");
    btn.setAttribute(
      "aria-label",
      dir === "ltr" ? "Switch to RTL" : "Switch to LTR"
    );
  }, [dir]);

  const handleClick = useCallback(() => { toggleDir(); }, [toggleDir]);

  return (
    <button
      ref={ref}
      className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      onClick={handleClick}
      type="button"
      disabled
      aria-label="Toggle direction"
    >
      <TextSelect className="size-5" />
    </button>
  );
}
