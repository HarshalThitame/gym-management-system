import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { offerService, type Offer } from "@/services/offer-service";
import { Gift, Tag, Clock, Zap } from "lucide-react-native";
import { getSupabaseClient } from "@/api/supabase";

export default function OffersScreen() {
  const { theme } = useTheme();
  const { profile, organizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    try {
      if (organizationId) {
        const o = await offerService.getActiveOffers(organizationId);
        setOffers(o);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState fullScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <Text variant="h2">Offers</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        {offers.length === 0 ? (
          <EmptyState icon={<Gift size={48} />} title="No offers available" description="Check back later for promotions and special offers." />
        ) : (
          offers.map((offer) => (
            <Card key={offer.id} variant="muted">
              <CardContent style={{ gap: theme.spacing.md }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flexDirection: "row", gap: theme.spacing.sm, flex: 1 }}>
                    <Tag size={20} color={theme.colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text variant="h4">{offer.title}</Text>
                      <Text variant="bodySmall" muted style={{ marginTop: 4 }}>{offer.description}</Text>
                    </View>
                  </View>
                  {offer.discount_percentage && (
                    <Badge variant="primary" label={`${offer.discount_percentage}% OFF`} />
                  )}
                  {offer.discount_amount && (
                    <Badge variant="primary" label={`₹${offer.discount_amount} OFF`} />
                  )}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
                  <Clock size={14} color={theme.colors.fgMuted} />
                  <Text variant="caption" muted>
                    Valid until {new Date(offer.valid_until).toLocaleDateString("en-IN")}
                  </Text>
                </View>
                {offer.terms && (
                  <Text variant="caption" muted>{offer.terms}</Text>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
