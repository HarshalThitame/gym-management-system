"use client";

import { useState } from "react";
import { Download, FileText, FileSpreadsheet, FileJson, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exportDataAction, type ExportFormat } from "../actions/export-actions";

type ExportDialogProps = {
  entityType: string;
  filters?: Record<string, any>;
  columns?: string[];
};

export function ExportDialog({ entityType, filters, columns }: ExportDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("csv");

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportDataAction({
        entityType,
        format: selectedFormat,
        filters,
        columns
      });

      // Create download link
      const blob = typeof result.data === "string" 
        ? new Blob([result.data], { type: result.mimeType })
        : new Blob([result.data as Uint8Array], { type: result.mimeType });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const formats: { value: ExportFormat; label: string; icon: any }[] = [
    { value: "csv", label: "CSV", icon: FileText },
    { value: "excel", label: "Excel", icon: FileSpreadsheet },
    { value: "json", label: "JSON", icon: FileJson },
    { value: "pdf", label: "PDF", icon: FileText }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="size-5" />
          Export Data
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Select Format</label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {formats.map(format => {
                const Icon = format.icon;
                return (
                  <button
                    key={format.value}
                    onClick={() => setSelectedFormat(format.value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 transition-colors ${
                      selectedFormat === format.value
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border hover:bg-surface-muted"
                    }`}
                  >
                    <Icon className="size-5" />
                    <span className="text-xs font-medium">{format.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full"
          >
            {isExporting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span className="ml-2">Exporting...</span>
              </>
            ) : (
              <>
                <Download className="size-4" />
                <span className="ml-2">Export {entityType}</span>
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
