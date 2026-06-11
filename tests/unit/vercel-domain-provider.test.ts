import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getVercelDomainProviderConfig,
  getVercelProviderReadinessMessage
} from "@/features/enterprise/services/vercel-domain-provider";

describe("vercel domain provider configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports missing runtime configuration clearly", () => {
    vi.stubEnv("VERCEL_API_TOKEN", "");
    vi.stubEnv("VERCEL_TOKEN", "");
    vi.stubEnv("VERCEL_PROJECT_ID_OR_NAME", "");
    vi.stubEnv("VERCEL_PROJECT_ID", "");
    vi.stubEnv("VERCEL_PROJECT_NAME", "");

    const config = getVercelDomainProviderConfig();

    expect(config.configured).toBe(false);
    expect(config.missing).toEqual(["VERCEL_API_TOKEN", "VERCEL_PROJECT_ID_OR_NAME"]);
    expect(getVercelProviderReadinessMessage(config)).toContain("VERCEL_API_TOKEN");
  });

  it("uses Vercel token and project id aliases", () => {
    vi.stubEnv("VERCEL_TOKEN", "token");
    vi.stubEnv("VERCEL_PROJECT_ID", "project_123");
    vi.stubEnv("VERCEL_TEAM_ID", "team_123");

    const config = getVercelDomainProviderConfig();

    expect(config).toEqual({
      configured: true,
      missing: [],
      projectIdOrName: "project_123",
      teamId: "team_123"
    });
  });
});
