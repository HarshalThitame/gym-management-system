import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { getSupabaseClient } from "@/api/supabase";
import { ArrowLeft, Save } from "lucide-react-native";

export default function AddLeadScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !phone) {
      Alert.alert("Validation", "Name and phone are required.");
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("leads").insert({
        gym_id: profile?.gym_id,
        name,
        phone,
        email: email || null,
        source: "contact",
        message: message || "Walk-in enquiry",
        status: "new",
        consent_marketing: true,
      });
      if (error) { Alert.alert("Error", error.message); } else {
        Alert.alert("Saved", "Lead registered successfully.", [{ text: "OK", onPress: () => router.back() }]);
      }
    } catch { Alert.alert("Error", "Failed to save lead."); } finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
        <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={24} color={theme.colors.fg} /></TouchableOpacity>
        <Text variant="h2">New Lead</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.xl, paddingBottom: 100 }}>
        <Input label="Full Name *" placeholder="Lead name" value={name} onChangeText={setName} />
        <Input label="Phone *" placeholder="Phone number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <Input label="Email" placeholder="Email address" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
        <Input label="Notes" placeholder="Enquiry details..." multiline numberOfLines={3} value={message} onChangeText={setMessage} />
        <Button variant="primary" size="lg" fullWidth loading={saving} onPress={handleSave}>
          <Save size={20} color={theme.colors.primaryFg} /> Save Lead
        </Button>
      </ScrollView>
    </View>
  );
}
