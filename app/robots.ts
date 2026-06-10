import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/member/", "/trainer/", "/api/"]
    },
    sitemap: absoluteUrl("/sitemap.xml")
  };
}
