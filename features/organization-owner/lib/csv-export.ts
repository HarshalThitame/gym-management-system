"use client";

export function downloadCSV(headers: string[], rows: string[][], filename: string) {
  const esc = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replaceAll('"', '""')}"`;
    return v;
  };
  const csv = [headers.map(esc).join(","), ...rows.map((row) => row.map(esc).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
