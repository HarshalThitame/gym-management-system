import React, { useState } from "react";
import { View, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function RegisterScreen() {
  const { theme } = useTheme();
  const { register, isLoading, error, clearError } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleRegister = async () => {
    clearError();

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Validation Error", "Please fill in all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Validation Error", "Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Validation Error", "Password must be at least 6 characters.");
      return;
    }

    const result = await register({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      phone: phone.trim() || undefined,
    });

    if (result.ok) {
      if (result.needsConfirmation) {
        Alert.alert(
          "Verify your email",
          "We've sent a confirmation link to your email. Please check your inbox.",
          [{ text: "OK", onPress: () => router.push("/auth/login") }]
        );
      } else {
        router.replace("/member");
      }
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing["2xl"],
            paddingVertical: theme.spacing["3xl"],
            gap: theme.spacing["2xl"],
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="h1">Create account</Text>
            <Text variant="body" muted>
              Join Apex Performance Club and start your fitness journey.
            </Text>
          </View>

          {error && (
            <View
              style={{
                backgroundColor: theme.colors.dangerMuted,
                borderRadius: theme.radii.md,
                padding: theme.spacing.md,
              }}
            >
              <Text variant="bodySmall" color={theme.colors.danger}>
                {error}
              </Text>
            </View>
          )}

          <View style={{ gap: theme.spacing.lg }}>
            <Input
              label="Full Name"
              placeholder="Your full name"
              autoCapitalize="words"
              value={fullName}
              onChangeText={setFullName}
            />
            <Input
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              label="Phone (optional)"
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <Input
              label="Password"
              placeholder="At least 6 characters"
              isPassword
              value={password}
              onChangeText={setPassword}
            />
            <Input
              label="Confirm Password"
              placeholder="Repeat your password"
              isPassword
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
          </View>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            onPress={handleRegister}
          >
            Create Account
          </Button>

          <View style={{ alignItems: "center" }}>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => router.push("/auth/login")}
            >
              Already have an account? Sign in
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
