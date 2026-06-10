import type { MetadataRoute } from "next";
import { siteConfig } from "@/data/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: siteConfig.shortName,
    description: siteConfig.description,
    start_url: "/member?source=pwa",
    scope: "/",
    id: "/?app=apex-performance-club",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#070809",
    theme_color: "#111214",
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
        label: "Apex mobile member dashboard"
      },
      {
        src: "/screenshots/desktop-dashboard.svg",
        sizes: "1440x1024",
        type: "image/svg+xml",
        form_factor: "wide",
        label: "Apex operations dashboard"
      }
    ],
    shortcuts: [
      {
        name: "Check In",
        short_name: "Check In",
        description: "Open attendance and QR check-in.",
        url: "/member/attendance?source=pwa-shortcut",
        icons: [{ src: "/icons/shortcut-check-in.svg", sizes: "192x192", type: "image/svg+xml" }]
      },
      {
        name: "Book a Class",
        short_name: "Classes",
        description: "Browse and book upcoming classes.",
        url: "/member/classes?source=pwa-shortcut",
        icons: [{ src: "/icons/shortcut-classes.svg", sizes: "192x192", type: "image/svg+xml" }]
      },
      {
        name: "Log Workout",
        short_name: "Workout",
        description: "Open workout tracking.",
        url: "/member/workouts?source=pwa-shortcut",
        icons: [{ src: "/icons/shortcut-workout.svg", sizes: "192x192", type: "image/svg+xml" }]
      }
    ],
    prefer_related_applications: false
  };
}
