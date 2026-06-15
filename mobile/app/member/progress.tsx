import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert, Image } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressChart } from "@/components/member/ProgressChart";
import { progressService } from "@/services/progress-service";
import { useHaptics } from "@/hooks/use-haptics";
import { TrendingUp, Weight, Ruler, Camera, Trophy, Plus, Upload } from "lucide-react-native";
import type { FitnessProgress } from "@/types";
import { getSupabaseClient } from "@/api/supabase";

export default function ProgressScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { success: hapticSuccess, light: hapticLight } = useHaptics();
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<FitnessProgress[]>([]);
  const [latest, setLatest] = useState<FitnessProgress | null>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [waist, setWaist] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [bmiInfo, setBmiInfo] = useState<{ bmi: number; heightCm: number } | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: member } = await supabase.from("members").select("id").eq("user_id", profile?.id ?? "").maybeSingle();
      if (member) {
        setMemberId(member.id);
        const h = await progressService.getProgressHistory(member.id, 20);
        setHistory(h);
        setLatest(h[0] ?? null);
        if (h[0]?.weight_kg) {
          const bmi = await progressService.calculateBMIForMember(member.id, h[0].weight_kg);
          setBmiInfo(bmi);
        }
        const m = await progressService.getMilestones(member.id);
        setMilestones(m);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Camera roll access is needed to upload progress photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4],
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      hapticLight();
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Camera access is needed to take progress photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4],
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      hapticLight();
    }
  };

  const handleSaveProgress = async () => {
    if (!weight) {
      Alert.alert("Validation", "Weight is required.");
      return;
    }
    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: member } = await supabase.from("members").select("id").eq("user_id", profile?.id ?? "").maybeSingle();
      if (member) {
        const recordData: any = {
          weight_kg: parseFloat(weight),
          body_fat_percentage: bodyFat ? parseFloat(bodyFat) : undefined,
          waist_cm: waist ? parseFloat(waist) : undefined,
          notes: notes || undefined,
        };

        if (photoUri) {
          const formData = new FormData();
          const filename = photoUri.split("/").pop() ?? "progress.jpg";
          formData.append("file", { uri: photoUri, name: filename, type: "image/jpeg" } as any);
          formData.append("member_id", member.id);
          const { data: uploadData } = await supabase.storage
            .from("progress-photos")
            .upload(`${member.id}/${Date.now()}-${filename}`, formData, {
              contentType: "image/jpeg",
            });
          if (uploadData?.path) {
            const { data: urlData } = supabase.storage
              .from("progress-photos")
              .getPublicUrl(uploadData.path);
            recordData.photo_urls = [urlData.publicUrl];
          }
        }

        const ok = await progressService.recordProgress(member.id, recordData);
        if (ok) {
          hapticSuccess();
          Alert.alert("Saved", "Progress recorded!");
          setShowForm(false);
          setPhotoUri(null);
          loadProgress();
        }
      }
    } catch {} finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState fullScreen />;

  const bmi = bmiInfo?.bmi ?? 0;
  const bmiStatus = bmi > 0 ? progressService.getBMIStatus(bmi) : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Progress</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        {latest && (
          <Card variant="muted">
            <CardContent style={{ gap: theme.spacing.md }}>
              <Text variant="caption" muted uppercase>Latest Check-in</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                <View style={{ alignItems: "center" }}>
                  <Text variant="stat">{latest.weight_kg ?? "—"}</Text>
                  <Text variant="caption" muted>Weight (kg)</Text>
                </View>
                <View style={{ width: 1, backgroundColor: theme.colors.border }} />
                <View style={{ alignItems: "center" }}>
                  <Text variant="stat">{latest.body_fat_percentage ?? "—"}</Text>
                  <Text variant="caption" muted>Body Fat %</Text>
                </View>
                <View style={{ width: 1, backgroundColor: theme.colors.border }} />
                <View style={{ alignItems: "center" }}>
                  <Text variant="stat">{bmi > 0 ? bmi : "—"}</Text>
                  <Text variant="caption" muted>BMI</Text>
                </View>
              </View>
              {bmiStatus && (
                <Badge variant={bmiStatus.label === "Normal" ? "success" : "warning"} label={bmiStatus.label} size="sm" />
              )}
            </CardContent>
          </Card>
        )}

        {!showForm ? (
          <Button variant="primary" fullWidth onPress={() => setShowForm(true)}>
            <Plus size={18} /> Record Progress
          </Button>
        ) : (
          <Card>
            <CardContent style={{ gap: theme.spacing.md }}>
              <Text variant="h4">Record Progress</Text>
              <Input label="Weight (kg)" placeholder="75" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} />
              <Input label="Body Fat %" placeholder="Optional" keyboardType="decimal-pad" value={bodyFat} onChangeText={setBodyFat} />
              <Input label="Waist (cm)" placeholder="Optional" keyboardType="decimal-pad" value={waist} onChangeText={setWaist} />
              {photoUri && (
                <Image source={{ uri: photoUri }} style={{ width: "100%", height: 200, borderRadius: theme.radii.md, marginBottom: theme.spacing.sm }} />
              )}
              <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                <Button variant="secondary" style={{ flex: 1 }} onPress={handleTakePhoto}>
                  <Camera size={16} /> Take Photo
                </Button>
                <Button variant="secondary" style={{ flex: 1 }} onPress={handlePickPhoto}>
                  <Upload size={16} /> Gallery
                </Button>
              </View>
              <Input label="Notes" placeholder="How are you feeling?" multiline numberOfLines={2} value={notes} onChangeText={setNotes} />
              <Button variant="primary" fullWidth loading={saving} onPress={handleSaveProgress}>Save</Button>
              <Button variant="ghost" onPress={() => setShowForm(false)}>Cancel</Button>
            </CardContent>
          </Card>
        )}

        {history.length >= 2 && (
          <View style={{ gap: theme.spacing.md }}>
            <Text variant="h4">Weight Trend</Text>
            <View style={{ height: 160 }}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
                {history.slice(0, 14).reverse().map((h, i) => {
                  const weights = history.map((x) => x.weight_kg ?? 0);
                  const maxW = Math.max(...weights, 1);
                  const hgt = ((h.weight_kg ?? 0) / maxW) * 140;
                  return (
                    <View key={i} style={{ flex: 1, alignItems: "center" }}>
                      <View style={{
                        width: "60%", height: Math.max(4, hgt),
                        backgroundColor: theme.colors.primary,
                        borderRadius: 4, opacity: 0.7 + (i / history.length) * 0.3,
                      }} />
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {milestones.length > 0 && (
          <View style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
              <Trophy size={20} color={theme.colors.warning} />
              <Text variant="h4">Milestones</Text>
            </View>
            {milestones.map((m, i) => (
              <Card key={i} variant="muted">
                <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                  <Trophy size={24} color={theme.colors.warning} />
                  <View>
                    <Text variant="subtitle">{m.title}</Text>
                    <Text variant="bodySmall" muted>
                      {m.achieved_at ? new Date(m.achieved_at).toLocaleDateString() : ""}
                    </Text>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}

        <TouchableOpacity onPress={() => {}}>
          <Card variant="muted">
            <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
              <Camera size={20} color={theme.colors.fgMuted} />
              <View style={{ flex: 1 }}>
                <Text variant="subtitle">Progress Photos</Text>
                <Text variant="bodySmall" muted>Track your transformation</Text>
              </View>
            </CardContent>
          </Card>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
