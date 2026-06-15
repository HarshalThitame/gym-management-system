import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { crmLeadService, type LeadSource } from "@/services/crm/crm-lead-service";
import { ArrowLeft, Save } from "lucide-react-native";

const SOURCES: LeadSource[] = ["walk_in", "phone", "whatsapp", "facebook", "instagram", "website", "referral", "google_ads", "campaign", "manual"];

export default function AdminAddLeadScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, organizationId } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<LeadSource>("manual");
  const [interest, setInterest] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !phone) { Alert.alert("Validation", "Name and phone required."); return; }
    if (!organizationId || !profile?.gym_id) { Alert.alert("Error", "No gym context."); return; }
    setSaving(true);
    const result = await crmLeadService.createLead({
      organization_id: organizationId,
      gym_id: profile.gym_id,
      name, phone, email: email || undefined,
      source, interest: interest || undefined,
    });
    if (result.ok) { Alert.alert("Success", "Lead created.", [{ text: "OK", onPress: () => router.back() }]); }
    else { Alert.alert("Error", result.error ?? "Failed"); }
    setSaving(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Add Lead</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl, paddingBottom: 100 }}>
        <Card variant="muted"><CardContent style={{ gap: theme.spacing.lg }}>
          <Input label="Full Name *" value={name} onChangeText={setName} />
          <Input label="Phone *" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <Input label="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
          <Text variant="caption" muted>Source</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
            {SOURCES.map((s) => (
              <TouchableOpacity key={s} onPress={() => setSource(s)}
                style={{ paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.full, backgroundColor: source === s ? theme.colors.primary : theme.colors.bgSurfaceMuted }}>
                <Text variant="caption" color={source === s ? "#fff" : theme.colors.fg}>{s.replace("_", " ")}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Input label="Interest" placeholder="What are they looking for?" value={interest} onChangeText={setInterest} />
        </CardContent></Card>
        <Button variant="primary" size="lg" fullWidth loading={saving} onPress={handleSave}><Save size={20} color="#fff" /> Save Lead</Button>
      </ScrollView>
    </View>
  );
}
