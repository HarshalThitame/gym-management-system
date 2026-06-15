"use client";

import { useEffect, useState } from "react";
import { Building2, Palette, Globe2, Mail, Search } from "lucide-react";

type BrandConfig = {
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  organization_name: string;
  support_email: string | null;
  business_address: string | null;
};

export function BrandingPreview({ config }: { config: BrandConfig }) {
  const styles = {
    fontFamily: config.font_family || "Inter",
    primary: config.primary_color || "#2563eb",
    secondary: config.secondary_color || "#7c3aed",
    accent: config.accent_color || "#06b6d4",
  };

  return (
    <div className="space-y-6">
      {/* Login Preview */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-surface p-6 text-center" style={{ fontFamily: styles.fontFamily }}>
          {config.logo_url ? (
            <img src={config.logo_url} alt="Logo" className="mx-auto h-12 object-contain" />
          ) : (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg" style={{ backgroundColor: styles.primary }}>
              <Building2 className="size-6 text-white" />
            </div>
          )}
          <h2 className="mt-4 text-xl font-black" style={{ color: styles.primary }}>{config.organization_name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
          <div className="mt-6 space-y-3 text-left">
            <div className="h-11 w-full rounded-lg border border-border bg-background px-3" />
            <div className="h-11 w-full rounded-lg border border-border bg-background px-3" />
            <button className="h-11 w-full rounded-lg font-bold text-white" style={{ backgroundColor: styles.primary }}>
              Sign In
            </button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Powered by {config.organization_name}</p>
        </div>
      </div>

      {/* Color Swatch */}
      <div className="flex gap-3">
        {[
          { label: "Primary", color: styles.primary },
          { label: "Secondary", color: styles.secondary },
          { label: "Accent", color: styles.accent },
        ].map((c) => (
          <div key={c.label} className="flex-1 rounded-lg border border-border p-3 text-center">
            <div className="mx-auto h-8 w-8 rounded-full" style={{ backgroundColor: c.color }} />
            <p className="mt-2 text-xs font-bold">{c.label}</p>
            <p className="text-[10px] text-muted-foreground">{c.color}</p>
          </div>
        ))}
      </div>

      {/* Email Preview */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="border-b border-border bg-surface-muted px-4 py-2">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Email Preview</span>
          </div>
        </div>
        <div className="bg-white p-6" style={{ fontFamily: styles.fontFamily }}>
          <div className="flex items-center gap-3">
            {config.logo_url ? (
              <img src={config.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded" style={{ backgroundColor: styles.primary }}>
                <span className="text-xs font-bold text-white">{config.organization_name[0]}</span>
              </div>
            )}
            <span className="font-bold text-gray-800">{config.organization_name}</span>
          </div>
          <div className="mt-4 rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
            <p>Hello,</p>
            <p className="mt-2">This is a branded email from {config.organization_name}.</p>
            <div className="mt-4 rounded-md px-4 py-3 text-center text-white text-sm font-bold" style={{ backgroundColor: styles.primary }}>
              View Details
            </div>
          </div>
          <div className="mt-4 border-t border-gray-100 pt-4 text-center text-xs text-gray-400">
            <p>{config.organization_name} — {config.support_email || "support@example.com"}</p>
            <p className="mt-1">{config.business_address || ""}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
