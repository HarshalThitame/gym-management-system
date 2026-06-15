import React, { useState } from "react";
import { View, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getSupabaseClient } from "@/api/supabase";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert("Validation Error", "Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) {
        Alert.alert("Error", error.message);
      } else {
        setSent(true);
      }
    } catch {
      Alert.alert("Error", "Failed to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: "center" }}>
        <View style={{ paddingHorizontal: theme.spacing["2xl"], gap: theme.spacing.xl, alignItems: "center" }}>
          <Text variant="h2" center>Check your email</Text>
          <Text variant="body" muted center>
            We've sent a password reset link to {email}. Please check your inbox.
          </Text>
          <Button variant="primary" onPress={() => router.push("/auth/login")}>
            Back to Sign In
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: "center" }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "center" }}>
        <View style={{ paddingHorizontal: theme.spacing["2xl"], gap: theme.spacing["2xl"] }}>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="h1">Reset password</Text>
            <Text variant="body" muted>
              Enter your email address and we'll send you a reset link.
            </Text>
          </View>
          <Input
            label="Email"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Button variant="primary" size="lg" fullWidth loading={loading} onPress={handleReset}>
            Send Reset Link
          </Button>
          <Button variant="ghost" onPress={() => router.push("/auth/login")}>
            Back to Sign In
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
