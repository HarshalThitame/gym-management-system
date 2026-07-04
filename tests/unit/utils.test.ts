import { afterEach, describe, expect, it, vi } from "vitest";

import { absoluteUrl } from "@/lib/utils";

describe("absoluteUrl", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalAppUrl = process.env.APP_URL;
  const originalVercelUrl = process.env.VERCEL_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    process.env.APP_URL = originalAppUrl;
    process.env.VERCEL_URL = originalVercelUrl;
    vi.unstubAllEnvs();
  });

  it("falls back to the next valid base URL when a configured URL is malformed", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "localhost:3010");
    vi.stubEnv("APP_URL", "http://localhost:3010");

    expect(absoluteUrl("/organization")).toBe("http://localhost:3010/organization");
  });
});
