"use client";

import { useState } from "react";
import { CreditCard, MessageSquare, Video, CalendarDays, Mail, MessageCircle, Link2, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INTEGRATION_PROVIDERS, type IntegrationRow } from "../services/integrations-service";
import { connectIntegrationAction, disconnectIntegrationAction } from "../actions/integrations-actions";

type Props = {
  integrations: IntegrationRow[];
};

const ICON_MAP: Record<string, React.ReactNode> = {
  "credit-card": <CreditCard className="size-8" />,
  "message-square": <MessageSquare className="size-8" />,
  "video": <Video className="size-8" />,
  "calendar-days": <CalendarDays className="size-8" />,
  "mail": <Mail className="size-8" />,
  "message-circle": <MessageCircle className="size-8" />,
};

export function IntegrationsGrid({ integrations }: Props) {
  const [showForm, setShowForm] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");

  const connectedProviders = new Set(integrations.map((i) => i.provider));

  const handleConnect = async (providerId: string) => {
    if (connectedProviders.has(providerId)) return;
    setShowForm(providerId);
  };

  const handleSubmit = async (providerId: string) => {
    const formData = new FormData();
    formData.set("provider", providerId);
    formData.set("label", providerId);
    formData.set("apiKey", apiKey);
    await connectIntegrationAction(formData);
    setShowForm(null);
    setApiKey("");
  };

  const handleDisconnect = async (id: string) => {
    await disconnectIntegrationAction(id);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {INTEGRATION_PROVIDERS.map((provider) => {
        const integration = integrations.find((i) => i.provider === provider.id);
        const isConnected = !!integration;

        return (
          <div key={provider.id} className={`p-4 rounded-lg border ${isConnected ? "border-green-500/30 bg-green-500/5" : "border-border"}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-accent/10">
                {ICON_MAP[provider.icon] || <Link2 className="size-8" />}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                isConnected ? "bg-green-500/10 text-green-600" : "bg-gray-500/10 text-gray-500"
              }`}>
                {isConnected ? "Connected" : "Available"}
              </span>
            </div>
            <h3 className="font-semibold">{provider.label}</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-3">{provider.description}</p>

            {showForm === provider.id ? (
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="accent" onClick={() => handleSubmit(provider.id)}>Connect</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowForm(null)}>Cancel</Button>
                </div>
              </div>
            ) : isConnected ? (
              <div className="space-y-2">
                <p className="text-xs text-green-600">Connected</p>
                <Button size="sm" variant="ghost" onClick={() => handleDisconnect(integration.id)}>
                  <Link2Off className="size-3 mr-1" /> Disconnect
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => handleConnect(provider.id)}>
                <Link2 className="size-3 mr-1" /> Connect
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
