import type { MetadataRoute } from "next";
import { getTenantSiteConfig } from "@/lib/tenant/site";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const tenantSite = await getTenantSiteConfig();
  const themeColor = tenantSite.tenant.brand.primaryColor ?? "#111214";

  return {
    name: tenantSite.name,
    short_name: tenantSite.shortName,
    description: tenantSite.description,
    start_url: "/member?source=pwa",
    scope: "/",
    id: `/?app=${tenantSite.tenant.tenantKey ?? "apex-performance-club"}`,
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#070809",
    theme_color: themeColor,
    categories: ["fitness", "health", "lifestyle", "business", "productivity"],
    lang: "en",
    dir: "ltr",
    icons: [
      {
        src: "/icons/apex-icon.svg",
        sizes: "192x192 512x512",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icons/apex-maskable.svg",
        sizes: "192x192 512x512",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ],
    screenshots: [
      {
        src: "/screenshots/mobile-dashboard.svg",
        sizes: "390x844",
        type: "image/svg+xml",
        form_factor: "narrow",
        label: `${tenantSite.shortName} mobile member dashboard`
      },
      {
        src: "/screenshots/desktop-dashboard.svg",
        sizes: "1440x1024",
        type: "image/svg+xml",
        form_factor: "wide",
        label: `${tenantSite.shortName} operations dashboard`
      }
    ],
    prefer_related_applications: false
  };
}
