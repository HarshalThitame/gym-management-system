import React, { useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { memberService } from "@/services/member-service";
import {
  UserRound, Settings, CreditCard, Bell, Gift, TrendingUp,
  ChevronRight, MapPin, Phone, Mail, Heart, Target,
} from "lucide-react-native";

export default function ProfileTabScreen() {
  const { theme } = useTheme();
  const { user, profile, primaryRole, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [emergencyContact, setEmergencyContact] = useState(profile?.emergency_contact_name ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState(profile?.emergency_contact_phone ?? "");

  const handleSaveProfile = async () => {
    if (user?.userId) {
      const ok = await memberService.updateProfile(user.userId, {
        full_name: fullName,
        phone,
        emergency_contact_name: emergencyContact || null,
        emergency_contact_phone: emergencyPhone || null,
      });
      if (ok) {
        Alert.alert("Saved", "Profile updated successfully.");
        setEditing(false);
      } else {
        Alert.alert("Error", "Failed to update profile.");
      }
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => { await logout(); router.replace("/auth/login"); } },
    ]);
  };

  const menuItems = [
    { icon: <CreditCard size={20} />, label: "Membership", onPress: () => router.push("/member/membership") },
    { icon: <Bell size={20} />, label: "Notifications", onPress: () => router.push("/member/notifications") },
    { icon: <TrendingUp size={20} />, label: "Progress", onPress: () => router.push("/member/progress") },
    { icon: <Gift size={20} />, label: "Referrals", onPress: () => router.push("/member/referrals") },
    { icon: <Target size={20} />, label: "Offers", onPress: () => router.push("/member/offers") },
    { icon: <MapPin size={20} />, label: "Branches", onPress: () => router.push("/member/branches") },
    { icon: <Settings size={20} />, label: "Settings", onPress: () => router.push("/member/settings") },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <Card variant="muted" padded style={{ margin: theme.spacing.lg }}>
          <CardContent>
            <View style={{ alignItems: "center", gap: theme.spacing.md, paddingVertical: theme.spacing.lg }}>
              <TouchableOpacity
                onPress={() => setEditing(!editing)}
                style={{
                  width: 88, height: 88, borderRadius: 44,
                  backgroundColor: theme.colors.primaryMuted,
                  alignItems: "center", justifyContent: "center",
                  borderWidth: 3, borderColor: theme.colors.primary,
                }}
              >
                <Text variant="h1" color={theme.colors.primary}>
                  {profile?.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                </Text>
              </TouchableOpacity>
              <Text variant="h2">{profile?.full_name ?? "Member"}</Text>
              <Badge
                variant={primaryRole === "member" ? "primary" : "info"}
                label={primaryRole?.replace("_", " ").toUpperCase() ?? "MEMBER"}
                dot
              />
            </View>
          </CardContent>
        </Card>

        {editing ? (
          <Card style={{ marginHorizontal: theme.spacing.lg }}>
            <CardHeader title="Edit Profile" />
            <CardContent style={{ gap: theme.spacing.lg }}>
              <Input label="Full Name" value={fullName} onChangeText={setFullName} />
              <Input label="Phone" value={phone ?? ""} onChangeText={setPhone} keyboardType="phone-pad" />
              <Input label="Email" value={profile?.email ?? ""} editable={false} />
              <Input label="Emergency Contact" value={emergencyContact} onChangeText={setEmergencyContact} />
              <Input label="Emergency Phone" value={emergencyPhone} onChangeText={setEmergencyPhone} keyboardType="phone-pad" />
              <View style={{ flexDirection: "row", gap: theme.spacing.md }}>
                <Button variant="primary" style={{ flex: 1 }} onPress={handleSaveProfile}>Save</Button>
                <Button variant="ghost" onPress={() => setEditing(false)}>Cancel</Button>
              </View>
            </CardContent>
          </Card>
        ) : (
          <Card style={{ marginHorizontal: theme.spacing.lg }}>
            <CardContent style={{ gap: theme.spacing.md }}>
              <ProfileInfoRow icon={<Mail size={16} />} label="Email" value={profile?.email ?? "Not set"} />
              <ProfileInfoRow icon={<Phone size={16} />} label="Phone" value={profile?.phone ?? "Not set"} />
              {profile?.emergency_contact_name && (
                <ProfileInfoRow icon={<Heart size={16} />} label="Emergency" value={`${profile.emergency_contact_name}${profile.emergency_contact_phone ? ` · ${profile.emergency_contact_phone}` : ""}`} />
              )}
            </CardContent>
          </Card>
        )}

        <View style={{ gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg }}>
          {menuItems.map((item, i) => (
            <TouchableOpacity key={i} activeOpacity={0.7} onPress={item.onPress}>
              <Card variant="muted">
                <CardContent style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primaryMuted, alignItems: "center", justifyContent: "center" }}>
                    {item.icon}
                  </View>
                  <Text variant="body" style={{ flex: 1 }}>{item.label}</Text>
                  <ChevronRight size={18} color={theme.colors.fgMuted} />
                </CardContent>
              </Card>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.xl }}>
          <Button variant="danger" size="md" fullWidth onPress={handleLogout}>
            Sign Out
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

function ProfileInfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
      <View style={{ opacity: 0.5 }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text variant="caption" muted>{label}</Text>
        <Text variant="body">{value}</Text>
      </View>
    </View>
  );
}
