import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireApiAuth } from "@/lib/auth/api-guards";

export async function GET(request: Request) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const configId = searchParams.get("configId");

  if (!configId) return NextResponse.json({ error: "configId required" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: config } = await supabase.from("tenant_configs").select("*").eq("id", configId).single();
  if (!config) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cfg = config as unknown as {
    brand_name: string; plan_tier: string; status: string;
    primary_color: string; secondary_color: string; accent_color: string;
    logo_url: string | null; favicon_url: string | null;
    custom_domain: string | null; subdomain: string | null;
    typography: Record<string, unknown>; email_branding: Record<string, unknown>;
    limits: Record<string, unknown>; compliance_settings: Record<string, unknown>;
    created_at: string; updated_at: string;
  };

  const exportData = {
    exportVersion: "1.0",
    exportedAt: new Date().toISOString(),
    brand: {
      name: cfg.brand_name,
      plan: cfg.plan_tier,
      status: cfg.status,
      colors: {
        primary: cfg.primary_color,
        secondary: cfg.secondary_color,
        accent: cfg.accent_color,
      },
      typography: cfg.typography,
      logos: {
        logoUrl: cfg.logo_url,
        faviconUrl: cfg.favicon_url,
      },
      domains: {
        custom: cfg.custom_domain,
        subdomain: cfg.subdomain,
      },
      email: cfg.email_branding,
      limits: cfg.limits,
      compliance: cfg.compliance_settings,
      timestamps: {
        created: cfg.created_at,
        updated: cfg.updated_at,
      },
    },
  };

  return NextResponse.json(exportData);
}
