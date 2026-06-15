import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mail } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";

export default function VerifyEmailScreen() {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg, justifyContent: "center" }}>
      <View style={{ paddingHorizontal: theme.spacing["2xl"], gap: theme.spacing.xl, alignItems: "center" }}>
        <Mail size={64} color={theme.colors.primary} />
        <Text variant="h2" center>Verify your email</Text>
        <Text variant="body" muted center style={{ maxWidth: 300 }}>
          We've sent a confirmation link to your email address. Please check your inbox and click the link to verify your account.
        </Text>
        <Button variant="primary" onPress={() => router.push("/auth/login")}>
          Back to Sign In
        </Button>
      </View>
    </SafeAreaView>
  );
}
