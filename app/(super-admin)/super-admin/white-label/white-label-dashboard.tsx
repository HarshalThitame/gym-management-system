"use client";

import { useMemo, useState, useTransition, useEffect, useRef } from "react";
import NextImage from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { saveTenantConfigAction } from "@/features/super-admin/actions/white-label-actions";
import {
  ArrowLeftRight, CheckCircle2, Download, EyeOff,
  Globe2,
  Mail,
  Monitor,
  PaintBucket,
  Palette,
  Search,
  Shield,
  Shirt,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { showToast } from "@/components/ui/toast";
import { FileUploadZone } from "@/features/enterprise/components/FileUploadZone";
import { AccessibilityBadge } from "@/features/enterprise/components/AccessibilityBadge";
import { AuditTimeline } from "@/features/enterprise/components/AuditTimeline";
import { DevicePreviewToggle, getDeviceWidth } from "@/features/enterprise/components/DevicePreviewToggle";

const tabs = ["brand-assets", "theme-editor", "email", "login", "health"] as const;
type DetailTab = (typeof tabs)[number];

const tabLabels: Record<DetailTab, string> = {
  "brand-assets": "Brand Assets",
  "theme-editor": "Theme Editor",
  email: "Email",
  login: "Login",
  health: "Health",
};

const tabIcons: Record<DetailTab, typeof Palette> = {
  "brand-assets": Palette,
  "theme-editor": PaintBucket,
  email: Mail,
  login: Shield,
  health: Monitor,
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "\u2014";
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
  } catch {
    return "\u2014";
  }
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge variant="neutral">Unknown</Badge>;
  const s = status.toLowerCase();
  const variant =
    s === "active" || s === "published" || s === "verified"
      ? "success"
      : s === "inactive" || s === "draft"
        ? "warning"
        : s === "suspended" || s === "archived"
          ? "error"
          : "neutral";
  return <Badge variant={variant as "success" | "warning" | "error" | "neutral"}>{status}</Badge>;
}

function PlanBadge({ plan }: { plan: string | null | undefined }) {
  if (!plan) return null;
  const p = plan.toLowerCase();
  if (p === "enterprise") return <Badge variant="premium">Enterprise</Badge>;
  if (p === "business") return <Badge variant="success">Business</Badge>;
  return <Badge variant="neutral">{plan}</Badge>;
}

type WhiteLabelDashboardProps = {
  configs: Array<Record<string, unknown>>;
  organizations: Array<Record<string, unknown>>;
  domains: Array<Record<string, unknown>>;
  stats: { total: number; active: number; enterprise: number; withCustomDomain: number };
  module: { title: string; description: string; slug: string };
};

export default function WhiteLabelDashboard(props: WhiteLabelDashboardProps) {
  const { configs, organizations, domains, stats, module } = props;

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [planFilter, setPlanFilter] = useState("all");
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("brand-assets");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery]);

  const orgMap = useMemo(() => new Map(organizations.map((o) => [o.id as string, o])), [organizations]);
  const domainMap = useMemo(() => {
    const m = new Map<string, Array<Record<string, unknown>>>();
    for (const d of domains) {
      const oid = d.organization_id as string;
      if (!m.has(oid)) m.set(oid, []);
      m.get(oid)!.push(d);
    }
    return m;
  }, [domains]);

  const filteredConfigs = useMemo(() => {
    let list = configs;
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((c) => {
        const brand = (c.brand_name as string ?? "").toLowerCase();
        const orgId = c.organization_id as string;
        const org = orgMap.get(orgId);
        const orgName = (org?.name as string ?? "").toLowerCase();
        const tenant = (c.tenant_key as string ?? "").toLowerCase();
        return brand.includes(q) || orgName.includes(q) || tenant.includes(q);
      });
    }
    if (planFilter !== "all") {
      list = list.filter((c) => (c.plan_tier as string) === planFilter);
    }
    return list;
  }, [configs, searchQuery, planFilter, orgMap]);

  const selectedConfig = useMemo(() => {
    if (!selectedConfigId) return null;
    return configs.find((c) => c.id === selectedConfigId) ?? null;
  }, [configs, selectedConfigId]);

  const selectedOrg = useMemo(() => {
    if (!selectedConfig) return null;
    return orgMap.get(selectedConfig.organization_id as string) ?? null;
  }, [selectedConfig, orgMap]);

  const selectedDomains = useMemo(() => {
    if (!selectedConfig) return [];
    return domainMap.get(selectedConfig.organization_id as string) ?? [];
  }, [selectedConfig, domainMap]);

  const hasChanges = useMemo(() => {
    if (!selectedConfig || !editingConfig) return false;
    return JSON.stringify(selectedConfig) !== JSON.stringify(editingConfig);
  }, [selectedConfig, editingConfig]);

  function handleConfigClick(id: string) {
    setSelectedConfigId(id);
    const cfg = configs.find((c) => c.id === id);
    if (cfg) {
      setEditingConfig({ ...cfg });
    } else {
      setEditingConfig(null);
    }
    setActiveTab("brand-assets");
  }

  function handleCloseDetail() {
    setSelectedConfigId(null);
    setEditingConfig(null);
  }

  function handleSave() {
    if (!editingConfig || !selectedConfigId) return;
    startTransition(async () => {
      try {
        await saveTenantConfigAction(selectedConfigId, editingConfig);
        const saved = configs.map((c) => (c.id === selectedConfigId ? editingConfig : c))
          .filter((c): c is Record<string, unknown> => c !== null)
          .find((c) => c.id === selectedConfigId);
        if (saved) {
          setEditingConfig({ ...saved });
        }
        showToast("Brand config saved successfully", "success");
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Failed to save brand config", "error");
      }
    });
  }

  function handleColorChange(key: string, value: string) {
    if (!editingConfig) return;
    const colors = (editingConfig.brand_colors as Record<string, string>) ?? {};
    setEditingConfig({ ...editingConfig, brand_colors: { ...colors, [key]: value } });
  }

  const kpiCards = [
    { label: "Total Configs", value: stats.total, icon: <PaintBucket className="size-5 text-muted-foreground" /> },
    { label: "Active", value: stats.active, icon: <CheckCircle2 className="size-5 text-green-600" /> },
    { label: "Enterprise", value: stats.enterprise, icon: <Shield className="size-5 text-purple-600" /> },
    { label: "Custom Domain", value: stats.withCustomDomain, icon: <Globe2 className="size-5 text-amber-600" /> },
  ];

  const healthChecks = [
    { label: "Brand Config exists", key: "hasConfig" },
    { label: "Domain configured", key: "hasDomain" },
    { label: "SSL enabled", key: "hasSSL" },
    { label: "Brand colors set", key: "hasColors" },
    { label: "Logo uploaded", key: "hasLogo" },
    { label: "Tenant key valid", key: "hasTenantKey" },
  ];

  const originalColors: Record<string, string> = {};
  if (selectedConfig) {
    const cols = (selectedConfig as Record<string, unknown>).brand_colors as Record<string, unknown> ?? {};
    for (const [k, v] of Object.entries(cols)) originalColors[k] = v as string;
  }

  function renderThemePreview(colors: Record<string, string>, brandName: string) {
    const primary = colors.primary ?? "#6366f1";
    const secondary = colors.secondary ?? "#8b5cf6";
    const accent = colors.accent ?? "#f59e0b";
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="p-4" style={{ backgroundColor: primary, color: "#fff" }}>
          <p className="text-lg font-bold">{brandName}</p>
          <p className="text-sm opacity-80">Welcome to your branded portal</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="h-3 w-3/4 rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted" />
          <div className="flex gap-2 mt-4">
            <span className="px-3 py-1.5 rounded text-xs font-bold text-white" style={{ backgroundColor: primary }}>Primary</span>
            <span className="px-3 py-1.5 rounded text-xs font-bold text-white" style={{ backgroundColor: secondary }}>Secondary</span>
            <span className="px-3 py-1.5 rounded text-xs font-bold text-white" style={{ backgroundColor: accent }}>Accent</span>
          </div>
          <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: `${primary}15`, borderLeft: `4px solid ${primary}` }}>
            <p className="text-xs font-semibold" style={{ color: primary }}>Sample Card</p>
            <p className="text-xs text-muted-foreground mt-1">This is how themed cards will appear across the platform.</p>
          </div>
        </div>
        <div className="p-3 border-t border-border text-xs text-muted-foreground text-center">
          {brandName} &middot; Powered by Gym Discovery
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Enterprise Branding</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{module.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{module.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedConfig && (
            <a href={`/api/enterprise/branding/export?configId=${selectedConfig.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-surface-muted">
              <Download className="size-4" /> Export
            </a>
          )}
          <Badge variant="neutral" className="text-xs">{module.slug}</Badge>
        </div>
      </div>

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-surface p-5 shadow-xs transition-all hover:shadow-sm hover:border-border-strong">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{kpi.label}</p>
              {kpi.icon}
            </div>
            <p className="mt-3 text-3xl font-black">{kpi.value}</p>
          </div>
        ))}
      </section>

      {/* Search + Filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search brand name, organization, tenant key..."
            className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm shadow-sm"
            aria-label="Search brand configs"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="h-11 rounded-md border border-border bg-surface px-3 text-sm shadow-sm"
          aria-label="Filter by plan tier"
        >
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="starter">Starter</option>
          <option value="business">Business</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
          <span className="text-sm font-semibold">{selectedIds.size} selected</span>
          <Button size="sm" variant="secondary" onClick={() => { showToast("Export started", "info"); setSelectedIds(new Set()); }}>Export Selected</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      {/* Configs Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="border-b border-border text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
              <th className="p-3 text-left w-8"><input type="checkbox" onChange={(e) => setSelectedIds(e.target.checked ? new Set(filteredConfigs.map((c) => c.id as string)) : new Set())} checked={selectedIds.size === filteredConfigs.length && filteredConfigs.length > 0} className="rounded" /></th>
              <th className="p-3 text-left">Brand</th>
              <th className="p-3 text-left hidden sm:table-cell">Plan</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left hidden md:table-cell">Domain</th>
              <th className="p-3 text-left hidden lg:table-cell">Org</th>
              <th className="p-3 text-left hidden xl:table-cell">Colors</th>
              <th className="p-3 text-left hidden xl:table-cell">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredConfigs.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">No brand configs found.</td>
              </tr>
            )}
            {filteredConfigs.map((cfg) => {
              const cid = cfg.id as string;
              const org = orgMap.get(cfg.organization_id as string);
              const colors = (cfg.brand_colors as Record<string, string>) ?? {};
              return (
                <tr
                  key={cid}
                  onClick={() => handleConfigClick(cid)}
                  className={`cursor-pointer transition-colors hover:bg-muted/30 ${selectedConfigId === cid ? "bg-muted/50" : ""}`}
                >
                  <td className="p-3"><input type="checkbox" checked={selectedIds.has(cid)} onChange={(e) => setSelectedIds((prev) => { const n = new Set(prev); if (e.target.checked) n.add(cid); else n.delete(cid); return n; })} className="rounded" onClick={(e) => e.stopPropagation()} /></td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{cfg.brand_name as string ?? "Unnamed Brand"}</span>
                    </div>
                  </td>
                  <td className="p-3 hidden sm:table-cell"><PlanBadge plan={cfg.plan_tier as string} /></td>
                  <td className="p-3"><StatusBadge status={cfg.status as string} /></td>
                  <td className="p-3 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground max-w-[180px] truncate block">
                      {cfg.custom_domain ? (cfg.custom_domain as string) : "\u2014"}
                    </span>
                  </td>
                  <td className="p-3 hidden lg:table-cell">
                    <span className="text-xs truncate max-w-[150px] block">{org?.name as string ?? "\u2014"}</span>
                  </td>
                  <td className="p-3 hidden xl:table-cell">
                    <div className="flex gap-1">
                      {["primary", "secondary", "accent"].map((k) => {
                        const c = colors[k] as string;
                        if (!c) return null;
                        return (
                          <span
                            key={k}
                            className="inline-block h-4 w-4 rounded-full border border-border"
                            style={{ backgroundColor: c }}
                            title={`${k}: ${c}`}
                          />
                        );
                      })}
                    </div>
                  </td>
                  <td className="p-3 hidden xl:table-cell text-xs text-muted-foreground">{formatDate(cfg.created_at as string)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Results count */}
      <div className="text-xs font-semibold text-muted-foreground">
        {filteredConfigs.length} result{filteredConfigs.length !== 1 ? "s" : ""}
        {selectedConfig && (
          <button onClick={handleCloseDetail} className="ml-4 text-primary hover:underline">Close detail</button>
        )}
      </div>

      {/* Detail Panel */}
      {selectedConfig && editingConfig && selectedOrg && (
        <Card className="p-4 sm:p-6">
          {/* Detail Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold">{editingConfig.brand_name as string ?? "Unnamed Brand"}</h2>
                <StatusBadge status={editingConfig.status as string} />
                <PlanBadge plan={editingConfig.plan_tier as string} />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedOrg.name as string} &middot; Tenant: {editingConfig.tenant_key as string ?? "\u2014"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={!hasChanges || isPending}>{isPending ? "Saving..." : "Save Changes"}</Button>
              <Button size="sm" variant="ghost" onClick={handleCloseDetail}>Close</Button>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex gap-1 p-1 rounded-lg bg-muted/50 mb-4 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tabIcons[tab];
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                    activeTab === tab ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  {tabLabels[tab]}
                </button>
              );
            })}
          </div>

          {/* Brand Assets Tab */}
          {activeTab === "brand-assets" && (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Logo */}
                <Card>
                  <CardHeader><h3 className="text-sm font-bold">Logo</h3></CardHeader>
                  <CardContent className="space-y-3">
                    <FileUploadZone configId={selectedConfig?.id as string ?? ""} currentUrl={editingConfig.logo_url as string ?? null} type="logo" onUploaded={(url) => setEditingConfig({ ...editingConfig, logo_url: url })} />
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-muted-foreground">Logo URL</label>
                        <input value={editingConfig.logo_url as string ?? ""} onChange={(e) => setEditingConfig({ ...editingConfig, logo_url: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="https://..." />
                      </div>
                      <div className="shrink-0"><AccessibilityBadge fg={(editingConfig.brand_colors as Record<string, string>)?.primary ?? "#000"} bg="#fff" /></div>
                    </div>
                  </CardContent>
                </Card>

                {/* Favicon */}
                <Card>
                  <CardHeader><h3 className="text-sm font-bold">Favicon</h3></CardHeader>
                  <CardContent className="space-y-3">
                    <FileUploadZone configId={selectedConfig?.id as string ?? ""} currentUrl={editingConfig.favicon_url as string ?? null} type="favicon" onUploaded={(url) => setEditingConfig({ ...editingConfig, favicon_url: url })} />
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Favicon URL</label>
                      <input value={editingConfig.favicon_url as string ?? ""} onChange={(e) => setEditingConfig({ ...editingConfig, favicon_url: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm" placeholder="https://..." />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Color Palette */}
              <Card>
                <CardHeader><h3 className="text-sm font-bold">Color Palette</h3></CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {["primary", "secondary", "accent"].map((key) => {
                      const colors = (editingConfig.brand_colors as Record<string, string>) ?? {};
                      const hex = colors[key] as string ?? "#6366f1";
                      return (
                        <div key={key} className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground capitalize">{key}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={hex}
                              onChange={(e) => handleColorChange(key, e.target.value)}
                              className="h-10 w-10 rounded-md border border-border cursor-pointer"
                            />
                            <input
                              value={hex}
                              onChange={(e) => handleColorChange(key, e.target.value)}
                              className="flex-1 h-9 rounded-md border border-border bg-surface px-3 text-xs font-mono"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Accessibility Check */}
              <Card>
                <CardHeader><h3 className="text-sm font-bold">Accessibility</h3></CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {(() => {
                      const pc = (editingConfig.brand_colors as Record<string, string>)?.primary ?? "#000";
                      const sc = (editingConfig.brand_colors as Record<string, string>)?.secondary ?? "#000";
                      const ac = (editingConfig.brand_colors as Record<string, string>)?.accent ?? "#000";
                      return (
                        <>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                            <span className="text-xs">Primary on White</span>
                            <AccessibilityBadge fg={pc} bg="#ffffff" />
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                            <span className="text-xs">Secondary on White</span>
                            <AccessibilityBadge fg={sc} bg="#ffffff" />
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                            <span className="text-xs">Accent on White</span>
                            <AccessibilityBadge fg={ac} bg="#ffffff" />
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-muted/30">
                            <span className="text-xs">White text on Primary</span>
                            <AccessibilityBadge fg="#ffffff" bg={pc} />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Theme Editor Tab */}
          {activeTab === "theme-editor" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                {/* Typography */}
                <Card>
                  <CardHeader><h3 className="text-sm font-bold">Typography</h3></CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Heading Font</label>
                      <input
                        value={editingConfig.heading_font as string ?? "Inter"}
                        readOnly
                        className="mt-1 h-9 w-full rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Body Font</label>
                      <input
                        value={editingConfig.body_font as string ?? "Inter"}
                        readOnly
                        className="mt-1 h-9 w-full rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Brand Identity */}
                <Card>
                  <CardHeader><h3 className="text-sm font-bold">Brand Identity</h3></CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Brand Name</label>
                      <input
                        value={editingConfig.brand_name as string ?? ""}
                        onChange={(e) => setEditingConfig({ ...editingConfig, brand_name: e.target.value })}
                        className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Tenant Key</label>
                      <input
                        value={editingConfig.tenant_key as string ?? ""}
                        readOnly
                        className="mt-1 h-9 w-full rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Live Preview */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <h3 className="text-sm font-bold">{compareMode ? "Before / After Comparison" : "Live Preview"}</h3>
                  <button onClick={() => setCompareMode(!compareMode)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <ArrowLeftRight className="size-3.5" />
                    {compareMode ? "Show After" : "Compare"}
                  </button>
                </CardHeader>
                <CardContent>
                  {renderThemePreview(compareMode ? originalColors : editingConfig.brand_colors as Record<string, string> ?? {}, editingConfig.brand_name as string ?? "Brand")}
                  {compareMode && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">After</p>
                      {renderThemePreview(editingConfig.brand_colors as Record<string, string> ?? {}, editingConfig.brand_name as string ?? "Brand")}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Email Tab */}
          {activeTab === "email" && (
            <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Sender Settings */}
              <Card>
                <CardHeader><h3 className="text-sm font-bold">Sender Settings</h3></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">From Name</label>
                    <input
                      value={editingConfig.email_from_name as string ?? ""}
                      onChange={(e) => setEditingConfig({ ...editingConfig, email_from_name: e.target.value })}
                      className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Reply-To Email</label>
                    <input
                      value={editingConfig.email_reply_to as string ?? ""}
                      onChange={(e) => setEditingConfig({ ...editingConfig, email_reply_to: e.target.value })}
                      className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm"
                      placeholder="reply@example.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Logo URL (Email)</label>
                    <input
                      value={editingConfig.logo_url as string ?? ""}
                      readOnly
                      className="mt-1 h-9 w-full rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Email Preview */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <h3 className="text-sm font-bold">Email Preview</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">Preview</Badge>
                    <DevicePreviewToggle device={previewDevice} onChange={setPreviewDevice} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mx-auto overflow-hidden rounded-lg border border-border shadow-sm transition-all" style={{ maxWidth: getDeviceWidth(previewDevice) }}>
                  {(() => {
                    const colors = (editingConfig.brand_colors as Record<string, string>) ?? {};
                    const primary = colors.primary as string ?? "#6366f1";
                    const brandName = editingConfig.brand_name as string ?? "Brand";
                    return (
                      <div className="rounded-lg border border-border overflow-hidden bg-white max-w-sm mx-auto">
                        <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 text-center text-[10px] font-semibold text-amber-700 uppercase tracking-wider">Sample Preview</div>
                        <div className="p-3 text-center" style={{ backgroundColor: primary }}>
                          {editingConfig.logo_url ? (
                            <NextImage src={editingConfig.logo_url as string} alt="" className="mx-auto h-8 w-auto" width={128} height={32} unoptimized />
                          ) : (
                            <span className="text-white font-bold text-sm">{brandName}</span>
                          )}
                        </div>
                        <div className="p-4 space-y-3 text-left">
                          <h4 className="text-sm font-bold text-gray-900">Welcome to {brandName}!</h4>
                          <p className="text-xs text-gray-600">This is a sample preview of how branded emails will appear. Actual email content will be generated from real system events.</p>
                          <div className="text-center">
                            <span className="inline-block px-4 py-2 rounded text-xs font-bold text-white" style={{ backgroundColor: primary }}>Get Started</span>
                          </div>
                          <p className="text-xs text-gray-500">If you have any questions, just reply to this email.</p>
                        </div>
                        <div className="p-3 border-t border-gray-200 text-center text-xs text-gray-400">
                          &copy; {new Date().getFullYear()} {brandName}. All rights reserved.
                        </div>
                      </div>
                    );
                  })()}
                </div>
                </CardContent>
              </Card>
            </div>

            {/* Test Email Button */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-semibold">Send Test Email</p><p className="text-xs text-muted-foreground">Verify email branding renders correctly in your inbox</p></div>
                <TestEmailButton config={selectedConfig ?? {}} editingConfig={editingConfig} />
              </div>
            </Card>
            </div>
          )}

          {/* Login Tab */}
          {activeTab === "login" && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Login Page Settings */}
              <Card>
                <CardHeader><h3 className="text-sm font-bold">Login Page Settings</h3></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Brand Name</label>
                    <input
                      value={editingConfig.brand_name as string ?? ""}
                      onChange={(e) => setEditingConfig({ ...editingConfig, brand_name: e.target.value })}
                      className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Primary Color</label>
                    {(() => {
                      const colors = (editingConfig.brand_colors as Record<string, string>) ?? {};
                      const hex = colors.primary as string ?? "#6366f1";
                      return (
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="color"
                            value={hex}
                            onChange={(e) => handleColorChange("primary", e.target.value)}
                            className="h-9 w-9 rounded-md border border-border cursor-pointer"
                          />
                          <input
                            value={hex}
                            readOnly
                            className="flex-1 h-9 rounded-md border border-border bg-muted px-3 text-xs font-mono text-muted-foreground cursor-not-allowed"
                          />
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Custom Domain</label>
                    <input
                      value={editingConfig.custom_domain as string ?? ""}
                      readOnly
                      className="mt-1 h-9 w-full rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Tenant Key</label>
                    <input
                      value={editingConfig.tenant_key as string ?? ""}
                      readOnly
                      className="mt-1 h-9 w-full rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Login Preview */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <h3 className="text-sm font-bold">Login Page Preview</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="warning">Preview</Badge>
                    <DevicePreviewToggle device={previewDevice} onChange={setPreviewDevice} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mx-auto overflow-hidden rounded-lg border border-border shadow-sm transition-all" style={{ maxWidth: getDeviceWidth(previewDevice) }}>
                  {(() => {
                    const colors = (editingConfig.brand_colors as Record<string, string>) ?? {};
                    const primary = colors.primary as string ?? "#6366f1";
                    const brandName = editingConfig.brand_name as string ?? "Brand";
                    return (
                      <div className="rounded-lg border border-border overflow-hidden bg-white max-w-sm mx-auto">
                        <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 text-center text-[10px] font-semibold text-amber-700 uppercase tracking-wider">Sample Preview</div>
                        <div className="p-6 text-center" style={{ backgroundColor: primary }}>
                          <div className="h-12 w-12 rounded-full bg-white/20 mx-auto flex items-center justify-center">
                            {editingConfig.logo_url ? (
                              <NextImage src={editingConfig.logo_url as string} alt="" className="h-8 w-8 rounded-full object-cover" width={32} height={32} unoptimized />
                            ) : (
                              <Shirt className="size-6 text-white" />
                            )}
                          </div>
                          <h3 className="mt-3 text-lg font-bold text-white">{brandName}</h3>
                          <p className="text-xs text-white/70">Sample login screen preview</p>
                        </div>
                        <div className="p-4 space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-700">Email</label>
                            <div className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-gray-50 px-3 text-sm text-gray-400 flex items-center">member@example.com</div>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-700">Password</label>
                            <div className="mt-1 h-9 w-full rounded-md border border-gray-300 bg-gray-50 px-3 text-sm text-gray-400 flex items-center justify-between">
                              <span>&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</span>
                              <EyeOff className="size-4 text-gray-400" />
                            </div>
                          </div>
                          <div className="text-center">
                            <span className="inline-block w-full px-4 py-2 rounded text-sm font-bold text-white" style={{ backgroundColor: primary }}>Sign In</span>
                          </div>
                          <p className="text-xs text-center text-gray-400 mt-2">
                            Forgot password? <span style={{ color: primary }}>Reset</span>
                          </p>
                        </div>
                        <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 text-center text-[10px] text-gray-400">This is a sample preview. Actual login page will use the organization&apos;s branded theme.</div>
                      </div>
                    );
                  })()}
                </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Health Tab */}
          {activeTab === "health" && (
            <div className="space-y-6">
              {/* Health Cards Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Brand Config</p>
                  <div className="flex items-center gap-2">
                    {editingConfig.status === "active" ? (
                      <CheckCircle2 className="size-4 text-green-600" />
                    ) : (
                      <XCircle className="size-4 text-red-600" />
                    )}
                    <span className="text-sm font-bold">{editingConfig.status === "active" ? "Active" : "Inactive"}</span>
                  </div>
                </Card>
                <Card className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Domain Status</p>
                  <div className="flex items-center gap-2">
                    {editingConfig.custom_domain ? (
                      <CheckCircle2 className="size-4 text-green-600" />
                    ) : (
                      <XCircle className="size-4 text-amber-600" />
                    )}
                    <span className="text-sm font-bold">{editingConfig.custom_domain ? "Configured" : "Not set"}</span>
                  </div>
                </Card>
                <Card className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Custom Domain</p>
                  <div className="flex items-center gap-2">
                    {selectedDomains.some((d) => (d.status as string) === "verified") ? (
                      <CheckCircle2 className="size-4 text-green-600" />
                    ) : (
                      <XCircle className="size-4 text-amber-600" />
                    )}
                    <span className="text-sm font-bold">{selectedDomains.filter((d) => (d.status as string) === "verified").length} verified</span>
                  </div>
                </Card>
                <Card className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Logo Set</p>
                  <div className="flex items-center gap-2">
                    {editingConfig.logo_url ? (
                      <CheckCircle2 className="size-4 text-green-600" />
                    ) : (
                      <XCircle className="size-4 text-red-600" />
                    )}
                    <span className="text-sm font-bold">{editingConfig.logo_url ? "Yes" : "No"}</span>
                  </div>
                </Card>
              </div>

              {/* Tenant Isolation Checks */}
              <Card>
                <CardHeader>
                  <h3 className="text-sm font-bold">Tenant Isolation Checks</h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {healthChecks.map((check) => {
                      const colors = (editingConfig.brand_colors as Record<string, string>) ?? {};
                      let passed = false;
                      if (check.key === "hasConfig") passed = true;
                      if (check.key === "hasDomain") passed = !!editingConfig.custom_domain;
                      if (check.key === "hasSSL") passed = selectedDomains.some((d) => (d.ssl_status as string) === "issued");
                      if (check.key === "hasColors") passed = !!(colors.primary || colors.secondary || colors.accent);
                      if (check.key === "hasLogo") passed = !!editingConfig.logo_url;
                      if (check.key === "hasTenantKey") passed = !!editingConfig.tenant_key;
                      return (
                        <div key={check.key} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                          {passed ? (
                            <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                          ) : (
                            <XCircle className="size-4 text-red-600 shrink-0" />
                          )}
                          <span className="text-sm">{check.label}</span>
                          {passed ? (
                            <Badge variant="success" className="ml-auto text-[10px]">Pass</Badge>
                          ) : (
                            <Badge variant="error" className="ml-auto text-[10px]">Fail</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Domains Section */}
              <Card>
                <CardHeader>
                  <h3 className="text-sm font-bold">Domains ({selectedDomains.length})</h3>
                </CardHeader>
                <CardContent>
                  {selectedDomains.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">No domains configured for this tenant.</p>
                  )}
                  {selectedDomains.length > 0 && (
                    <div className="space-y-2">
                      {selectedDomains.map((d) => {
                        const did = d.id as string;
                        return (
                          <div key={did} className="flex items-center justify-between p-3 rounded-md border border-border">
                            <div className="flex items-center gap-2">
                              <Globe2 className="size-4 text-muted-foreground shrink-0" />
                              <span className="text-sm font-mono font-bold">{d.domain as string}</span>
                              {(d.is_primary as boolean) && <Badge variant="premium" className="text-[10px]">Primary</Badge>}
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={d.status as string} />
                              <Badge variant={(d.ssl_status as string) === "issued" ? "success" : "neutral"} className="text-[10px]">
                                SSL: {d.ssl_status as string ?? "N/A"}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

               {/* Audit History */}
               <Card>
                 <CardHeader><h3 className="text-sm font-bold">Audit History</h3></CardHeader>
                 <CardContent>
                   <AuditTimeline configId={selectedConfig?.id as string ?? ""} />
                 </CardContent>
              </Card>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function TestEmailButton({ config, editingConfig }: { config: Record<string, unknown>; editingConfig: Record<string, unknown> }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      const to = user?.email ?? "";

      const res = await fetch("/api/enterprise/branding/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          brandName: editingConfig.brand_name as string ?? config.brand_name as string,
          primaryColor: (editingConfig.brand_colors as Record<string, string>)?.primary ?? "#6366f1",
          accentColor: (editingConfig.brand_colors as Record<string, string>)?.accent ?? "#d7ff3f",
          logoUrl: editingConfig.logo_url as string ?? config.logo_url as string,
          fromName: editingConfig.email_from_name as string ?? "Brand",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      await res.json();
      setSent(true);
      showToast("Test email sent", "success");
      setTimeout(() => setSent(false), 3000);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to send test email", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <Button size="sm" variant="secondary" onClick={handleSend} disabled={sending}>
      {sending ? <Mail className="h-4 w-4 animate-pulse" /> : <Mail className="h-4 w-4" />}
      {sending ? "Sending..." : sent ? "Sent!" : "Send Test"}
    </Button>
  );
}

export { WhiteLabelDashboard };
