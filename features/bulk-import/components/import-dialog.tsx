"use client";

import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  importMembersAction, 
  importLeadsAction, 
  importEquipmentAction,
  validateCsvAction,
  previewCsvAction
} from "../actions/import-actions";
import type { ImportResult } from "../services/import-service";

type ImportDialogProps = {
  entityType: "members" | "crm_leads" | "equipment";
  onImportComplete?: () => void;
};

export function ImportDialog({ entityType, onImportComplete }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ total: number; preview: any[]; headers: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      setValidationErrors(["Please select a CSV file"]);
      return;
    }

    setFile(selectedFile);
    setValidationErrors([]);
    setResult(null);
    setPreview(null);

    const content = await selectedFile.text();
    setCsvContent(content);

    // Preview and validate
    const [previewResult, validationResult] = await Promise.all([
      previewCsvAction(content),
      validateCsvAction(content, entityType)
    ]);

    setPreview(previewResult);
    if (!validationResult.valid) {
      setValidationErrors(validationResult.errors);
    }
  };

  const handleImport = async () => {
    if (!csvContent) return;

    setIsProcessing(true);
    setResult(null);

    try {
      let importResult: ImportResult;

      switch (entityType) {
        case "members":
          importResult = await importMembersAction(csvContent);
          break;
        case "crm_leads":
          importResult = await importLeadsAction(csvContent);
          break;
        case "equipment":
          importResult = await importEquipmentAction(csvContent);
          break;
      }

      setResult(importResult);
      if (importResult.success) {
        onImportComplete?.();
      }
    } catch (error) {
      console.error("Import failed:", error);
      setResult({
        success: false,
        total: 0,
        imported: 0,
        failed: 0,
        errors: [{ row: 0, message: "Import failed" }]
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setCsvContent("");
    setResult(null);
    setValidationErrors([]);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const entityLabel = {
    members: "Members",
    crm_leads: "Leads",
    equipment: "Equipment"
  }[entityType];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="size-5" />
          Import {entityLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Upload */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-lg border-2 border-dashed border-border p-8 text-center transition-colors hover:border-accent hover:bg-accent/5"
        >
          <Upload className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">
            {file ? file.name : "Click to upload CSV file"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            CSV format required
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-4" />
              <span className="text-sm font-medium">Validation Errors</span>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-destructive">
              {validationErrors.map((error, i) => (
                <li key={i}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview */}
        {preview && preview.total > 0 && validationErrors.length === 0 && (
          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Preview</span>
              <Badge variant="outline">{preview.total} rows</Badge>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {preview.headers.map(header => (
                      <th key={header} className="px-2 py-1 text-left font-medium text-muted-foreground">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {preview.headers.map(header => (
                        <td key={header} className="px-2 py-1 text-muted-foreground">
                          {String(row[header] || "").substring(0, 20)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`rounded-lg border p-3 ${result.success ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"}`}>
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <XCircle className="size-4 text-destructive" />
              )}
              <span className="text-sm font-medium">
                {result.success ? "Import Successful" : "Import Completed with Errors"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Total:</span>{" "}
                <span className="font-medium">{result.total}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Imported:</span>{" "}
                <span className="font-medium text-success">{result.imported}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Failed:</span>{" "}
                <span className="font-medium text-destructive">{result.failed}</span>
              </div>
            </div>
            {result.errors.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-destructive">
                {result.errors.slice(0, 5).map((error, i) => (
                  <li key={i}>Row {error.row}: {error.message}</li>
                ))}
                {result.errors.length > 5 && (
                  <li>... and {result.errors.length - 5} more errors</li>
                )}
              </ul>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {file && (
            <Button
              onClick={handleImport}
              disabled={isProcessing || validationErrors.length > 0}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span className="ml-2">Importing...</span>
                </>
              ) : (
                <>
                  <Upload className="size-4" />
                  <span className="ml-2">Import {entityLabel}</span>
                </>
              )}
            </Button>
          )}
          {(file || result) && (
            <Button variant="outline" onClick={reset}>
              Reset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
