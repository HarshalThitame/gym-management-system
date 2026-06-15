import React from "react";
import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { CalendarDays } from "lucide-react-native";

export default function AppointmentsScreen() {
  const { theme } = useTheme();
  return (
    <ScreenShell title="Appointments" subtitle="Scheduled visits and trials">
      <EmptyState icon={<CalendarDays size={48} />} title="No appointments" description="Appointment scheduling coming soon." />
    </ScreenShell>
  );
}
