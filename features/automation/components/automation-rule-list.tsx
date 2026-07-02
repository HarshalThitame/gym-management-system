"use client";

import { useState } from "react";
import { Trash2, Plus, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutomationRuleRow } from "../services/automation-service";
import { deleteAutomationRuleAction } from "../actions/automation-actions";

type Props = {
  rules: AutomationRuleRow[];
};

export function AutomationRuleList({ rules }: Props) {
  const [items, setItems] = useState(rules);

  const handleDelete = async (id: string) => {
    await deleteAutomationRuleAction(id);
    setItems((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{items.length} rule{items.length !== 1 ? "s" : ""}</p>
        <Button size="sm" variant="accent">
          <Plus className="size-4 mr-1" /> New Rule
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No automation rules configured. Create a rule to automate responses to events.</p>
      ) : (
        <div className="space-y-2">
          {items.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{rule.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    rule.status === "active" ? "bg-green-500/10 text-green-600" :
                    rule.status === "inactive" ? "bg-gray-500/10 text-gray-500" :
                    "bg-yellow-500/10 text-yellow-600"
                  }`}>{rule.status}</span>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  <span>Event: {rule.event_type}</span>
                  <span>Priority: {rule.priority}</span>
                  <span>Runs: {rule.run_count}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm">
                  <History className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)}>
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
