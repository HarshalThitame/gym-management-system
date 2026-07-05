"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type DynamicQrResponse = {
  qrCode: string;
  qrToken: string;
  expiresAt: string;
  refreshAfterSeconds: number;
};

type DynamicAttendanceQrProps = {
  memberId: string;
  fallbackQrSvg: string;
  fallbackExpiresAt?: string | null;
};

export function DynamicAttendanceQr({ memberId, fallbackQrSvg, fallbackExpiresAt }: DynamicAttendanceQrProps) {
  const [qrCode, setQrCode] = useState<string>(fallbackQrSvg);
  const [expiresAt, setExpiresAt] = useState<string | null>(fallbackExpiresAt ?? null);
  const [refreshAfterSeconds, setRefreshAfterSeconds] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    let refreshTimer: ReturnType<typeof window.setTimeout> | null = null;
    const controller = new AbortController();

    const loadQr = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/attendance/dynamic-qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId }),
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load dynamic QR.");
        }

        const data = (await response.json()) as { ok: boolean; data?: DynamicQrResponse };
        if (!data.ok || !data.data || !active) {
          throw new Error("Unable to load dynamic QR.");
        }

        setQrCode(data.data.qrCode);
        setExpiresAt(data.data.expiresAt);
        setRefreshAfterSeconds(data.data.refreshAfterSeconds || 10);
        setLoading(false);

        if (refreshTimer) {
          window.clearTimeout(refreshTimer);
        }
        refreshTimer = window.setTimeout(() => {
          void loadQr();
        }, Math.max((data.data.refreshAfterSeconds || 10) * 1000, 1000));
      } catch (loadError) {
        if (!active || controller.signal.aborted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load dynamic QR.");
        setLoading(false);
        setQrCode(fallbackQrSvg);
        setExpiresAt(fallbackExpiresAt ?? null);
      }
    };

    void loadQr();

    return () => {
      active = false;
      controller.abort();
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, [fallbackExpiresAt, fallbackQrSvg, memberId]);

  useEffect(() => {
    if (!expiresAt) {
      setSecondsRemaining(null);
      return;
    }

    const updateRemaining = () => {
      setSecondsRemaining(Math.max(Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000), 0));
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const statusLabel = useMemo(() => {
    if (loading) return "Loading rotating QR";
    if (error) return "Static fallback active";
    if (secondsRemaining === null) return "QR ready";
    return secondsRemaining > 0 ? `Refreshes in ${secondsRemaining}s` : "Refreshing now";
  }, [error, loading, secondsRemaining]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-400" />
          <p className="text-sm font-semibold text-white">{statusLabel}</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate">
          <RefreshCw className={cn("size-3.5", loading ? "animate-spin" : "")} />
          <span>{refreshAfterSeconds}s rotation</span>
        </div>
      </div>

      <div className="flex justify-center rounded-xl border border-white/10 bg-surface/80 p-5 shadow-member-card">
        {qrCode ? <div aria-label="Dynamic attendance QR code" dangerouslySetInnerHTML={{ __html: qrCode }} /> : <p className="text-sm font-semibold text-slate">QR unavailable.</p>}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="font-bold text-white">Expires</p>
          <p className="mt-1 text-slate">{expiresAt ? new Date(expiresAt).toLocaleString("en-IN") : "Unavailable"}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="font-bold text-white">Fallback</p>
          <p className="mt-1 text-slate">{error ? "Dynamic QR unavailable. Static QR is shown." : "Static QR is available below if needed."}</p>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <p>{error}</p>
        </div>
      ) : null}

      {fallbackQrSvg ? (
        <details className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate">Static fallback QR</summary>
          <div className="mt-4 flex justify-center">
            <div aria-label="Static attendance QR fallback" dangerouslySetInnerHTML={{ __html: fallbackQrSvg }} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
