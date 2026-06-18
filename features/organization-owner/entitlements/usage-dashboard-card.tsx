"use client";

import { Building2, Users, Dumbbell, UserRound, Shield } from "lucide-react";
import { useEntitlements } from "./entitlement-provider";
import { UsageLimitBar } from "./usage-limit-bar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type UsageCardProps = {
  memberCount: number;
  branchCount: number;
  trainerCount: number;
  staffCount: number;
};

export function UsageDashboardCard({ memberCount, branchCount, trainerCount, staffCount }: UsageCardProps) {
  const { isWithinLimit } = useEntitlements();

  const limits = [
    { key: "max_branches", label: "Branches", icon: <Building2 className="size-4" />, current: branchCount },
    { key: "max_members", label: "Members", icon: <Users className="size-4" />, current: memberCount },
    { key: "max_trainers", label: "Trainers", icon: <Dumbbell className="size-4" />, current: trainerCount },
    { key: "max_staff", label: "Staff", icon: <UserRound className="size-4" />, current: staffCount },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-black">Plan Capacity</h2>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {limits.map((l) => {
          const check = isWithinLimit(l.key, l.current);
          return (
            <UsageLimitBar
              key={l.key}
              label={`${l.label}`}
              current={l.current}
              limit={check.limit === -1 ? 0 : check.limit}
              isUnlimited={check.limit === -1}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
