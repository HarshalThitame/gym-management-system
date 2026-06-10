import type { Metadata } from "next";
import { siteConfig } from "@/data/site";
import { absoluteUrl } from "@/lib/utils";

type MetadataInput = {
  title: string;
  description: string;
  path: string;
  image?: string;
};

export function createMetadata({ title, description, path, image }: MetadataInput): Metadata {
  const fullTitle = title === siteConfig.name ? title : `${title} | ${siteConfig.shortName}`;
  const url = absoluteUrl(path);
  const defaultImage = "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&h=630&q=82";

  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: url
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: siteConfig.name,
      type: "website",
      images: [
        {
          url: image ?? defaultImage,
          width: 1200,
          height: 630,
          alt: fullTitle
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image ?? defaultImage]
    }
  };
}
