"use client";

import { showToast } from "@/components/ui/toast";

export function notifySuccess(message: string) {
  showToast(message, "success");
}

export function notifyError(message: string) {
  showToast(message, "error");
}

export function notifyInfo(message: string) {
  showToast(message, "info");
}

export function exportToCSV(data: Record<string, unknown>[], filename: string, columns?: { key: string; label: string }[]) {
  const keys = data.length > 0 ? Object.keys(data[0] || {}) : [];
  const headers = columns ?? keys.map((k) => ({ key: k, label: k }));
  const csvRows = [headers.map((h) => `"${h.label}"`).join(",")];
  for (const row of data) {
    csvRows.push(headers.map((h) => `"${String(row[h.key] ?? "")}"`).join(","));
  }
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToJSON<T>(data: T[], filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
