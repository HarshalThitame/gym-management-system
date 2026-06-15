import React, { useState, useEffect, useRef } from "react";
import { View, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/state/auth/auth-store";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { getRoleRedirect } from "@/rbac/permissions";

export default function LoginScreen() {
  const { theme } = useTheme();
  const { login, isLoading, error, clearError } = useAuth();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const hasRedirected = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // If already authenticated when this screen mounts, redirect
  useEffect(() => {
    if (hasRedirected.current) return;
    if (!isAuthenticated || !user) return;
    hasRedirected.current = true;
    const redirect = getRoleRedirect(user.roles);
    console.log("[Login] Already authenticated, redirecting to", redirect);
    router.replace(redirect as never);
  }, [isAuthenticated, user]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Validation Error", "Please enter both email and password.");
      return;
    }

    clearError();
    const result = await login({ email: email.trim(), password });

    if (result.ok) {
      const roles = (result as any).roles ?? [];
      const redirect = roles.length > 0 ? getRoleRedirect(roles) : "/member";
      console.log(`[Login] Success, navigating to ${redirect}`);
      // Navigation will be handled by the useEffect watching isAuthenticated
      // This avoids race conditions with the router
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: "center" }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "center" }}>
        <View style={{ paddingHorizontal: theme.spacing["2xl"], gap: theme.spacing["2xl"] }}>
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="h1">Welcome back</Text>
            <Text variant="body" muted>Sign in to your account to continue.</Text>
          </View>

          {error && (
            <View style={{ backgroundColor: theme.colors.dangerMuted, borderRadius: theme.radii.md, padding: theme.spacing.md }}>
              <Text variant="bodySmall" color={theme.colors.danger}>{error}</Text>
            </View>
          )}

          <View style={{ gap: theme.spacing.lg }}>
            <Input label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} returnKeyType="next" />
            <Input label="Password" placeholder="Enter your password" isPassword value={password} onChangeText={setPassword} returnKeyType="done" onSubmitEditing={handleLogin} />
          </View>

          <Button variant="primary" size="lg" fullWidth loading={isLoading} onPress={handleLogin}>Sign In</Button>

          <View style={{ alignItems: "center", gap: theme.spacing.md }}>
            <Button variant="ghost" size="sm" onPress={() => router.push("/auth/forgot-password")}>Forgot password?</Button>
            <Button variant="ghost" size="sm" onPress={() => router.push("/auth/register")}>Don't have an account? Sign up</Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
