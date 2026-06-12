"use client";

import { Dumbbell } from "lucide-react";

const keyframes = `
@keyframes load-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
@keyframes load-bar {
  0% { transform: translateX(-100%); }
  50% { transform: translateX(100%); }
  100% { transform: translateX(300%); }
}
`;

export function FitnessLoader({ fullPage = true, className }: { fullPage?: boolean; className?: string }) {
  const indicator = (
    <div className={`flex flex-col items-center justify-center ${className ?? ""}`}>
      <style>{keyframes}</style>

      <div className="relative flex items-center justify-center">
        <div
          className="size-10 animate-spin rounded-full border-2"
          style={{
            borderColor: "var(--border)",
            borderTopColor: "var(--color-accent, #c8f24a)",
            animationDuration: "1.5s",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center" style={{ animation: "load-pulse 2.4s ease-in-out infinite" }}>
          <Dumbbell size={16} style={{ color: "var(--color-accent, #c8f24a)" }} />
        </div>
      </div>
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background">
        <div
          className="fixed inset-x-0 top-0 h-[3px] w-full overflow-hidden"
          style={{ background: "var(--border)" }}
        >
          <div
            className="h-full w-1/3 rounded-full"
            style={{
              background: "var(--color-accent, #c8f24a)",
              animation: "load-bar 1.4s ease-in-out infinite",
            }}
          />
        </div>
        {indicator}
      </div>
    );
  }

  return <>{indicator}</>;
}
