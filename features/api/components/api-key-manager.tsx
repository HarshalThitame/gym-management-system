"use client";

import { useState, useEffect } from "react";
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createApiKeyAction,
  getUserApiKeysAction,
  revokeApiKeyAction,
  getApiUsageStatsAction,
} from "../actions/api-actions";
import type { ApiKey, ApiScope } from "../services/api-key-service";

const AVAILABLE_SCOPES: { value: ApiScope; label: string; description: string }[] = [
  { value: "read:members", label: "Read Members", description: "View member data" },
  { value: "write:members", label: "Write Members", description: "Create and update members" },
  { value: "read:leads", label: "Read Leads", description: "View lead data" },
  { value: "write:leads", label: "Write Leads", description: "Create and update leads" },
  { value: "read:attendance", label: "Read Attendance", description: "View attendance records" },
  { value: "write:attendance", label: "Write Attendance", description: "Record check-ins/outs" },
  { value: "read:payments", label: "Read Payments", description: "View payment data" },
  { value: "read:reports", label: "Read Reports", description: "Access reports" },
];

export function ApiKeyManager() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<ApiScope[]>([]);
  const [newKeyExpiry, setNewKeyExpiry] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [usageStats, setUsageStats] = useState<Record<string, any>>({});

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    setIsLoading(true);
    try {
      const keys = await getUserApiKeysAction();
      setApiKeys(keys);

      // Load usage stats for each key
      const stats: Record<string, any> = {};
      for (const key of keys) {
        stats[key.id] = await getApiUsageStatsAction(key.id);
      }
      setUsageStats(stats);
    } catch (error) {
      console.error("Failed to load API keys:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName || newKeyScopes.length === 0) return;

    try {
      const result = await createApiKeyAction(
        newKeyName,
        newKeyScopes,
        newKeyExpiry || undefined
      );
      setCreatedKey(result.key);
      setNewKeyName("");
      setNewKeyScopes([]);
      setNewKeyExpiry("");
      setShowCreateForm(false);
      await loadApiKeys();
    } catch (error) {
      console.error("Failed to create API key:", error);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) {
      return;
    }

    try {
      await revokeApiKeyAction(keyId);
      await loadApiKeys();
    } catch (error) {
      console.error("Failed to revoke API key:", error);
    }
  };

  const handleCopyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const toggleRevealKey = (keyId: string) => {
    const newRevealed = new Set(revealedKeys);
    if (newRevealed.has(keyId)) {
      newRevealed.delete(keyId);
    } else {
      newRevealed.add(keyId);
    }
    setRevealedKeys(newRevealed);
  };

  const toggleScope = (scope: ApiScope) => {
    setNewKeyScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>
              Manage API keys for external integrations
            </CardDescription>
          </div>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Key
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Created Key Display */}
        {createdKey && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-green-900 dark:text-green-100">
                  API Key Created Successfully
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Copy this key now. You won&apos;t be able to see it again.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 rounded bg-green-100 px-3 py-2 text-sm font-mono dark:bg-green-900">
                    {createdKey}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyKey(createdKey)}
                  >
                    {copiedKey ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="rounded-lg border p-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Key Name</label>
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Production Integration"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Scopes</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {AVAILABLE_SCOPES.map((scope) => (
                  <button
                    key={scope.value}
                    onClick={() => toggleScope(scope.value)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      newKeyScopes.includes(scope.value)
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="font-medium text-sm">{scope.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {scope.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Expiration (optional)</label>
              <Input
                type="datetime-local"
                value={newKeyExpiry}
                onChange={(e) => setNewKeyExpiry(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCreateKey}
                disabled={!newKeyName || newKeyScopes.length === 0}
              >
                Create API Key
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* API Keys List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading API keys...</div>
        ) : apiKeys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No API keys yet. Create one to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{key.name}</h4>
                      {!key.is_active && (
                        <Badge variant="destructive">Revoked</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs font-mono text-muted-foreground">
                        {revealedKeys.has(key.id) ? key.key_prefix + "..." : key.key_prefix + "••••••••"}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleRevealKey(key.id)}
                      >
                        {revealedKeys.has(key.id) ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                  {key.is_active && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRevokeKey(key.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {key.scopes.map((scope) => (
                    <Badge key={scope} variant="secondary" className="text-xs">
                      {scope}
                    </Badge>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <div className="text-muted-foreground">Created</div>
                    <div className="font-medium">
                      {new Date(key.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Last Used</div>
                    <div className="font-medium">
                      {key.last_used_at
                        ? new Date(key.last_used_at).toLocaleDateString()
                        : "Never"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Expires</div>
                    <div className="font-medium">
                      {key.expires_at
                        ? new Date(key.expires_at).toLocaleDateString()
                        : "Never"}
                    </div>
                  </div>
                </div>

                {usageStats[key.id] && (
                  <div className="pt-3 border-t">
                    <div className="text-xs text-muted-foreground mb-2">
                      Usage (last 30 days)
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-xs">
                      <div>
                        <div className="font-medium text-lg">
                          {usageStats[key.id].total}
                        </div>
                        <div className="text-muted-foreground">Total</div>
                      </div>
                      <div>
                        <div className="font-medium text-lg text-green-600">
                          {usageStats[key.id].success}
                        </div>
                        <div className="text-muted-foreground">Success</div>
                      </div>
                      <div>
                        <div className="font-medium text-lg text-red-600">
                          {usageStats[key.id].failed}
                        </div>
                        <div className="text-muted-foreground">Failed</div>
                      </div>
                      <div>
                        <div className="font-medium text-lg">
                          {usageStats[key.id].avgResponseTime}ms
                        </div>
                        <div className="text-muted-foreground">Avg Time</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
