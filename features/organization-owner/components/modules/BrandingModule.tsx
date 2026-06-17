"use client";

/* eslint-disable @typescript-eslint/no-require-imports */

import { useCallback, useMemo, useState, useActionState } from "react";
import { Copy, Download, Edit3, Eye, Globe2, Image, Palette, Plus, ShieldCheck } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { saveBrandingAction } from "@/features/organization-owner/actions/branding-actions";
import { Button } from "@/components/ui/button";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";


type BrandingEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard; moduleData?: { items: Record<string, unknown>[] }; };

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

/* ─── Color utilities ─── */
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const toLin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}
function contrastRatio(hex1: string, hex2: string) {
  const l1 = luminance(hex1) + 0.05, l2 = luminance(hex2) + 0.05;
  return Math.max(l1, l2) / Math.min(l1, l2);
}
function meetsAA(hex: string) { return contrastRatio("#ffffff", hex) >= 4.5; }
function meetsAAA(hex: string) { return contrastRatio("#ffffff", hex) >= 7; }

export function BrandingEnterpriseModule({ dashboard, moduleData }: BrandingEnterpriseModuleProps) {
  const { filters, navigate, currentPage } = useModuleFilters();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [previewConfig, setPreviewConfig] = useState<typeof dashboard.tenantConfigs[0] | null>(null);
  const [editingConfig, setEditingConfig] = useState<typeof dashboard.tenantConfigs[0] | null>(null);
  const [state, formAction] = useActionState(saveBrandingAction, initialAuthActionState);

  const configs = (moduleData?.items ?? dashboard.tenantConfigs) as typeof dashboard.tenantConfigs;
  const domains = dashboard.tenantDomains;
  const flags = dashboard.featureFlags;

  // Live preview colors
  const liveColors = useMemo(() => {
    if (!previewConfig) return null;
    return {
      primary: previewConfig.primary_color ?? "#111315",
      secondary: previewConfig.secondary_color ?? "#6b7280",
      accent: previewConfig.accent_color ?? "#0891b2",
    };
  }, [previewConfig]);

  const openCreate = useCallback(() => { setEditingConfig(null); setDrawerOpen(true); }, []);
  const openEdit = useCallback((c: typeof dashboard.tenantConfigs[0]) => { setEditingConfig(c); setDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditingConfig(null); }, []);

  const items = configs.map((c) => {
    const ratio = c.primary_color ? Math.round(contrastRatio("#ffffff", c.primary_color) * 10) / 10 : null;
    const aaPass = c.primary_color ? meetsAA(c.primary_color) : null;

    return {
      id: c.id,
      title: c.brand_name,
      subtitle: c.tenant_key,
      meta: `${c.custom_domain ?? c.subdomain ?? "No domain"} · Status: ${c.status}`,
      badge: c.status,
      badgeVariant: (c.status === "active" ? "success" : "neutral") as "success" | "neutral",
      status: c.status,
      sections: [
        { label: "Primary", value: c.primary_color ? `${c.primary_color} · ${ratio ? `${ratio}:1` : ""}` : "—" },
        { label: "Secondary", value: c.secondary_color ?? "—" },
        { label: "Accent", value: c.accent_color ?? "—" },
        { label: "Domain", value: c.custom_domain ?? c.subdomain ?? "—" },
      ],
      actions: [
        { label: "Preview", onClick: () => setPreviewConfig(c), variant: "secondary" as const, icon: <Eye className="size-3.5" /> },
        { label: "Edit", onClick: () => openEdit(c), variant: "secondary" as const, icon: <Edit3 className="size-3.5" /> },
      ]
    };
  });

  return (
    <div className="space-y-6">
      {/* ═══ KPI GRID ═══ */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="White-label brand profiles" icon={<Palette className="size-5" />} label="Brands" value={String(configs.length)} />
        <StatCard detail="Published active brands" icon={<ShieldCheck className="size-5" />} label="Active" value={String(configs.filter((c) => c.status === "active").length)} />
        <StatCard detail="Custom domains configured" icon={<Globe2 className="size-5" />} label="Domains" value={String(domains.filter((d) => d.domain_type === "custom_domain").length)} />
        <StatCard detail="Feature flag overrides" icon={<Palette className="size-5" />} label="Flags" value={String(flags.length)} />
      </section>

      {/* ═══ DATA LIST ═══ */}
      <DataList
        selectable
        bulkActions={[
          { label: "Export CSV", onClick: (ids) => {
            const data = configs.filter((c) => ids.includes(c.id)).map((c) => ({
              brand: c.brand_name, key: c.tenant_key, status: c.status,
              primary: c.primary_color, secondary: c.secondary_color, accent: c.accent_color,
              domain: c.custom_domain ?? c.subdomain, logo: c.logo_url,
            }));
            const { exportToCSV } = require("@/features/organization-owner/lib/toast-utils");
            exportToCSV(data, "brands-selected");
          }, variant: "secondary" as const, icon: <Download className="size-3.5" /> }
        ]}
        headerAction={
          <Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Add Brand</Button>
        }
        headerTitle="Brand Profiles"
        items={items}
        totalItems={configs.length}
        totalPages={Math.ceil(configs.length / 12)}
        currentPage={currentPage}
        onPageChange={(p) => navigate({ page: p })}
        pageSize={filters.pageSize ?? 12}
      />

      {/* ═══ CREATE/EDIT DRAWER ═══ */}
      <OrgOwnerDrawer
        description={editingConfig ? `Editing ${editingConfig.brand_name}` : "Create a new brand profile"}
        onClose={closeDrawer}
        open={drawerOpen}
        title={editingConfig ? "Edit Brand" : "Add Brand"}
        size="xl"
      >
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          {editingConfig ? <input name="configId" type="hidden" value={editingConfig.id} /> : null}

          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Brand Name" required>
              <input className={selectClass} defaultValue={editingConfig?.brand_name ?? ""} name="brandName" required type="text" placeholder="Apex Fitness" />
            </DrawerField>
            <DrawerField label="Tenant Key" required>
              <input className={selectClass} defaultValue={editingConfig?.tenant_key ?? `org-${dashboard.organization.id.slice(0, 8)}`} name="tenantKey" type="text" placeholder="org-abc12345" />
            </DrawerField>
          </div>

          {/* Color pickers with live swatches */}
          <div className="rounded-lg border border-border bg-surface-muted p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Brand Colors</p>
            <div className="grid gap-5 md:grid-cols-3">
              {(["primaryColor", "secondaryColor", "accentColor"] as const).map((field) => {
                const label = field === "primaryColor" ? "Primary" : field === "secondaryColor" ? "Secondary" : "Accent";
                const defaultValue = editingConfig?.[field === "primaryColor" ? "primary_color" : field === "secondaryColor" ? "secondary_color" : "accent_color"] ?? "";
                return (
                  <div key={field} className="space-y-2">
                    <label className="text-sm font-bold">{label}</label>
                    <div className="flex gap-2">
                      <input
                        className="h-11 w-14 shrink-0 cursor-pointer rounded-md border border-border bg-surface p-1"
                        defaultValue={defaultValue}
                        name={field}
                        type="color"
                      />
                      <input
                        className={selectClass}
                        defaultValue={defaultValue}
                        placeholder={`#${field === "primaryColor" ? "111315" : field === "secondaryColor" ? "6b7280" : "0891b2"}`}
                        type="text"
                      />
                    </div>
                    {defaultValue ? (
                      <div className="flex gap-2 text-[10px]">
                        <span className={`rounded-full px-2 py-0.5 font-bold ${meetsAA(defaultValue) ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          AA {meetsAA(defaultValue) ? "✓" : "✗"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 font-bold ${meetsAAA(defaultValue) ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          AAA {meetsAAA(defaultValue) ? "✓" : "✗"}
                        </span>
                        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-muted-foreground">
                          {contrastRatio("#ffffff", defaultValue).toFixed(1)}:1
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Logo URLs */}
          <div className="rounded-lg border border-border bg-surface-muted p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Brand Assets</p>
            <div className="grid gap-5 md:grid-cols-2">
              <DrawerField label="Logo URL">
                <div className="flex gap-2">
                  <input className={selectClass} defaultValue={editingConfig?.logo_url ?? ""} name="logoUrl" placeholder="https://example.com/logo.png" type="url" />
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-background text-muted-foreground">
                    <Image className="size-4" />
                  </div>
                </div>
              </DrawerField>
              <DrawerField label="Favicon URL">
                <input className={selectClass} defaultValue={editingConfig?.favicon_url ?? ""} name="faviconUrl" placeholder="https://example.com/favicon.ico" type="url" />
              </DrawerField>
            </div>
          </div>

          {/* Domain + Status */}
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Custom Domain">
              <input className={selectClass} defaultValue={editingConfig?.custom_domain ?? ""} name="customDomain" placeholder="gym.example.com" type="text" />
            </DrawerField>
            <DrawerField label="Status">
              <select className={selectClass} defaultValue={editingConfig?.status ?? "active"} name="status">
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="suspended">Suspended</option>
              </select>
            </DrawerField>
          </div>

          {/* Quick preview */}
          {(() => {
            const p = editingConfig?.primary_color ?? "#111315";
            const s = editingConfig?.secondary_color ?? "#6b7280";
            const a = editingConfig?.accent_color ?? "#0891b2";
            return (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="p-4" style={{ backgroundColor: p, color: "#ffffff" }}>
                  <p className="text-sm font-bold" style={{ color: "#ffffff" }}>Header Preview</p>
                  <div className="mt-2 flex gap-2">
                    <span className="rounded-md px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: "#ffffff", color: p }}>Button</span>
                    <span className="rounded-md px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: a, color: "#ffffff" }}>Accent</span>
                    <span className="rounded-md border px-3 py-1.5 text-xs font-bold" style={{ borderColor: "#ffffff", color: "#ffffff" }}>Outline</span>
                  </div>
                </div>
                <div className="p-4 space-y-2 bg-white">
                  <p className="text-sm font-bold" style={{ color: p }}>Heading in Primary</p>
                  <p className="text-xs" style={{ color: s }}>Body text in secondary color</p>
                  <Badge variant="neutral" style={{ backgroundColor: a, color: "#ffffff" }}>Accent Badge</Badge>
                </div>
              </div>
            );
          })()}

          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>{editingConfig ? "Update Brand" : "Create Brand"}</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>

      {/* ═══ LIVE PREVIEW OVERLAY ═══ */}
      {previewConfig && liveColors ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={() => setPreviewConfig(null)}>
          <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${previewConfig.brand_name} preview`}>
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-xl font-black">{previewConfig.brand_name}</h2>
                <p className="text-sm text-muted-foreground">{previewConfig.tenant_key} · <EnterpriseStatusBadge status={previewConfig.status} /></p>
              </div>
              <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={() => setPreviewConfig(null)} type="button" aria-label="Close"><Palette className="size-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Color display */}
              <Card>
                <CardHeader><h3 className="text-lg font-black">Colors</h3></CardHeader>
                <CardContent className="space-y-3">
                  {(["primary", "secondary", "accent"] as const).map((key) => {
                    const color = liveColors[key];
                    const ratio = Math.round(contrastRatio("#ffffff", color) * 10) / 10;
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <div className="size-10 shrink-0 rounded-md border border-border" style={{ backgroundColor: color }} />
                        <div className="flex-1">
                          <p className="text-sm font-bold capitalize">{key}</p>
                          <p className="text-xs text-muted-foreground">{color} · {ratio}:1 contrast ratio</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meetsAA(color) ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          AA {meetsAA(color) ? "✓" : "✗"}
                        </span>
                        <button className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted" onClick={() => { navigator.clipboard.writeText(color); }} type="button" aria-label="Copy color">
                          <Copy className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Live preview */}
              <Card>
                <CardHeader><h3 className="text-lg font-black">Preview</h3></CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="p-5" style={{ backgroundColor: liveColors.primary, color: "#ffffff" }}>
                      <p className="text-lg font-bold">Header</p>
                      <p className="mt-1 text-sm opacity-80">Primary background with white text</p>
                      <div className="mt-4 flex gap-2">
                        <span className="rounded-md px-4 py-2 text-sm font-bold" style={{ backgroundColor: "#ffffff", color: liveColors.primary }}>Primary Button</span>
                        <span className="rounded-md px-4 py-2 text-sm font-bold" style={{ backgroundColor: liveColors.accent, color: "#ffffff" }}>Accent Button</span>
                      </div>
                    </div>
                    <div className="p-5 space-y-3 bg-white">
                      <p className="text-xl font-bold" style={{ color: liveColors.primary }}>Section Heading</p>
                      <p style={{ color: liveColors.secondary }}>This is body text displayed in the secondary color. It provides readable content.</p>
                      <div className="flex gap-2">
                        <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: liveColors.accent, color: "#ffffff" }}>Badge</span>
                        <span className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: liveColors.secondary, color: liveColors.secondary }}>Outline</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Logo */}
              {previewConfig.logo_url ? (
                <Card>
                  <CardHeader><h3 className="text-lg font-black">Logo</h3></CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 rounded-md border border-border bg-background p-4">
                      <img alt="Brand logo" className="max-h-16 max-w-32 object-contain" src={previewConfig.logo_url} />
                      <div>
                        <p className="text-sm font-bold">Current Logo</p>
                        <p className="text-xs text-muted-foreground">{previewConfig.logo_url}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {/* Domain */}
              {previewConfig.custom_domain ? (
                <Card>
                  <CardHeader><h3 className="text-lg font-black">Domain</h3></CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
                      <Globe2 className="size-5 text-accent" />
                      <div>
                        <p className="text-sm font-bold">{previewConfig.custom_domain}</p>
                        <p className="text-xs text-muted-foreground">Custom domain · {previewConfig.domain_status === "verified" ? "Verified" : "Pending verification"}</p>
                      </div>
                      <Badge variant={previewConfig.domain_status === "verified" ? "success" : "warning"}>{previewConfig.domain_status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
