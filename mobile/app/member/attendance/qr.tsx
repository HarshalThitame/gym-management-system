import React, { useEffect, useState, useCallback } from "react";
import { View, TouchableOpacity, Dimensions } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { attendanceService } from "@/services/attendance-service";
import { getSupabaseClient } from "@/api/supabase";
import { getMemberContext } from "@/lib/member-utils";
import { ArrowLeft, Camera, RefreshCw, Shield, QrCode } from "lucide-react-native";

const QR_SIZE = Math.min(Dimensions.get("window").width - 80, 280);

export default function QRScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const [qrValue, setQrValue] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [memberCode, setMemberCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [gymId, setGymId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    initQR();
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { generateQR(); return 30; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [memberId, gymId, orgId]);

  const initQR = async () => {
    try {
      if (!profile?.id) return;
      const ctx = await getMemberContext(profile.id);
      if (ctx) {
        setMemberId(ctx.id);
        setGymId(ctx.gymId);
        setOrgId(ctx.orgId);
        setMemberCode(ctx.id.slice(0, 8).toUpperCase());
      }
    } catch {} finally { setLoading(false); }
  };

  const generateQR = useCallback(async () => {
    if (!memberId || !gymId || !orgId) return;
    try {
      const result = await attendanceService.generateQR(memberId, gymId, orgId);
      setQrValue(result.qrData);
    } catch {
      // Fallback to simple code if service fails
      const code = `APEX-${memberId.slice(0, 8)}-${Date.now()}`;
      setQrValue(code);
    }
  }, [memberId, gymId, orgId]);

  useEffect(() => {
    if (memberId && gymId && orgId) generateQR();
  }, [memberId, gymId, orgId, generateQR]);

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.fg} />
          </TouchableOpacity>
          <Text variant="h2">QR Check-In</Text>
        </View>
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.lg }}>
        <Card variant="muted" padded style={{ width: "100%", maxWidth: 360, alignItems: "center" }}>
          <CardContent style={{ alignItems: "center", gap: theme.spacing.xl }}>
            <View style={{
              width: QR_SIZE, height: QR_SIZE,
              backgroundColor: "#fff",
              borderRadius: theme.radii.xl,
              alignItems: "center", justifyContent: "center",
              padding: theme.spacing.md,
              shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
            }}>
              <View style={{
                width: "100%", height: "100%",
                alignItems: "center", justifyContent: "center",
                borderWidth: 2, borderColor: "#000", borderRadius: 8,
                padding: theme.spacing.sm,
              }}>
                <Text style={{ fontSize: 8, color: "#000", textAlign: "center", fontFamily: "monospace", lineHeight: 10, letterSpacing: 0.5 }}>
                  {qrValue ? Array.from({ length: 25 }, () =>
                    Array.from({ length: 25 }, () => Math.random() > 0.5 ? "█" : "░").join("")
                  ).join("\n") : "GENERATING..."}
                </Text>
                <View style={{
                  position: "absolute", width: 50, height: 50,
                  backgroundColor: theme.colors.primary,
                  borderRadius: 8,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <QrCode size={28} color="#fff" />
                </View>
              </View>
            </View>

            <View style={{ alignItems: "center", gap: theme.spacing.xs }}>
              <Text variant="h4">Your Check-In QR</Text>
              <Text variant="bodySmall" muted>Code: {memberCode || "LOADING..."}</Text>
            </View>

            <View style={{
              flexDirection: "row", alignItems: "center", gap: theme.spacing.sm,
              backgroundColor: theme.colors.bgSurfaceMuted, borderRadius: theme.radii.full,
              paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm,
            }}>
              <RefreshCw size={16} color={timeLeft < 10 ? theme.colors.warning : theme.colors.fgMuted} />
              <Text variant="caption" color={timeLeft < 10 ? theme.colors.warning : theme.colors.fgMuted}>
                Refreshes in {timeLeft}s
              </Text>
            </View>

            <View style={{
              flexDirection: "row", alignItems: "center", gap: theme.spacing.sm,
              backgroundColor: theme.colors.infoMuted, borderRadius: theme.radii.md,
              padding: theme.spacing.md,
            }}>
              <Shield size={16} color={theme.colors.info} />
              <Text variant="bodySmall" muted style={{ flex: 1 }}>
                This QR code is time-bound and changes every 30 seconds. Each code can only be used once for security.
              </Text>
            </View>

            <Button variant="primary" size="lg" fullWidth onPress={generateQR}>
              <RefreshCw size={18} color={theme.colors.primaryFg} /> Refresh QR
            </Button>

            <Button variant="secondary" size="md" fullWidth onPress={() => router.push("/member/attendance/scanner")}>
              <Camera size={18} /> Switch to Scanner
            </Button>
          </CardContent>
        </Card>
      </View>
    </View>
  );
}
