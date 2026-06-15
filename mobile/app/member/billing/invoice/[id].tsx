import React, { useEffect, useState } from "react";
import { View, ScrollView, TouchableOpacity, Alert, Platform, Share } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "@/components/ui/Text";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { billingService } from "@/services/billing-service";
import { ArrowLeft, Download, FileText, Share2 } from "lucide-react-native";
import type { Invoice } from "@/types";
import { getSupabaseClient } from "@/api/supabase";

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const loadInvoice = async () => {
    try {
      const inv = await billingService.getInvoiceDetail(id);
      setInvoice(inv);
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const url = await billingService.downloadInvoice(id);
      if (!url) {
        Alert.alert("Error", "Download not available yet.");
        return;
      }

      setLoading(true);
      const filename = `invoice-${id?.slice(0, 8)}.pdf`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      const downloadResult = await FileSystem.downloadAsync(url, fileUri);

      if (Platform.OS === "ios" || Platform.OS === "android") {
        await Share.share({
          url: downloadResult.uri,
          title: `Invoice ${invoice?.invoice_number ?? ""}`,
        });
      }

      Alert.alert("Downloaded", `Invoice saved to: ${downloadResult.uri}`);
    } catch {
      Alert.alert("Error", "Failed to download invoice. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState fullScreen />;
  if (!invoice) return <Text>Invoice not found</Text>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={24} color={theme.colors.fg} />
          </TouchableOpacity>
          <Text variant="h2">{invoice.invoice_number}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 100 }}>
        <Card variant="muted">
          <CardContent style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <FileText size={32} color={theme.colors.primary} />
              <Badge
                variant={invoice.status === "paid" ? "success" : invoice.status === "overdue" ? "danger" : "warning"}
                label={invoice.status.toUpperCase()}
                dot
              />
            </View>
            <Text variant="h3">₹{invoice.total_amount.toLocaleString()}</Text>

            <View style={{ height: 1, backgroundColor: theme.colors.border }} />

            <DetailRow label="Invoice Number" value={invoice.invoice_number} />
            <DetailRow label="Issued" value={new Date(invoice.issued_at).toLocaleDateString("en-IN")} />
            {invoice.paid_at && <DetailRow label="Paid On" value={new Date(invoice.paid_at).toLocaleDateString("en-IN")} />}
            {invoice.due_date && <DetailRow label="Due Date" value={new Date(invoice.due_date).toLocaleDateString("en-IN")} />}
            <DetailRow label="Amount" value={`₹${invoice.total_amount.toLocaleString()}`} />
            <DetailRow label="Paid" value={`₹${invoice.paid_amount.toLocaleString()}`} />
            {invoice.due_amount > 0 && (
              <DetailRow label="Due" value={`₹${invoice.due_amount.toLocaleString()}`} color={theme.colors.warning} />
            )}
            {invoice.notes && <DetailRow label="Notes" value={invoice.notes} />}
          </CardContent>
        </Card>

        <Button variant="primary" size="lg" fullWidth onPress={handleDownload}>
          <Download size={20} color={theme.colors.primaryFg} /> Download Invoice
        </Button>
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text variant="body" muted>{label}</Text>
      <Text variant="body" bold style={{ color }}>{value}</Text>
    </View>
  );
}
