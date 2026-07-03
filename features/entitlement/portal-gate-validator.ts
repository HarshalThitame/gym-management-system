import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { FEATURE_KEY_SET } from "./feature-registry";
import { PORTAL_NAV_REGISTRY, PORTAL_ROUTE_REGISTRY, getPortalRouteGate } from "./portal-gates";

type PortalName = keyof typeof PORTAL_ROUTE_REGISTRY;

export type PortalGateValidationError = {
  type: "missing_visibility_mode" | "missing_route_mapping" | "invalid_feature_key";
  detail: string;
};

export type PortalGateValidationResult = {
  valid: boolean;
  errors: PortalGateValidationError[];
};

const PORTAL_APP_ROOTS: Record<PortalName, string> = {
  "gym-admin": "app/(admin)/admin",
  reception: "app/(reception)/reception",
  trainer: "app/(trainer)/trainer",
  member: "app/(member)/member",
};

export function validatePortalGateRegistry() {
  const errors: PortalGateValidationError[] = [];

  for (const [portal, items] of Object.entries(PORTAL_NAV_REGISTRY) as Array<[PortalName, (typeof PORTAL_NAV_REGISTRY)[PortalName]]>) {
    for (const item of items) {
      if (!item.visibilityMode) {
        errors.push({ type: "missing_visibility_mode", detail: `${portal} nav item ${item.href} is missing a visibility mode.` });
      }
      if (item.featureKey && !FEATURE_KEY_SET.has(item.featureKey)) {
        errors.push({ type: "invalid_feature_key", detail: `${portal} nav item ${item.href} references unknown feature key ${item.featureKey}.` });
      }
    }
  }

  for (const [portal, root] of Object.entries(PORTAL_APP_ROOTS) as Array<[PortalName, string]>) {
    for (const routePath of listPortalPageRoutes(join(process.cwd(), root), portal)) {
      if (!getPortalRouteGate(portal, routePath)) {
        errors.push({ type: "missing_route_mapping", detail: `${portal} route ${routePath} has no portal gate mapping.` });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function listPortalPageRoutes(root: string, portal: PortalName): string[] {
  const routes: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "layout.tsx" || entry.name === "error.tsx" || entry.name === "loading.tsx" || entry.name === "not-found.tsx" || entry.name === "dynamic-components.tsx" || entry.name === "client.tsx" || entry.name === "survey-form.tsx" || entry.name === "command-palette-wrapper.tsx") {
      continue;
    }

    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      routes.push(...listPortalPageRoutes(fullPath, portal));
      continue;
    }

    if (entry.name !== "page.tsx") continue;

    const relativeDir = relative(join(process.cwd(), PORTAL_APP_ROOTS[portal]), root);
    const normalizedDir = relativeDir === "" ? "" : `/${relativeDir.replaceAll("\\", "/")}`;
    const route = `${portalBasePath(portal)}${normalizedDir}`;
    routes.push(route);
  }

  return routes;
}

function portalBasePath(portal: PortalName) {
  if (portal === "gym-admin") return "/admin";
  if (portal === "reception") return "/reception";
  if (portal === "trainer") return "/trainer";
  return "/member";
}

export function scanPortalFilesForLegacyFeatureChecks() {
  const hits: string[] = [];
  const patterns = [/getOrgFeatureFlags\s*\(/, /feature-resolver/, /planContext\??\.features\./];

  for (const root of Object.values(PORTAL_APP_ROOTS)) {
    for (const file of walkFiles(join(process.cwd(), root))) {
      const source = readFileSync(file, "utf8");
      if (patterns.some((pattern) => pattern.test(source))) {
        hits.push(relative(process.cwd(), file));
      }
    }
  }

  return hits;
}

function walkFiles(root: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }

  return files;
}
