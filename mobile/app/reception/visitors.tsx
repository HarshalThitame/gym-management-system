import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Users } from "lucide-react-native";

export default function VisitorsScreen() {
  const { theme } = useTheme();
  return (
    <ScreenShell title="Visitor Management" subtitle="Walk-in visitors and guest passes">
      <EmptyState icon={<Users size={48} />} title="No visitors" description="Visitor management coming soon." />
    </ScreenShell>
  );
}
