import React from "react";
import { View, TouchableOpacity } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Badge } from "@/components/ui/Badge";
import { ChevronRight } from "lucide-react-native";
import type { Member } from "@/types";

interface MemberListItemProps {
  member: Member;
  membershipStatus?: string;
  onPress: () => void;
}

export function MemberListItem({ member, membershipStatus, onPress }: MemberListItemProps) {
  const { theme } = useTheme();

  const statusVariant = member.status === "active" ? "success"
    : member.status === "suspended" ? "danger" : "neutral";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: "row", alignItems: "center", gap: theme.spacing.md,
        padding: theme.spacing.md,
        backgroundColor: theme.colors.bgSurface,
        borderRadius: theme.radii.lg,
        borderWidth: 1, borderColor: theme.colors.border,
      }}
    >
      <View style={{
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: theme.colors.primaryMuted,
        alignItems: "center", justifyContent: "center",
      }}>
        <Text variant="subtitle" color={theme.colors.primary}>
          {member.full_name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="subtitle">{member.full_name}</Text>
        <Text variant="caption" muted>
          {member.member_code} · {member.phone}
        </Text>
        {membershipStatus && (
          <Badge variant={statusVariant} label={membershipStatus.toUpperCase()} size="sm" style={{ marginTop: 4, alignSelf: "flex-start" }} />
        )}
      </View>
      <ChevronRight size={18} color={theme.colors.fgMuted} />
    </TouchableOpacity>
  );
}

export function MemberListSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={{
          flexDirection: "row", alignItems: "center", gap: theme.spacing.md,
          padding: theme.spacing.md,
          backgroundColor: theme.colors.bgSurfaceMuted,
          borderRadius: theme.radii.lg,
        }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.border }} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ height: 14, width: "60%", backgroundColor: theme.colors.border, borderRadius: 4 }} />
            <View style={{ height: 10, width: "40%", backgroundColor: theme.colors.border, borderRadius: 4 }} />
          </View>
        </View>
      ))}
    </View>
  );
}
