"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import type { AnalyticsInsightRow, DashboardConfigRow, ForecastModelRow, SavedReportRow } from "@/types/analytics";
import { analyticsReportKeys, dashboardScopes, forecastModelTypes, reportCategories, reportFormats } from "@/types/analytics";
import {
  queueReportExportAction,
  saveDashboardConfigAction,
  saveForecastModelAction,
  saveSavedReportAction,
  updateInsightStatusAction
} from "../actions/analytics-actions";
import { formatAnalyticsLabel } from "../lib/business-rules";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

export function DashboardConfigForm({ configs }: { configs: DashboardConfigRow[] }) {
  const [state, formAction] = useActionState(saveDashboardConfigAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <select className={selectClass} name="dashboardConfigId" defaultValue="" aria-label="Dashboard layout">
        <option value="">Create new layout</option>
        {configs.map((config) => <option key={config.id} value={config.id}>{config.name}</option>)}
      </select>
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="dashboard-name" label="Layout name" name="name" state={state}><Input id="dashboard-name" name="name" placeholder="Owner executive dashboard" /></Field>
        <SelectField label="Role" name="roleName" options={["super_admin", "gym_admin", "reception_staff", "trainer", "member"]} />
        <SelectField label="Scope" name="scope" options={dashboardScopes} />
      </div>
      <Field id="dashboard-layout" label="Layout JSON" name="layout" state={state}>
        <Textarea id="dashboard-layout" name="layout" defaultValue='[{"id":"revenue","x":0,"y":0,"w":6,"h":3}]' />
      </Field>
      <Field id="dashboard-widgets" label="Widgets JSON" name="widgets" state={state}>
        <Textarea id="dashboard-widgets" name="widgets" defaultValue='["today_revenue","monthly_revenue","active_members","attendance_today"]' />
      </Field>
      <label className="flex items-center gap-2 text-sm font-bold"><input name="isDefault" type="checkbox" /> Use as default layout</label>
      <AuthSubmitButton>Save Layout</AuthSubmitButton>
    </form>
  );
}

export function SavedReportForm({ reports }: { reports: SavedReportRow[] }) {
  const [state, formAction] = useActionState(saveSavedReportAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <select className={selectClass} name="savedReportId" defaultValue="" aria-label="Saved report">
        <option value="">Create new report template</option>
        {reports.map((report) => <option key={report.id} value={report.id}>{report.name}</option>)}
      </select>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="report-name" label="Report name" name="name" state={state}><Input id="report-name" name="name" placeholder="Monthly revenue source analysis" /></Field>
        <SelectField label="Report key" name="reportKey" options={analyticsReportKeys} />
      </div>
      <Field id="report-description" label="Description" name="description" state={state}><Textarea id="report-description" name="description" placeholder="What this report answers and who should use it." /></Field>
      <div className="grid gap-4 md:grid-cols-3">
        <SelectField label="Category" name="category" options={reportCategories} />
        <SelectField label="Visibility" name="visibility" options={["private", "role", "gym"]} />
        <SelectField label="Status" name="status" options={["active", "archived"]} />
      </div>
      <Field id="report-filters" label="Default filters JSON" name="filters" state={state}><Textarea id="report-filters" name="filters" defaultValue='{"range":"last_30_days"}' /></Field>
      <Field id="report-columns" label="Columns JSON" name="columns" state={state}><Textarea id="report-columns" name="columns" defaultValue='["metric","value","change"]' /></Field>
      <AuthSubmitButton>Save Report</AuthSubmitButton>
    </form>
  );
}

export function ReportExportForm({ reports }: { reports: SavedReportRow[] }) {
  const [state, formAction] = useActionState(queueReportExportAction, initialAuthActionState);
  const defaultReport = reports[0];
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <select className={selectClass} name="savedReportId" defaultValue={defaultReport?.id ?? ""} aria-label="Report">
        {reports.map((report) => <option key={report.id} value={report.id}>{report.name}</option>)}
      </select>
      <div className="grid gap-4 md:grid-cols-3">
        <SelectField label="Report key" name="reportKey" options={analyticsReportKeys} />
        <SelectField label="Category" name="category" options={reportCategories} />
        <SelectField label="Format" name="format" options={reportFormats} />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Input name="from" type="date" aria-label="From date" />
        <Input name="to" type="date" aria-label="To date" />
        <Input name="status" placeholder="Status filter" aria-label="Status filter" />
        <Input name="trainerId" placeholder="Trainer ID" aria-label="Trainer ID" />
      </div>
      <AuthSubmitButton>Queue Export</AuthSubmitButton>
      <div className="grid gap-2 sm:grid-cols-3">
        <ButtonLink href="/api/analytics/reports?key=executive_kpi_snapshot&format=csv" variant="secondary">KPI CSV</ButtonLink>
        <ButtonLink href="/api/analytics/reports?key=revenue_sources&format=excel" variant="secondary">Revenue Excel</ButtonLink>
        <ButtonLink href="/api/analytics/reports?key=trainer_scorecard&format=pdf" variant="secondary">Trainer PDF</ButtonLink>
      </div>
    </form>
  );
}

export function ForecastModelForm({ models }: { models: ForecastModelRow[] }) {
  const [state, formAction] = useActionState(saveForecastModelAction, initialAuthActionState);
  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <select className={selectClass} name="forecastModelId" defaultValue="" aria-label="Forecast model">
        <option value="">Create new model</option>
        {models.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
      </select>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="forecast-name" label="Name" name="name" state={state}><Input id="forecast-name" name="name" placeholder="Revenue 30-day forecast" /></Field>
        <Field id="forecast-metric" label="Metric key" name="metricKey" state={state}><Input id="forecast-metric" name="metricKey" placeholder="monthly_revenue" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SelectField label="Model type" name="modelType" options={forecastModelTypes} />
        <Field id="forecast-horizon" label="Horizon days" name="horizonDays" state={state}><Input id="forecast-horizon" name="horizonDays" defaultValue="30" type="number" /></Field>
        <Field id="forecast-window" label="Training window" name="trainingWindowDays" state={state}><Input id="forecast-window" name="trainingWindowDays" defaultValue="180" type="number" /></Field>
      </div>
      <SelectField label="Status" name="status" options={["active", "paused", "archived"]} />
      <Field id="forecast-parameters" label="Parameters JSON" name="parameters" state={state}><Textarea id="forecast-parameters" name="parameters" defaultValue='{"seasonality":"weekly"}' /></Field>
      <AuthSubmitButton>Save Forecast Model</AuthSubmitButton>
    </form>
  );
}

export function InsightStatusForm({ insight }: { insight: AnalyticsInsightRow }) {
  const [state, formAction] = useActionState(updateInsightStatusAction, initialAuthActionState);
  if (insight.id.startsWith("generated-")) {
    return null;
  }
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <FormMessage state={state} />
      <input name="insightId" type="hidden" value={insight.id} />
      <Button name="status" size="sm" type="submit" value="acknowledged" variant="secondary">Acknowledge</Button>
      <Button name="status" size="sm" type="submit" value="resolved" variant="ghost">Resolve</Button>
    </form>
  );
}

function Field({ id, label, name, state, children }: { id?: string; label: string; name: string; state: { fieldErrors?: Record<string, string[]> }; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold" htmlFor={id ?? name}>{label}</label>
      {children}
      <FieldError message={state.fieldErrors?.[name]?.[0]} />
    </div>
  );
}

function SelectField({ label, name, options }: { label: string; name: string; options: readonly string[] }) {
  return (
    <label className="space-y-2 text-sm font-bold">
      <span>{label}</span>
      <select className={selectClass} name={name} defaultValue={options[0] ?? ""}>
        {options.map((option) => <option key={option} value={option}>{formatAnalyticsLabel(option)}</option>)}
      </select>
    </label>
  );
}
