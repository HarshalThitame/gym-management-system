"use client";

import { useState, useEffect } from "react";
import { Building2, Users, Dumbbell, UserRound, Shield, Loader2 } from "lucide-react";
import { useEntitlements } from "./entitlement-provider";
import { UsageLimitBar } from "./usage-limit-bar";
import { getLiveUsageAction } from "./usage-loader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function UsageDashboardCard() {
  const { isWithinLimit, plan } = useEntitlements();
  const [usage, setUsage] = useState<{ branches: number; members: number; trainers: number; staff: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getLiveUsageAction(plan?.packageId ?? "");
        if (!cancelled) setUsage(data);
      } catch {
        if (!cancelled) setUsage({ branches: 0, members: 0, trainers: 0, staff: 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [plan?.packageId]);

  const limits = [
    { key: "max_branches", label: "Branches", icon: <Building2 className="size-4" />, current: usage?.branches ?? 0 },
    { key: "max_members", label: "Members", icon: <Users className="size-4" />, current: usage?.members ?? 0 },
    { key: "max_trainers", label: "Trainers", icon: <Dumbbell className="size-4" />, current: usage?.trainers ?? 0 },
    { key: "max_staff", label: "Staff", icon: <UserRound className="size-4" />, current: usage?.staff ?? 0 },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-black">Plan Capacity</h2>
          {loading && <Loader2 className="size-4 animate-spin text-muted-foreground ml-2" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !usage ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-24 animate-pulse rounded bg-accent/30" />
                <div className="h-2 w-full animate-pulse rounded bg-accent/20" />
              </div>
            ))}
          </div>
        ) : (
          limits.map((l) => {
            const check = isWithinLimit(l.key, l.current);
            return (
              <UsageLimitBar
                key={l.key}
                label={l.label}
                current={l.current}
                limit={check.limit === -1 ? 0 : check.limit}
                isUnlimited={check.limit === -1}
              />
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
