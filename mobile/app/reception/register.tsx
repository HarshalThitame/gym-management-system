import React, { useState } from "react";
import { View, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { getSupabaseClient } from "@/api/supabase";
import { Save, UserRoundPlus } from "lucide-react-native";

export default function ReceptionRegisterScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const [step, setStep] = useState<"form" | "success">("form");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [memberCode, setMemberCode] = useState("");

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "APX";
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleRegister = async () => {
    if (!fullName || !phone) {
      Alert.alert("Validation", "Name and phone are required.");
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const code = generateCode();
      const { error } = await supabase.from("members").insert({
        organization_id: profile?.gym_id ? (await supabase.from("gyms").select("organization_id").eq("id", profile.gym_id).single()).data?.organization_id : null,
        gym_id: profile?.gym_id,
        full_name: fullName,
        phone,
        email: email || null,
        address: address || null,
        member_code: code,
        status: "active",
        joined_at: new Date().toISOString(),
      });
      if (error) { Alert.alert("Error", error.message); } else {
        setMemberCode(code);
        setStep("success");
      }
    } catch { Alert.alert("Error", "Registration failed."); } finally { setSaving(false); }
  };

  if (step === "success") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: "center", justifyContent: "center", padding: theme.spacing["2xl"] }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.successMuted, alignItems: "center", justifyContent: "center", marginBottom: theme.spacing.xl }}>
          <Text variant="h1" color={theme.colors.success}>✓</Text>
        </View>
        <Text variant="h2" center>Member Registered</Text>
        <Text variant="h3" color={theme.colors.primary} style={{ marginTop: theme.spacing.md, letterSpacing: 2 }}>{memberCode}</Text>
        <Text variant="body" muted center style={{ marginTop: theme.spacing.sm }}>Give this code to the member for their records.</Text>
        <View style={{ flexDirection: "row", gap: theme.spacing.md, marginTop: theme.spacing.xl }}>
          <Button variant="primary" onPress={() => { setStep("form"); setFullName(""); setPhone(""); setEmail(""); setAddress(""); }}>Register Another</Button>
          <Button variant="secondary" onPress={() => router.back()}>Done</Button>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Register Member</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl, paddingBottom: 100 }}>
        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.lg }}>
            <Input label="Full Name *" placeholder="Member's full name" value={fullName} onChangeText={setFullName} />
            <Input label="Phone *" placeholder="Phone number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            <Input label="Email" placeholder="Email address" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            <Input label="Address" placeholder="Residential address" multiline numberOfLines={2} value={address} onChangeText={setAddress} />
          </CardContent>
        </Card>
        <Button variant="primary" size="lg" fullWidth loading={saving} onPress={handleRegister}>
          <UserRoundPlus size={20} color={theme.colors.primaryFg} /> Register Member
        </Button>
      </ScrollView>
    </View>
  );
}
