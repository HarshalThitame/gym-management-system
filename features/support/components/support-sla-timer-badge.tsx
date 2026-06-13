"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

type SlaStatus = "good" | "warning" | "breached" | "met";

export function SupportSlaTimerBadge({
  createdAt,
  slaMinutes,
  slaBreached,
}: {
  createdAt: string;
  slaMinutes: number;
  slaBreached?: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const created = new Date(createdAt).getTime();
    const update = () => setElapsed((Date.now() - created) / 60000);
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const remaining = Math.max(0, slaMinutes - elapsed);
  const percent = Math.min(100, Math.round((elapsed / slaMinutes) * 100));

  let status: string = "good";
  if (slaBreached) status = "breached";
  else if (percent >= 80) status = "warning";
  else if (remaining <= 0) status = "breached";

  const colors = {
    good: { bg: "bg-green-50 border-green-200", text: "text-green-700", bar: "bg-green-500" },
    warning: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", bar: "bg-amber-500" },
    breached: { bg: "bg-red-50 border-red-200 animate-pulse", text: "text-red-700", bar: "bg-red-500" },
    met: { bg: "bg-gray-50 border-gray-200", text: "text-gray-500", bar: "bg-gray-400" },
  };

  const c = colors[status as SlaStatus];

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${c.bg}`}>
      {status === "breached" ? (
        <AlertTriangle className="h-3 w-3 text-red-500" />
      ) : status === "met" ? (
        <CheckCircle2 className="h-3 w-3 text-gray-400" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      <div className="flex flex-col">
        <span className={`text-[10px] font-medium ${c.text}`}>
          {status === "breached" ? "SLA Breached" : status === "met" ? "Met" : `${Math.round(remaining)}m left`}
        </span>
        <div className="w-16 h-1 rounded-full bg-white/50 mt-0.5">
          <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${Math.min(100, percent)}%` }} />
        </div>
      </div>
    </div>
  );
}
