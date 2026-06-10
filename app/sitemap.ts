import type { MetadataRoute } from "next";
import { blogPosts } from "@/data/site";
import { absoluteUrl } from "@/lib/utils";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "",
    "/about",
    "/programs",
    "/membership-plans",
    "/trainers",
    "/gallery",
    "/testimonials",
    "/faq",
    "/blog",
    "/contact",
    "/free-trial"
  ];

  return [
    ...staticRoutes.map((route) => ({
      url: absoluteUrl(route || "/"),
      lastModified: new Date("2026-06-10"),
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.8
    })),
    ...blogPosts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: new Date(post.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7
    }))
  ];
}
