import React from "react";
import { View, ScrollView, TouchableOpacity } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";

export interface Column<T> {
  key: string;
  title: string;
  width?: number;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowPress?: (item: T) => void;
  emptyMessage?: string;
  keyExtractor: (item: T) => string;
}

export function DataTable<T extends Record<string, any>>({
  columns, data, onRowPress, emptyMessage = "No data available.", keyExtractor,
}: DataTableProps<T>) {
  const { theme } = useTheme();

  if (data.length === 0) {
    return (
      <View style={{ padding: theme.spacing.xl, alignItems: "center" }}>
        <Text variant="body" muted>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={{ flexDirection: "row", backgroundColor: theme.colors.bgSurfaceMuted, borderRadius: theme.radii.md, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.sm }}>
          {columns.map((col) => (
            <View key={col.key} style={{ width: col.width ?? 120, paddingHorizontal: theme.spacing.sm }}>
              <Text variant="caption" muted uppercase>{col.title}</Text>
            </View>
          ))}
        </View>
        {data.map((item) => (
          <TouchableOpacity
            key={keyExtractor(item)}
            onPress={onRowPress ? () => onRowPress(item) : undefined}
            activeOpacity={onRowPress ? 0.7 : 1}
            style={{
              flexDirection: "row",
              paddingVertical: theme.spacing.md,
              paddingHorizontal: theme.spacing.sm,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}
          >
            {columns.map((col) => (
              <View key={col.key} style={{ width: col.width ?? 120, paddingHorizontal: theme.spacing.sm }}>
                {col.render ? col.render(item) : <Text variant="body">{String(item[col.key] ?? "")}</Text>}
              </View>
            ))}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
