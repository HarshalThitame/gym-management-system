import React, { useState, useRef, useEffect } from "react";
import { View, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { getSupabaseClient } from "@/api/supabase";
import { attendanceService } from "@/services/attendance-service";
import { ArrowLeft, Camera, CheckCircle2, XCircle, Zap, ZapOff } from "lucide-react-native";

export default function ScannerScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const handleBarcodeScanned = async (scanResult: BarcodeScanningResult) => {
    if (processingRef.current || scanned) return;
    processingRef.current = true;
    setScanned(true);

    try {
      const qrData = scanResult.data;
      const supabase = getSupabaseClient();
      const { data: member } = await supabase
        .from("members")
        .select("id, gym_id")
        .eq("user_id", profile?.id ?? "")
        .maybeSingle();

      if (member) {
        const r = await attendanceService.checkIn(member.id, member.gym_id, "qr");
        setResult({
          ok: r.ok,
          message: r.ok ? "✅ Check-in successful! Welcome!" : r.error ?? "Check-in failed",
        });
      } else {
        setResult({ ok: false, message: "Member profile not found. Please register at the front desk." });
      }
    } catch {
      setResult({ ok: false, message: "Scan failed. Please try again." });
    } finally {
      processingRef.current = false;
    }
  };

  const handleScanAgain = () => {
    setScanned(false);
    setResult(null);
  };

  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: "center", justifyContent: "center", padding: theme.spacing["2xl"] }}>
        <Camera size={48} color={theme.colors.fgMuted} />
        <Text variant="h4" center style={{ marginTop: theme.spacing.lg }}>Camera Required</Text>
        <Text variant="body" muted center style={{ marginTop: theme.spacing.sm, maxWidth: 280 }}>
          Camera access is needed to scan QR codes for attendance check-in.
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg, alignItems: "center", justifyContent: "center", padding: theme.spacing["2xl"] }}>
        <Camera size={48} color={theme.colors.warning} />
        <Text variant="h4" center style={{ marginTop: theme.spacing.lg }}>Camera Permission Needed</Text>
        <Text variant="body" muted center style={{ marginTop: theme.spacing.sm, maxWidth: 280 }}>
          Please grant camera access in your device settings to scan QR codes.
        </Text>
        <Button variant="primary" onPress={requestPermission} style={{ marginTop: theme.spacing.xl }}>
          Grant Permission
        </Button>
        <Button variant="ghost" onPress={() => router.back()} style={{ marginTop: theme.spacing.md }}>
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torchOn}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      >
        <View style={{ flex: 1, paddingTop: insets.top }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
            <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTorchOn(!torchOn)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
              {torchOn ? <ZapOff size={22} color="#fff" /> : <Zap size={22} color="#fff" />}
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <View style={{
              width: 250, height: 250,
              borderWidth: 2, borderColor: theme.colors.primary,
              borderRadius: theme.radii["2xl"],
              backgroundColor: "transparent",
            }}>
              <View style={[StyleSheet.absoluteFill, { borderWidth: 0 }]}>
                <View style={{ position: "absolute", top: -1, left: -1, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: theme.colors.primary, borderTopLeftRadius: 16 }} />
                <View style={{ position: "absolute", top: -1, right: -1, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: theme.colors.primary, borderTopRightRadius: 16 }} />
                <View style={{ position: "absolute", bottom: -1, left: -1, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: theme.colors.primary, borderBottomLeftRadius: 16 }} />
                <View style={{ position: "absolute", bottom: -1, right: -1, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: theme.colors.primary, borderBottomRightRadius: 16 }} />
              </View>
            </View>
            <Text variant="body" style={{ color: "#fff", marginTop: theme.spacing.xl, opacity: 0.8 }}>
              Point camera at gym QR code
            </Text>
          </View>

          {result && (
            <View style={{
              position: "absolute", bottom: 120, left: theme.spacing.lg, right: theme.spacing.lg,
              padding: theme.spacing.lg, borderRadius: theme.radii.lg,
              backgroundColor: result.ok ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.9)",
              alignItems: "center", gap: theme.spacing.sm,
            }}>
              {result.ok ? <CheckCircle2 size={32} color="#fff" /> : <XCircle size={32} color="#fff" />}
              <Text variant="body" style={{ color: "#fff", fontWeight: "700" }}>{result.message}</Text>
              <Button variant="accent" size="sm" onPress={handleScanAgain}>
                Scan Again
              </Button>
            </View>
          )}
        </View>
      </CameraView>
    </View>
  );
}
