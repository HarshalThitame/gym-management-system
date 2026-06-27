"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Accessibility, Activity, Globe, Grid3x3, Palette, ShieldCheck,
  RefreshCw, AlertTriangle, CheckCircle2, FileBox
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import type { AuthContext } from "@/types/auth";
import type { AuditResult } from "@/features/super-admin/services/ux-governance-service";
import { ScoreRing } from "@/features/super-admin/components/ux-governance/score-ring";
import { CategoryCard } from "@/features/super-admin/components/ux-governance/category-card";
import { AuditHistory } from "@/features/super-admin/components/ux-governance/audit-history";
import { rerunUxAudit } from "./actions";

type Props = { context: AuthContext; initialAudit: AuditResult };

const categoryIcons: Record<string, React.ReactNode> = {
  designTokens: <Palette className="size-5" />,
  accessibility: <Accessibility className="size-5" />,
  componentUsage: <Grid3x3 className="size-5" />,
  loadingStates: <Activity className="size-5" />,
  errorStates: <ShieldCheck className="size-5" />,
  responsive: <Globe className="size-5" />,
};

export function UxGovernanceDashboard({ context: _ctx, initialAudit }: Props) {
  void _ctx;
  const [audit, setAudit] = useState<AuditResult>(initialAudit);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<{ timestamp: string; score: number }[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ux-audit-history");
      if (saved) setHistory(JSON.parse(saved));
    } catch {}
  }, []);

  const runAudit = useCallback(async () => {
    setRunning(true);
    try {
      setHistory(prev => [{ timestamp: audit.timestamp, score: audit.overallScore }, ...prev].slice(0, 20));
      const result = await rerunUxAudit();
      setAudit(result);
      try { localStorage.setItem("ux-audit-history", JSON.stringify([{ timestamp: result.timestamp, score: result.overallScore }, ...history].slice(0, 20))); } catch {}
    } finally {
      setRunning(false);
    }
  }, [audit, history]);

  const overallColor = audit.overallScore >= 80 ? "text-green-600" : audit.overallScore >= 40 ? "text-amber-600" : "text-red-600";
  const badgeVariant = audit.overallScore >= 80 ? "success" : audit.overallScore >= 40 ? "warning" : "error" as const;
  const bundleSizeMB = (audit.bundle.totalSourceSize / 1024 / 1024).toFixed(1);

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden border-primary/10 bg-gradient-to-br from-surface via-surface to-primary/5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.08),transparent_50%)]" />
        <CardContent className="relative p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="border-indigo-200 bg-indigo-50 text-indigo-800"><Palette className="mr-1 size-3" />UX Governance</Badge>
                <Badge variant={badgeVariant}>{audit.overallScore >= 80 ? "Compliant" : audit.overallScore >= 40 ? "Needs Attention" : "Non-Compliant"}</Badge>
                <Badge variant="info">{audit.summary.passedCategories}/{audit.summary.totalCategories} categories passed</Badge>
              </div>
              <h1 className="mt-4 text-3xl font-black leading-tight md:text-5xl">
                UX Quality, Design System &<br />
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Experience Governance</span>
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
                {audit.summary.totalViolations} violations · {audit.summary.totalWarnings} warnings · Last scanned {new Date(audit.timestamp).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={runAudit}
                disabled={running}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold hover:bg-primary/90 transition-colors uppercase tracking-[0.06em] disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${running ? "animate-spin" : ""}`} />
                {running ? "Scanning..." : "Run Audit"}
              </button>
              <ButtonLink href="/super-admin/white-label" variant="secondary" className="gap-2"><Palette className="size-4" /> Theme Editor</ButtonLink>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricBox label="UX Quality" value={String(audit.overallScore)} status={audit.overallScore >= 80 ? "good" : audit.overallScore >= 40 ? "watch" : "risk"} />
            <MetricBox label="Violations" value={String(audit.summary.totalViolations)} status={audit.summary.totalViolations === 0 ? "good" : audit.summary.totalViolations < 10 ? "watch" : "risk"} />
            <MetricBox label="Warnings" value={String(audit.summary.totalWarnings)} status={audit.summary.totalWarnings === 0 ? "good" : audit.summary.totalWarnings < 20 ? "watch" : "risk"} />
            <MetricBox label="Categories Passed" value={`${audit.summary.passedCategories}/${audit.summary.totalCategories}`} status={audit.summary.passedCategories === audit.summary.totalCategories ? "good" : audit.summary.passedCategories >= 3 ? "watch" : "risk"} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {audit.categories.map((cat, i) => (
            <CategoryCard key={cat.id} category={cat} icon={categoryIcons[cat.id]} index={i} />
          ))}
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-6">
              <ScoreRing score={audit.overallScore} size={120} strokeWidth={8} />
              <p className={`mt-3 text-lg font-black ${overallColor}`}>{audit.overallScore}/100</p>
              <p className="text-sm text-muted-foreground">Overall UX Quality</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {audit.categories.map(cat => (
                  <span key={cat.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                    cat.status === "pass" ? "border-green-200 bg-green-50 text-green-700" :
                    cat.status === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" :
                    "border-red-200 bg-red-50 text-red-700"
                  }`}>
                    {cat.status === "pass" ? <CheckCircle2 className="size-3" /> : cat.status === "warning" ? <AlertTriangle className="size-3" /> : <AlertTriangle className="size-3" />}
                    {cat.label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <AuditHistory currentAudit={audit} history={history} />

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileBox className="size-4 text-muted-foreground" />
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Bundle Size</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Source size</span>
                  <span className="font-black">{bundleSizeMB} MB</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Source files</span>
                  <span className="font-black">{audit.bundle.totalFileCount}</span>
                </div>
                {audit.bundle.largeFiles.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">Largest files</p>
                    {audit.bundle.largeFiles.slice(0, 5).map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs py-0.5">
                        <span className="truncate text-muted-foreground">{f.file}</span>
                        <span className="font-mono shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value, status }: { label: string; value: string; status: "good" | "watch" | "risk" }) {
  const c = { good: "text-green-600 border-green-200 bg-green-50", watch: "text-amber-600 border-amber-200 bg-amber-50", risk: "text-red-600 border-red-200 bg-red-50" };
  return (
    <div className={`rounded-xl border ${c[status]} p-4 dark:bg-background`}>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-black ${c[status].split(" ")[0]}`}>{value}</p>
    </div>
  );
}
