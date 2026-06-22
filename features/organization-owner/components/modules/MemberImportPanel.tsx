"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, Loader2, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import type { CustomField } from "@/features/organization-owner/actions/member-field-actions";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

type ImportStep = "upload" | "preview" | "mapping" | "validation" | "importing" | "results";

type MemberImportPanelProps = {
  organizationId: string;
  onClose: () => void;
};

const SYSTEM_FIELDS = [
  { value: "full_name", label: "Full Name" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "date_of_birth", label: "Date of Birth" },
  { value: "gender", label: "Gender" },
  { value: "address", label: "Address" },
  { value: "emergency_contact_name", label: "Emergency Contact Name" },
  { value: "emergency_contact_phone", label: "Emergency Contact Phone" },
  { value: "notes", label: "Notes" },
];

export function MemberImportPanel({ organizationId, onClose }: MemberImportPanelProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [csvContent, setCsvContent] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; errors: { row: number; message: string }[] } | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [validationRows, setValidationRows] = useState<{ row: number; data: Record<string, string>; errors: string[] }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    const text = await file.text();
    setCsvContent(text);
    try {
      const { previewMemberImport } = await import("@/features/organization-owner/actions/member-import-actions");
      const { getCustomFields } = await import("@/features/organization-owner/actions/member-field-actions");
      const [previewResult, customFieldsResult] = await Promise.all([
        previewMemberImport(organizationId, text),
        getCustomFields(organizationId).catch(() => [] as CustomField[]),
      ]);
      setHeaders(previewResult.headers);
      setPreviewRows(previewResult.rows);
      setErrors(previewResult.errors);
      setCustomFields(customFieldsResult);

      if (previewResult.headers.length > 0) {
        const autoMapping: Record<string, string> = {};
        for (const h of previewResult.headers) {
          const hl = h.toLowerCase().trim();
          const sysMatch = SYSTEM_FIELDS.find((sf) => sf.value === hl);
          if (sysMatch) {
            autoMapping[h] = sysMatch.value;
          } else {
            autoMapping[h] = "skip";
          }
        }
        setFieldMapping(autoMapping);
      }
      setStep("preview");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to parse CSV.", "error");
    } finally {
      /* loading complete */
    }
  }, [organizationId]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      handleFile(file);
    } else {
      showToast("Please upload a CSV file.", "error");
    }
  }, [handleFile]);

  const handleFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const parseAllRows = useCallback((): Record<string, string>[] => {
    const fullParse = csvContent.trim().split(/\r?\n/).slice(1).map((line) => {
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
    });
    return fullParse.map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
      return obj;
    });
  }, [csvContent, headers]);

  const handleValidate = useCallback(() => {
    const allRows = parseAllRows();
    const validated: { row: number; data: Record<string, string>; errors: string[] }[] = [];
    const mappedRequired = fieldMapping;

    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      const rowErrors: string[] = [];

      // Check if at least one required system field is mapped and filled
      if (!row) continue;
      const hasNameMapping = Object.entries(mappedRequired).some(([k, v]) => k && (v === "full_name") && row[k ?? ""]?.trim());
      const hasPhoneMapping = Object.entries(mappedRequired).some(([k, v]) => k && (v === "phone") && row[k ?? ""]?.trim());

      if (!hasNameMapping && !hasPhoneMapping) {
        rowErrors.push("Missing full name or phone mapping.");
      }

      // Check custom field required values
      for (const cf of customFields) {
        if (!cf.required) continue;
        const mappedHeader = Object.keys(mappedRequired).find((k) => mappedRequired[k] === cf.field_name);
        if (mappedHeader && !row[mappedHeader]?.trim()) {
          rowErrors.push(`Required field "${cf.field_name}" is empty.`);
        }
      }

      validated.push({ row: i + 2, data: row, errors: rowErrors });
    }

    setValidationRows(validated);
    setStep("validation");
  }, [parseAllRows, fieldMapping, customFields]);

  const handleExecuteImport = async () => {
    setStep("importing");
    try {
      const { executeMemberImport } = await import("@/features/organization-owner/actions/member-import-actions");
      const allRows = parseAllRows();
      const result = await executeMemberImport(organizationId, allRows, fieldMapping);
      setImportResult(result);
      setStep("results");
      showToast(`Imported ${result.imported} members. ${result.failed} failed.`, result.failed > 0 ? "info" : "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Import failed.", "error");
      setStep("validation");
    } finally {
      /* done */
    }
  };

  const mappedFieldOptions = [
    ...SYSTEM_FIELDS,
    ...customFields.map((cf) => ({ value: cf.field_name, label: `${cf.field_name} (custom)` })),
    { value: "skip", label: "-- Skip --" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Import Members">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <h3 className="text-xl font-black">Import Members</h3>
          <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted" onClick={onClose} type="button" aria-label="Close"><X className="size-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Step 1: Upload */}
          {step === "upload" ? (
            <div
              className={`flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <Upload className="size-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-bold">Drag and drop a CSV file</p>
                <p className="text-xs text-muted-foreground">or click to select</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFilePick} className="hidden" />
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>Choose File</Button>
            </div>
          ) : null}

          {/* Step 2: Preview */}
          {step === "preview" ? (
            <>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold">{headers.length} columns detected</p>
                {errors.length > 0 ? (
                  <span className="flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="size-3" /> {errors.length} row issue(s)</span>
                ) : null}
              </div>
              {previewRows.length > 0 ? (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-muted">
                        <th className="px-3 py-2 text-xs font-bold">#</th>
                        {headers.map((h) => <th key={h} className="px-3 py-2 text-xs font-bold">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, ri) => (
                        <tr key={ri} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 text-xs text-muted-foreground">{ri + 2}</td>
                          {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-xs">{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {errors.length > 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  {errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs text-amber-800">Row {e.row}: {e.message}</p>
                  ))}
                </div>
              ) : null}
              <div className="flex justify-between">
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button variant="primary" onClick={() => setStep("mapping")}>Next: Map Fields</Button>
              </div>
            </>
          ) : null}

          {/* Step 3: Mapping */}
          {step === "mapping" ? (
            <>
              <p className="text-sm text-muted-foreground">Map each CSV column to a system or custom field. Unmapped columns will be skipped.</p>
              <div className="space-y-3">
                {headers.map((h) => (
                  <div key={h} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-sm font-medium truncate">{h}</span>
                    <select
                      className={selectClass}
                      value={fieldMapping[h] ?? "skip"}
                      onChange={(e) => setFieldMapping((prev) => ({ ...prev, [h]: e.target.value }))}
                    >
                      {mappedFieldOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => setStep("preview")}>Back</Button>
                <Button variant="primary" onClick={handleValidate}>Next: Validate</Button>
              </div>
            </>
          ) : null}

          {/* Step 4: Validation Preview */}
          {step === "validation" ? (
            <>
              <p className="text-sm text-muted-foreground">Review rows with issues before importing. Rows with errors will still be attempted; missing required fields may cause failures.</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{validationRows.length} rows total</span>
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="size-3" />
                  {validationRows.filter((r) => r.errors.length > 0).length} rows with issues
                </span>
              </div>
              {validationRows.length > 0 ? (
                <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="sticky top-0 border-b border-border bg-surface-muted">
                        <th className="px-3 py-2 font-bold">Row</th>
                        {headers.slice(0, 3).map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}
                        <th className="px-3 py-2 font-bold">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationRows.slice(0, 20).map((vr) => (
                        <tr key={vr.row} className={`border-b border-border last:border-0 ${vr.errors.length > 0 ? "bg-amber-50" : ""}`}>
                          <td className="px-3 py-1.5 text-muted-foreground">{vr.row}</td>
                          {headers.slice(0, 3).map((h) => (
                            <td key={h} className="px-3 py-1.5 truncate max-w-[120px]">{vr.data[h] ?? ""}</td>
                          ))}
                          <td className="px-3 py-1.5">
                            {vr.errors.length > 0 ? (
                              vr.errors.map((e, ei) => <p key={ei} className="text-amber-700">{e}</p>)
                            ) : (
                              <span className="text-green-600 text-xs">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {validationRows.length > 20 ? (
                        <tr><td colSpan={5} className="px-3 py-2 text-center text-muted-foreground">...and {validationRows.length - 20} more rows</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => setStep("mapping")}>Back</Button>
                <Button variant="primary" onClick={handleExecuteImport}>Import {validationRows.length} Members</Button>
              </div>
            </>
          ) : null}

          {/* Step 5: Importing */}
          {step === "importing" ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm font-bold">Importing members...</p>
              <div className="w-full max-w-xs rounded-full bg-surface-muted h-2 overflow-hidden">
                <div className="h-full rounded-full bg-primary animate-pulse" style={{ width: "60%" }} />
              </div>
              <p className="text-xs text-muted-foreground">This may take a moment for large files</p>
            </div>
          ) : null}

          {/* Step 6: Results */}
          {step === "results" && importResult ? (
            <>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 rounded-md bg-green-50 px-4 py-2">
                  <CheckCircle2 className="size-4 text-green-600" />
                  <span className="text-sm font-bold text-green-800">{importResult.imported} imported</span>
                </div>
                {importResult.failed > 0 ? (
                  <div className="flex items-center gap-2 rounded-md bg-red-50 px-4 py-2">
                    <AlertTriangle className="size-4 text-red-600" />
                    <span className="text-sm font-bold text-red-800">{importResult.failed} failed</span>
                  </div>
                ) : null}
              </div>
              {importResult.errors.length > 0 ? (
                <div className="rounded-md border border-border">
                  <div className="max-h-48 overflow-y-auto p-3 space-y-1">
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-muted-foreground">Row {e.row}: {e.message}</p>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button variant="primary" onClick={onClose}>Done</Button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
