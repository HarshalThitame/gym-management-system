"use client";

import { useState } from "react";
import { Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FeatureFlagRow, OrgFeatureFlagRow } from "../services/feature-flags-service";
import { toggleOrgFeatureFlagAction, createFeatureFlagAction } from "../actions/feature-flags-actions";

type Props = {
  flags: FeatureFlagRow[];
  orgFlagMap: Record<string, OrgFeatureFlagRow>;
};

export function FeatureFlagManager({ flags, orgFlagMap }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");

  const categories = [...new Set(flags.map((f) => f.category))];

  const handleToggle = async (flagId: string, currentEnabled: boolean) => {
    await toggleOrgFeatureFlagAction(flagId, !currentEnabled);
  };

  const handleCreateFlag = async () => {
    if (!key || !name) return;
    const formData = new FormData();
    formData.set("key", key);
    formData.set("name", name);
    await createFeatureFlagAction(formData);
    setKey("");
    setName("");
    setShowForm(false);
  };

  const isEnabled = (flag: FeatureFlagRow) => {
    const orgFlag = orgFlagMap[flag.id];
    return orgFlag ? orgFlag.enabled : flag.default_enabled;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{flags.length} feature flag{flags.length !== 1 ? "s" : ""}</p>
        <Button size="sm" variant="accent" onClick={() => setShowForm(!showForm)}>
          <Plus className="size-4 mr-1" /> New Flag
        </Button>
      </div>

      {showForm && (
        <div className="flex gap-2 p-3 rounded-lg border border-border">
          <input
            placeholder="Flag key (e.g., new-onboarding-flow)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="flex-1 text-xs px-2 py-1.5 rounded border border-border bg-background"
          />
          <input
            placeholder="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 text-xs px-2 py-1.5 rounded border border-border bg-background"
          />
          <Button size="sm" variant="accent" onClick={handleCreateFlag}>Create</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
        </div>
      )}

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No feature flags defined. Create your first flag to start controlling features.</p>
      ) : (
        categories.map((category) => {
          const categoryFlags = flags.filter((f) => f.category === category);
          return (
            <div key={category}>
              <h3 className="text-sm font-medium capitalize mb-2">{category}</h3>
              <div className="space-y-1">
                {categoryFlags.map((flag) => (
                  <div key={flag.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <p className="text-sm font-medium">{flag.name}</p>
                      <code className="text-xs text-muted-foreground">{flag.key}</code>
                      {flag.description && <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>}
                    </div>
                    <button onClick={() => handleToggle(flag.id, isEnabled(flag))} className="text-accent hover:text-accent/80">
                      {isEnabled(flag) ? <ToggleRight className="size-6" /> : <ToggleLeft className="size-6 text-muted-foreground" />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
