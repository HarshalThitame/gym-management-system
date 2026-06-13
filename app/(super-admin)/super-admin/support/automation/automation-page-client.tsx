"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { SupportAutomationBuilder } from "@/features/support/components/support-automation-builder";
import type { Rule } from "@/features/support/components/support-automation-builder";

function dbRuleToBuilderRule(dbRule: Record<string, unknown>): Rule {
  return {
    id: dbRule.id as string,
    name: (dbRule.name as string) ?? "",
    description: (dbRule.description as string) ?? "",
    triggerEvent: dbRule.trigger_event as string,
    conditions: (dbRule.conditions as { mode: "all" | "any"; rules: [] }) ?? { mode: "all", rules: [] },
    actions: (dbRule.actions as []) ?? [],
    priority: (dbRule.priority as number) ?? 10,
    isActive: dbRule.is_active as boolean,
    executionCount: (dbRule.execution_count as number) ?? 0,
    lastExecutedAt: (dbRule.last_executed_at as string) ?? null,
  };
}

function builderRuleToDbPayload(rule: Rule) {
  return {
    name: rule.name,
    description: rule.description || null,
    trigger_event: rule.triggerEvent,
    conditions: rule.conditions,
    actions: rule.actions,
    priority: rule.priority,
    is_active: rule.isActive,
  };
}

export function AutomationPageClient({ rules: dbRules }: { rules: Record<string, unknown>[] }) {
  const router = useRouter();

  const initialRules = dbRules.map(dbRuleToBuilderRule);

  const handleSave = useCallback(async (rules: Rule[]) => {
    const response = await fetch("/api/support/automation/rules/batch", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules: rules.map(builderRuleToDbPayload) }),
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error?.message ?? "Save failed");
    router.refresh();
  }, [router]);

  return <SupportAutomationBuilder rules={initialRules} onSave={handleSave} />;
}
