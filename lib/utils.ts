import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function absoluteUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? "https://apexperformance.club";
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

