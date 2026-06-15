import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Membership, MembershipPlan } from "@/types";

interface MembershipCardProps {
  membership: Membership | null;
  plan: MembershipPlan | null;
  daysRemaining: number;
}

export function MembershipCard({ membership, plan, daysRemaining }: MembershipCardProps) {
  const { theme } = useTheme();

  if (!membership || !plan) {
    return (
      <Card variant="muted">
        <View style={{ alignItems: "center", paddingVertical: theme.spacing.xl, gap: theme.spacing.sm }}>
          <Text variant="h4" center>No Active Membership</Text>
          <Text variant="body" muted center>
            You don't have an active membership plan. Visit the front desk or contact us to get started.
          </Text>
        </View>
      </Card>
    );
  }

  const badgeVariant = membership.status === "active"
    ? "success"
    : membership.status === "expired"
    ? "danger"
    : membership.status === "frozen"
    ? "warning"
    : "neutral";

  const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7;

  return (
    <Card variant="muted">
      <View style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text variant="caption" muted uppercase>Membership Plan</Text>
            <Text variant="h3" style={{ marginTop: 2 }}>{plan.name}</Text>
          </View>
          <Badge variant={badgeVariant} label={membership.status.toUpperCase()} dot />
        </View>

        <View style={{ height: 1, backgroundColor: theme.colors.border }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text variant="caption" muted uppercase>Days Left</Text>
            <Text
              variant="stat"
              color={isExpiringSoon ? theme.colors.warning : theme.colors.fg}
              style={{ marginTop: 2 }}
            >
              {daysRemaining}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text variant="caption" muted uppercase>Status</Text>
            <Text
              variant="subtitle"
              color={membership.status === "active" ? theme.colors.success : theme.colors.fgMuted}
              style={{ marginTop: 2 }}
            >
              {membership.status === "active" ? "Active" : membership.status.charAt(0).toUpperCase() + membership.status.slice(1)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text variant="caption" muted uppercase>Started</Text>
            <Text variant="bodySmall" style={{ marginTop: 2 }}>
              {new Date(membership.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text variant="caption" muted uppercase>Expires</Text>
            <Text
              variant="bodySmall"
              color={isExpiringSoon ? theme.colors.warning : theme.colors.fg}
              style={{ marginTop: 2 }}
            >
              {new Date(membership.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </Text>
          </View>
        </View>

        {membership.total_amount > 0 && (
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text variant="caption" muted uppercase>Amount</Text>
            <Text variant="subtitle">₹{membership.total_amount.toLocaleString()}</Text>
          </View>
        )}

        {isExpiringSoon && (
          <View style={{
            backgroundColor: theme.colors.warningMuted,
            borderRadius: theme.radii.md,
            padding: theme.spacing.md,
          }}>
            <Text variant="bodySmall" color={theme.colors.warning} bold>
              Your membership expires in {daysRemaining} {daysRemaining === 1 ? "day" : "days"}. Renew to continue uninterrupted.
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

export function MembershipSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={{
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.bgSurfaceMuted,
      borderRadius: theme.radii.lg,
      gap: theme.spacing.md,
    }}>
      <View style={{ height: 20, width: "40%", backgroundColor: theme.colors.border, borderRadius: 4 }} />
      <View style={{ height: 14, width: "100%", backgroundColor: theme.colors.border, borderRadius: 4 }} />
      <View style={{ height: 14, width: "60%", backgroundColor: theme.colors.border, borderRadius: 4 }} />
    </View>
  );
}
