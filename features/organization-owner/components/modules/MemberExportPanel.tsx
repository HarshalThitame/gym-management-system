"use client";

import { useState } from "react";
import { Download, ListFilter, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

type MemberExportPanelProps = {
  organizationId: string;
  gyms: { id: string; name: string }[];
  currentFilters?: { status?: string; gymId?: string };
  selectedMemberIds?: string[];
  onClose: () => void;
};

export function MemberExportPanel({ organizationId, gyms, currentFilters, selectedMemberIds, onClose }: MemberExportPanelProps) {
  const [status, setStatus] = useState(currentFilters?.status ?? "all");
  const [gymId, setGymId] = useState(currentFilters?.gymId ?? "all");
  const [exporting, setExporting] = useState(false);
  const [exportMode, setExportMode] = useState<"all" | "selected">("all");

  const hasSelection = selectedMemberIds && selectedMemberIds.length > 0;

  const handleExport = async (mode: "all" | "selected") => {
    setExporting(true);
    setExportMode(mode);
    try {
      const { exportMembers } = await import("@/features/organization-owner/actions/member-import-actions");

      if (mode === "selected" && selectedMemberIds && selectedMemberIds.length > 0) {
        // For selected members, fetch all and filter client-side
        const exportFilters: { status?: string; gymId?: string } = {};
        if (status !== "all") exportFilters.status = status;
        if (gymId !== "all") exportFilters.gymId = gymId;
        const csvString = await exportMembers(organizationId, Object.keys(exportFilters).length > 0 ? exportFilters : undefined);
        if (!csvString) {
          showToast("No members found matching the filters.", "info");
          return;
        }
        // Parse CSV, filter by selected IDs, re-render
        const lines = csvString.split("\n");
        const selectedSet = new Set(selectedMemberIds);
        // Filter based on member_code column (column 0)
        const filteredLines = lines.filter((line, idx) => {
          if (idx === 0) return true; // keep header
          const cols = parseCSVLine(line);
          // member_code is col 0, full_name is col 1, phone is col 2
          // We match by member_code if present
          if (cols.length > 0 && selectedSet.has(cols[0] ?? "")) return true;
          return false;
        });
        if (filteredLines.length <= 1) {
          showToast("No selected members found in the export data.", "info");
          return;
        }
        downloadCSV(filteredLines.join("\n"));
      } else {
        const filters: Record<string, string> = {};
        if (status !== "all") filters.status = status;
        if (gymId !== "all") filters.gymId = gymId;
        const csvString = await exportMembers(organizationId, Object.keys(filters).length > 0 ? filters : undefined);
        if (!csvString) {
          showToast("No members found matching the filters.", "info");
          return;
        }
        downloadCSV(csvString);
      }
      showToast("Export downloaded.", "success");
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Export failed.", "error");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Export Members">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h3 className="text-lg font-black">Export Members</h3>
          <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted" onClick={onClose} type="button" aria-label="Close"><X className="size-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          <div className="space-y-2">
            <label className="text-sm font-bold">Status</label>
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold">Gym</label>
            <select className={selectClass} value={gymId} onChange={(e) => setGymId(e.target.value)}>
              <option value="all">All Gyms</option>
              {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">Exports all system fields plus any custom fields defined for your organization.</p>

          <div className="space-y-2">
            <Button onClick={() => handleExport("all")} className="w-full" disabled={exporting} variant="primary">
              {exporting && exportMode === "all" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {exporting && exportMode === "all" ? "Exporting..." : "Export All"}
            </Button>
            <Button onClick={() => handleExport("selected")} className="w-full" disabled={!hasSelection || exporting} variant="secondary">
              {exporting && exportMode === "selected" ? <Loader2 className="size-4 animate-spin" /> : <ListFilter className="size-4" />}
              {exporting && exportMode === "selected" ? "Exporting..." : hasSelection ? `Export Selected (${selectedMemberIds!.length})` : "Export Selected"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = false; }
      } else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; } else if (ch === ",") { cells.push(current.trim()); current = ""; } else { current += ch; }
    }
  }
  cells.push(current.trim());
  return cells;
}

function downloadCSV(csvString: string) {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `members-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
