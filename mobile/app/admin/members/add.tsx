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
import { getSupabaseClient } from "@/api/supabase";
import { ArrowLeft, Save, UserRoundPlus } from "lucide-react-native";

export default function AddMemberScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!fullName || !phone) { Alert.alert("Validation", "Name and phone required."); return; }
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const gymId = profile?.gym_id;
      const { data: gym } = await supabase.from("gyms").select("organization_id").eq("id", gymId).single();
      const code = `APX${Date.now().toString(36).toUpperCase().slice(-5)}`;
      const { error } = await supabase.from("members").insert({
        organization_id: gym?.organization_id,
        gym_id: gymId,
        full_name: fullName, phone, email: email || null, address: address || null,
        member_code: code, status: "active", joined_at: new Date().toISOString(),
      });
      if (error) { Alert.alert("Error", error.message); } else { Alert.alert("Success", `Member registered with code: ${code}`, [{ text: "OK", onPress: () => router.back() }]); }
    } catch { Alert.alert("Error", "Failed to save."); } finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">Add Member</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl, paddingBottom: 100 }}>
        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.lg }}>
            <Input label="Full Name *" value={fullName} onChangeText={setFullName} />
            <Input label="Phone *" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            <Input label="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            <Input label="Address" multiline numberOfLines={2} value={address} onChangeText={setAddress} />
          </CardContent>
        </Card>
        <Button variant="primary" size="lg" fullWidth loading={saving} onPress={handleSave}>
          <UserRoundPlus size={20} color={theme.colors.primaryFg} /> Add Member
        </Button>
      </ScrollView>
    </View>
  );
}
