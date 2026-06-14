"use client";

import { useCallback, useMemo, useState } from "react";
import { useActionState } from "react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { saveBrandingAction } from "@/features/organization-owner/actions/branding-actions";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";

type ThemePreviewProps = {
  dashboard: OrganizationOwnerDashboard;
};

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const toLinear = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrastRatio(hex1: string, hex2: string) {
  const l1 = luminance(hex1) + 0.05;
  const l2 = luminance(hex2) + 0.05;
  return Math.max(l1, l2) / Math.min(l1, l2);
}

function meetsAA(foreground: string, background: string): boolean {
  return contrastRatio(foreground, background) >= 4.5;
}

function meetsAAA(foreground: string, background: string): boolean {
  return contrastRatio(foreground, background) >= 7;
}

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function ThemePreview({ dashboard }: ThemePreviewProps) {
  const config = dashboard.tenantConfigs[0];
  const [primary, setPrimary] = useState(config?.primary_color ?? "#111315");
  const [secondary, setSecondary] = useState(config?.secondary_color ?? "#6b7280");
  const [accent, setAccent] = useState(config?.accent_color ?? "#0891b2");
  const [state, formAction] = useActionState(saveBrandingAction, initialAuthActionState);

  const contrastWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (!meetsAA("#ffffff", primary)) warnings.push("White text on primary may be hard to read (below AA)");
    if (!meetsAA("#111315", primary)) warnings.push("Dark text on primary may be hard to read (below AA)");
    return warnings;
  }, [primary]);

  const primaryAa = useMemo(() => meetsAA("#ffffff", primary), [primary]);
  const primaryAaa = useMemo(() => meetsAAA("#ffffff", primary), [primary]);

  const handleSave = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.set("brandName", config?.brand_name ?? "My Brand");
    fd.set("primaryColor", primary);
    fd.set("secondaryColor", secondary);
    fd.set("accentColor", accent);
    if (config?.id) fd.set("configId", config.id);
    const form = e.currentTarget as HTMLFormElement;
    const action = form.action;
    // Trigger server action
    saveBrandingAction({ status: "idle", message: null } as never, fd);
  }, [primary, secondary, accent, config]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      {/* Controls */}
      <div className="space-y-5 rounded-lg border border-border bg-surface p-6">
        <h3 className="text-2xl font-black">Theme Customization</h3>
        <form action={formAction} className="space-y-5">
          <DrawerFormMessage status={state.status} message={state.message} />
          {config?.id ? <input name="configId" type="hidden" value={config.id} /> : null}
          <input name="brandName" type="hidden" value={config?.brand_name ?? "My Brand"} />

          <div className="space-y-2">
            <label className="text-sm font-bold">Primary Color</label>
            <div className="flex gap-3">
              <input className="h-11 w-20 rounded-md border border-border bg-surface px-2" type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} />
              <input className={selectClass} value={primary} onChange={(e) => setPrimary(e.target.value)} placeholder="#111315" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold">Secondary Color</label>
            <div className="flex gap-3">
              <input className="h-11 w-20 rounded-md border border-border bg-surface px-2" type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
              <input className={selectClass} value={secondary} onChange={(e) => setSecondary(e.target.value)} placeholder="#6b7280" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold">Accent Color</label>
            <div className="flex gap-3">
              <input className="h-11 w-20 rounded-md border border-border bg-surface px-2" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
              <input className={selectClass} value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="#0891b2" />
            </div>
          </div>

          {/* Contrast badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${primaryAa ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              White/primary AA {primaryAa ? "✓" : "✗"}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${primaryAaa ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              White/primary AAA {primaryAaa ? "✓" : "✗"}
            </span>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">
              Ratio: {contrastRatio("#ffffff", primary).toFixed(1)}:1
            </span>
          </div>

          {contrastWarnings.map((w, i) => (
            <p key={i} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800" role="alert">{w}</p>
          ))}

          <button className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5" type="submit">
            Save Theme
          </button>
        </form>
      </div>

      {/* Live Preview */}
      <div className="space-y-5 rounded-lg border border-border bg-surface p-6">
        <h3 className="text-2xl font-black">Live Preview</h3>

        {/* Sidebar preview */}
        <div className="rounded-lg border border-border overflow-hidden" style={{ borderColor: secondary }}>
          <div className="p-4" style={{ backgroundColor: primary, color: "#ffffff" }}>
            <p className="text-sm font-bold">Primary Background</p>
            <p className="text-xs opacity-80">This is how your primary color looks</p>
            <div className="mt-3 flex gap-2">
              <span className="rounded-md px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: "#ffffff", color: primary }}>Button</span>
              <span className="rounded-md px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: accent, color: "#ffffff" }}>Accent</span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm font-bold" style={{ color: primary }}>Headings in Primary</p>
            <p className="text-xs" style={{ color: secondary }}>Body text in secondary color</p>
            <div className="rounded-md border p-3 text-sm" style={{ borderColor: accent }}>
              <span style={{ color: accent }}>Accent highlighted element</span> with regular text
            </div>
          </div>
        </div>

        {/* Preview on white */}
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="text-sm font-bold" style={{ color: primary }}>Header</p>
          <button className="mt-2 rounded-md px-4 py-2 text-xs font-bold text-white" style={{ backgroundColor: primary }}>
            Primary Button
          </button>
          <button className="ml-2 rounded-md border px-4 py-2 text-xs font-bold" style={{ borderColor: primary, color: primary }}>
            Outline Button
          </button>
          <div className="mt-3 flex gap-2">
            <span className="rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ backgroundColor: accent }}>Badge</span>
            <span className="rounded-full border px-2.5 py-1 text-xs font-bold" style={{ borderColor: secondary, color: secondary }}>Outline Badge</span>
          </div>
        </div>
      </div>
    </div>
  );
}
