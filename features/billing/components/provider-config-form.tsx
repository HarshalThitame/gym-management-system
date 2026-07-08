"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import type { PaymentProviderName } from "@/features/billing/providers/provider-types";

type ConfigFieldDef = {
  key: string;
  label: string;
  type: "text" | "password";
  required: boolean;
  placeholder: string;
};

type ProviderConfigFormProps = {
  provider: PaymentProviderName;
  initialConfig: Record<string, string>;
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  testMode: boolean;
  configFields: ConfigFieldDef[];
};

export function ProviderConfigForm({
  provider,
  initialConfig,
  isActive: initialActive,
  isDefault: initialDefault,
  priority: initialPriority,
  testMode: initialTestMode,
  configFields,
}: ProviderConfigFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(initialActive);
  const [isDefault, setIsDefault] = useState(initialDefault);
  const [testMode, setTestMode] = useState(initialTestMode);
  const [config, setConfig] = useState<Record<string, string>>(initialConfig);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  function updateConfig(key: string, value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSecret(key: string) {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch("/api/billing/provider-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          isActive: active,
          isDefault: isDefault,
          priority: isDefault ? 0 : initialPriority,
          testMode,
          config,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to save configuration", "error");
        return;
      }

      setSaved(true);
      showToast(`${provider === "razorpay" ? "Razorpay" : "PayU"} configuration saved`, "success");
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } catch {
      showToast("Network error", "error");
    } finally {
      setSaving(false);
    }
  }

  function isFormValid(): boolean {
    return configFields
      .filter((f) => f.required)
      .every((f) => {
        const val = config[f.key]?.trim();
        // Allow existing values to remain; only require non-empty for new/changed
        if (initialConfig[f.key] && !config[f.key]) return true;
        return !!val;
      });
  }

  return (
    <div className="space-y-4">
      {configFields.map((field) => (
        <div key={field.key}>
          <label
            htmlFor={`${provider}-${field.key}`}
            className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground"
          >
            {field.label}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </label>
          <div className="relative mt-1">
            <input
              id={`${provider}-${field.key}`}
              type={field.type === "password" && !showSecrets[field.key] ? "password" : "text"}
              value={config[field.key] ?? ""}
              onChange={(e) => updateConfig(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="h-11 w-full rounded-md border border-border bg-surface pr-10 pl-3 text-sm"
              autoComplete="off"
            />
            {field.type === "password" && (
              <button
                type="button"
                onClick={() => toggleSecret(field.key)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showSecrets[field.key] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            )}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="size-4 rounded border-border"
          />
          Active
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="size-4 rounded border-border"
          />
          Default provider
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={testMode}
            onChange={(e) => setTestMode(e.target.checked)}
            className="size-4 rounded border-border"
          />
          Test mode
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          variant="primary"
          disabled={saving || !isFormValid()}
          className="gap-2"
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="size-4 text-green-500" />
          ) : (
            <Save className="size-4" />
          )}
          {saving ? "Saving..." : saved ? "Saved" : "Save Configuration"}
        </Button>
      </div>
    </div>
  );
}
