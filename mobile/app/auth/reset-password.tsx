import React, { useState } from "react";
import { View, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getSupabaseClient } from "@/api/supabase";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function ResetPasswordScreen() {
  const { theme } = useTheme();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!password || password.length < 6) {
      Alert.alert("Validation Error", "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Validation Error", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        Alert.alert("Error", error.message);
      } else {
        Alert.alert("Success", "Your password has been updated.", [
          { text: "OK", onPress: () => router.replace("/auth/login") },
        ]);
      }
    } catch {
      Alert.alert("Error", "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: "center" }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "center" }}>
        <View style={{ paddingHorizontal: theme.spacing["2xl"], gap: theme.spacing["2xl"] }}>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="h1">Set new password</Text>
            <Text variant="body" muted>Enter your new password below.</Text>
          </View>
          <View style={{ gap: theme.spacing.lg }}>
            <Input label="New Password" placeholder="At least 6 characters" isPassword value={password} onChangeText={setPassword} />
            <Input label="Confirm Password" placeholder="Repeat your password" isPassword value={confirmPassword} onChangeText={setConfirmPassword} returnKeyType="done" onSubmitEditing={handleReset} />
          </View>
          <Button variant="primary" size="lg" fullWidth loading={loading} onPress={handleReset}>
            Update Password
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
