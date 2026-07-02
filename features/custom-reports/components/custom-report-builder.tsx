"use client";

import { useState, useEffect } from "react";
import { FileText, Plus, Play, Save, Trash2, Loader2, Filter, Columns, SortAsc, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  getCustomReportsAction,
  createCustomReportAction,
  deleteCustomReportAction,
  executeCustomReportAction,
  getReportTemplatesAction,
  getEntityColumnsAction,
  createReportFromTemplateAction
} from "../actions/custom-reports-actions";
import type { CustomReport, ReportTemplate, ReportQueryResult } from "../services/custom-reports-service";

export function CustomReportBuilder() {
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuilding, setIsBuilding] = useState(false);
  const [queryResult, setQueryResult] = useState<ReportQueryResult | null>(null);
  const [selectedReport, setSelectedReport] = useState<CustomReport | null>(null);

  // Builder state
  const [reportName, setReportName] = useState("");
  const [entityType, setEntityType] = useState("members");
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [reportsData, templatesData] = await Promise.all([
        getCustomReportsAction(),
        getReportTemplatesAction()
      ]);
      setReports(reportsData);
      setTemplates(templatesData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEntityTypeChange = async (type: string) => {
    setEntityType(type);
    const columns = await getEntityColumnsAction(type);
    setAvailableColumns(columns);
    setSelectedColumns(columns.slice(0, 5));
  };

  const handleCreateReport = async () => {
    if (!reportName || selectedColumns.length === 0) return;

    setIsBuilding(true);
    try {
      const report = await createCustomReportAction({
        name: reportName,
        entityType,
        columns: selectedColumns
      });
      setReports([report, ...reports]);
      setShowBuilder(false);
      setReportName("");
    } catch (error) {
      console.error("Failed to create report:", error);
    } finally {
      setIsBuilding(false);
    }
  };

  const handleCreateFromTemplate = async (templateId: string) => {
    try {
      const report = await createReportFromTemplateAction(templateId);
      setReports([report, ...reports]);
    } catch (error) {
      console.error("Failed to create from template:", error);
    }
  };

  const handleExecuteReport = async (report: CustomReport) => {
    setSelectedReport(report);
    try {
      const result = await executeCustomReportAction(report.id);
      setQueryResult(result);
    } catch (error) {
      console.error("Failed to execute report:", error);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("Are you sure you want to delete this report?")) return;
    
    try {
      await deleteCustomReportAction(reportId);
      setReports(reports.filter(r => r.id !== reportId));
      if (selectedReport?.id === reportId) {
        setSelectedReport(null);
        setQueryResult(null);
      }
    } catch (error) {
      console.error("Failed to delete report:", error);
    }
  };

  const toggleColumn = (column: string) => {
    setSelectedColumns(prev =>
      prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column]
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Custom Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Report Builder */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Custom Report Builder
            </CardTitle>
            <Button size="sm" onClick={() => setShowBuilder(!showBuilder)}>
              <Plus className="size-4" />
              <span className="ml-1">New Report</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showBuilder ? (
            <div className="space-y-4 rounded-lg border border-border bg-surface-muted p-4">
              <Input
                placeholder="Report name"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
              />
              
              <div>
                <label className="text-sm font-medium">Data Source</label>
                <select
                  value={entityType}
                  onChange={(e) => handleEntityTypeChange(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm"
                >
                  <option value="members">Members</option>
                  <option value="crm_leads">Leads</option>
                  <option value="equipment">Equipment</option>
                  <option value="payments">Payments</option>
                  <option value="attendance_sessions">Attendance</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Columns</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {availableColumns.map(column => (
                    <button
                      key={column}
                      onClick={() => toggleColumn(column)}
                      className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                        selectedColumns.includes(column)
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border hover:bg-surface-muted"
                      }`}
                    >
                      {column}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleCreateReport}
                  disabled={isBuilding || !reportName || selectedColumns.length === 0}
                >
                  {isBuilding ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  <span className="ml-1">Save Report</span>
                </Button>
                <Button variant="outline" onClick={() => setShowBuilder(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Start from a template or build a custom report
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {templates.slice(0, 6).map(template => (
                  <button
                    key={template.id}
                    onClick={() => handleCreateFromTemplate(template.id)}
                    className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-surface-muted"
                  >
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                    <Badge variant="outline" className="mt-2 text-xs">{template.category}</Badge>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Saved Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              No saved reports yet. Create one above.
            </p>
          ) : (
            <div className="space-y-2">
              {reports.map(report => (
                <div
                  key={report.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{report.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs">{report.entity_type}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {report.columns.length} columns
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExecuteReport(report)}
                    >
                      <Play className="size-3.5" />
                      <span className="ml-1">Run</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteReport(report.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Query Results */}
      {queryResult && selectedReport && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{selectedReport.name} - Results</CardTitle>
              <Badge variant="outline">{queryResult.total} records</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {queryResult.columns.map(column => (
                      <th key={column} className="px-3 py-2 text-left font-medium text-muted-foreground">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResult.data.slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {queryResult.columns.map(column => (
                        <td key={column} className="px-3 py-2 text-muted-foreground">
                          {String(row[column] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {queryResult.data.length > 50 && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Showing first 50 of {queryResult.total} records
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
