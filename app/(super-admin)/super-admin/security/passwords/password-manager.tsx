"use client";

import { useState } from "react";
import { Shield, Lock, CheckCircle2, XCircle, AlertTriangle, Search } from "lucide-react";

export function PasswordPolicyManager({
  policy, userCount, lockedCount,
}: {
  policy: Record<string, unknown> | null;
  userCount: number;
  lockedCount: number;
}) {
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<{ valid: boolean; errors: string[]; score: number } | null>(null);
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    if (!password) return;
    setChecking(true);
    try {
      const res = await fetch("/api/security/password/check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) setResult(data.data);
    } catch {} finally { setChecking(false); }
  };

  const policyRows = policy ? [
    ["Min Length", policy.min_length as number, 10],
    ["Uppercase Required", policy.require_uppercase ? "Yes" : "No", ""],
    ["Lowercase Required", policy.require_lowercase ? "Yes" : "No", ""],
    ["Numbers Required", policy.require_numbers ? "Yes" : "No", ""],
    ["Special Required", policy.require_special ? "Yes" : "No", ""],
    ["Expiration", policy.expiration_days ? `${policy.expiration_days} days` : "Never", ""],
    ["Password History", policy.history_count as number, 5],
    ["Max Failed Attempts", policy.max_failed_attempts as number, 5],
    ["Lockout Duration", `${policy.lockout_duration_minutes} min`, 30],
    ["Prevent Common", policy.prevent_common ? "Yes" : "No", ""],
    ["Prevent Breached", policy.prevent_breached ? "Yes" : "No", ""],
  ] : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Password Strength Checker</p>
          <div className="flex gap-2">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCheck()}
              placeholder="Enter a password to test its strength..." className="flex-1 h-9 rounded-lg border border-border bg-background text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary/20" />
            <button onClick={handleCheck} disabled={checking}
              className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {checking ? "Checking..." : "Check Strength"}
            </button>
          </div>

          {result && (
            <div className={`mt-3 rounded-lg p-3 ${result.valid ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <div className="flex items-center gap-2">
                {result.valid ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                <p className={`text-xs font-medium ${result.valid ? "text-green-700" : "text-red-700"}`}>
                  {result.valid ? "Strong password" : `Weak (${result.errors.length} issues)`}
                </p>
                <div className="ml-auto flex items-center gap-1">
                  <div className="h-2 w-20 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${result.score >= 80 ? "bg-green-500" : result.score >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${result.score}%` }} />
                  </div>
                  <span className="text-xs font-mono">{result.score}/100</span>
                </div>
              </div>
              {result.errors.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {result.errors.map((e, i) => <li key={i} className="text-[10px] text-red-600 flex items-center gap-1"><XCircle className="h-2.5 w-2.5" />{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="px-4 py-2 border-b border-border bg-muted/20">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Policy Configuration</p>
          </div>
          <div className="divide-y divide-border">
            {policyRows.map(([label, value], i) => (
              <div key={i} className="px-4 py-2.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Platform Stats</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" /><span className="text-xs">Total Users</span></div>
              <span className="text-sm font-bold">{userCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-amber-500" /><span className="text-xs">Locked Accounts</span></div>
              <span className="text-sm font-bold text-amber-600">{lockedCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /><span className="text-xs">Breached Detection</span></div>
              <span className="text-sm font-bold">{policy?.prevent_breached ? "Active" : "Inactive"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick Actions</p>
          <div className="space-y-2">
            <button className="w-full h-8 rounded-lg bg-amber-600 text-white text-[10px] font-medium hover:bg-amber-700 transition-colors">Force Reset Expired Passwords</button>
            <button className="w-full h-8 rounded-lg border border-red-200 text-red-600 text-[10px] font-medium hover:bg-red-50 transition-colors">Unlock All Locked Accounts</button>
          </div>
        </div>
      </div>
    </div>
  );
}
