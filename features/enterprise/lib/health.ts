import type { SystemHealthCheckRow } from "@/types/enterprise";

export function latestHealthByComponent(checks: SystemHealthCheckRow[]): SystemHealthCheckRow[] {
  const byComponent = new Map<string, SystemHealthCheckRow>();

  for (const check of checks) {
    if (!byComponent.has(check.component)) {
      byComponent.set(check.component, check);
    }
  }

  return Array.from(byComponent.values());
}
