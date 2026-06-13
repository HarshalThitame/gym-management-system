import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LazyPwaProvider } from "@/components/pwa/lazy-pwa-provider";
import { getTenantContext } from "@/lib/tenant/context";
import { buildTenantThemeStyle, getTenantSiteConfig } from "@/lib/tenant/site";
import { absoluteUrl } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap"
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap"
});

export async function generateMetadata(): Promise<Metadata> {
  const tenantSite = await getTenantSiteConfig();

  return {
    metadataBase: new URL(absoluteUrl("/")),
    title: {
      default: tenantSite.name,
      template: `%s | ${tenantSite.shortName}`
    },
    description: tenantSite.description,
    applicationName: tenantSite.name,
    authors: [{ name: tenantSite.name }],
    creator: tenantSite.name,
    publisher: tenantSite.name,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: tenantSite.tenant.brand.faviconUrl ?? "/icons/apex-icon.svg", type: tenantSite.tenant.brand.faviconUrl ? undefined : "image/svg+xml" }],
      apple: [{ url: "/icons/apple-touch-icon.svg", type: "image/svg+xml" }]
    },
    appleWebApp: {
      capable: true,
      title: tenantSite.shortName,
      statusBarStyle: "black-translucent"
    },
    formatDetection: {
      telephone: false
    },
    robots: {
      index: true,
      follow: true
    }
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#070809" }
  ]
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const tenant = await getTenantContext();
  const tenantThemeStyle = buildTenantThemeStyle(tenant);

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`} style={tenantThemeStyle}>
        <a className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-accent focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-accent-foreground focus:shadow-lg focus:outline-none" href="#main-content" id="skip-link">
          Skip to content
        </a>
        {children}
        <LazyPwaProvider />
      </body>
    </html>
  );
}
