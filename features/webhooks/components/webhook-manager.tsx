"use client";

import { useState, useEffect } from "react";
import { Webhook, Plus, Trash2, Edit2, Check, X, AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createWebhookAction,
  getUserWebhooksAction,
  updateWebhookAction,
  deleteWebhookAction,
  getWebhookDeliveriesAction,
  testWebhookDeliveryAction,
} from "../actions/webhook-actions";
import type { Webhook as WebhookType, WebhookDelivery, WebhookEvent } from "../services/webhook-service";

const AVAILABLE_EVENTS: { value: WebhookEvent; label: string; description: string }[] = [
  { value: "member.created", label: "Member Created", description: "When a new member is added" },
  { value: "member.updated", label: "Member Updated", description: "When member data changes" },
  { value: "member.deleted", label: "Member Deleted", description: "When a member is removed" },
  { value: "lead.created", label: "Lead Created", description: "When a new lead is added" },
  { value: "lead.updated", label: "Lead Updated", description: "When lead data changes" },
  { value: "lead.converted", label: "Lead Converted", description: "When a lead becomes a member" },
  { value: "payment.created", label: "Payment Created", description: "When a payment is initiated" },
  { value: "payment.completed", label: "Payment Completed", description: "When a payment succeeds" },
  { value: "payment.failed", label: "Payment Failed", description: "When a payment fails" },
  { value: "attendance.check_in", label: "Check-in", description: "When a member checks in" },
  { value: "attendance.check_out", label: "Check-out", description: "When a member checks out" },
];

export function WebhookManager() {
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookType | null>(null);
  const [selectedDeliveries, setSelectedDeliveries] = useState<Record<string, WebhookDelivery[]>>({});

  // Form state
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>([]);

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    setIsLoading(true);
    try {
      const data = await getUserWebhooksAction();
      setWebhooks(data);
    } catch (error) {
      console.error("Failed to load webhooks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!name || !url || events.length === 0) return;

    try {
      await createWebhookAction(name, url, events);
      setName("");
      setUrl("");
      setEvents([]);
      setShowCreateForm(false);
      await loadWebhooks();
    } catch (error) {
      console.error("Failed to create webhook:", error);
    }
  };

  const handleUpdate = async () => {
    if (!editingWebhook) return;

    try {
      await updateWebhookAction(editingWebhook.id, { name, url, events });
      setEditingWebhook(null);
      setName("");
      setUrl("");
      setEvents([]);
      await loadWebhooks();
    } catch (error) {
      console.error("Failed to update webhook:", error);
    }
  };

  const handleDelete = async (webhookId: string) => {
    if (!confirm("Are you sure you want to delete this webhook?")) return;

    try {
      await deleteWebhookAction(webhookId);
      await loadWebhooks();
    } catch (error) {
      console.error("Failed to delete webhook:", error);
    }
  };

  const handleTest = async (webhookId: string) => {
    try {
      const result = await testWebhookDeliveryAction(webhookId);
      alert(result.success ? "Test delivery successful!" : `Test failed: ${result.error}`);
    } catch (error) {
      console.error("Failed to test webhook:", error);
    }
  };

  const handleToggleActive = async (webhook: WebhookType) => {
    try {
      await updateWebhookAction(webhook.id, { is_active: !webhook.is_active });
      await loadWebhooks();
    } catch (error) {
      console.error("Failed to toggle webhook:", error);
    }
  };

  const loadDeliveries = async (webhookId: string) => {
    try {
      const deliveries = await getWebhookDeliveriesAction(webhookId);
      setSelectedDeliveries((prev) => ({ ...prev, [webhookId]: deliveries }));
    } catch (error) {
      console.error("Failed to load deliveries:", error);
    }
  };

  const toggleEvent = (event: WebhookEvent) => {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const startEdit = (webhook: WebhookType) => {
    setEditingWebhook(webhook);
    setName(webhook.name);
    setUrl(webhook.url);
    setEvents(webhook.events as WebhookEvent[]);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhooks
            </CardTitle>
            <CardDescription>
              Configure webhooks to receive real-time event notifications
            </CardDescription>
          </div>
          <Button onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Webhook
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create/Edit Form */}
        {(showCreateForm || editingWebhook) && (
          <div className="rounded-lg border p-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Production Notifications"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Endpoint URL</label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-app.com/webhooks"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Events</label>
              <div className="mt-2 grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {AVAILABLE_EVENTS.map((event) => (
                  <button
                    key={event.value}
                    onClick={() => toggleEvent(event.value)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      events.includes(event.value)
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="font-medium text-sm">{event.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {event.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={editingWebhook ? handleUpdate : handleCreate}
                disabled={!name || !url || events.length === 0}
              >
                {editingWebhook ? "Update" : "Create"} Webhook
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingWebhook(null);
                  setName("");
                  setUrl("");
                  setEvents([]);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Webhooks List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading webhooks...</div>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No webhooks configured. Add one to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((webhook) => (
              <div key={webhook.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{webhook.name}</h4>
                      {!webhook.is_active && (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </div>
                    <code className="text-xs text-muted-foreground mt-1 block">
                      {webhook.url}
                    </code>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTest(webhook.id)}
                    >
                      <Zap className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(webhook)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleActive(webhook)}
                    >
                      {webhook.is_active ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(webhook.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {webhook.events.map((event) => (
                    <Badge key={event} variant="secondary" className="text-xs">
                      {event}
                    </Badge>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground">
                  Created {new Date(webhook.created_at).toLocaleDateString()}
                </div>

                {/* Deliveries */}
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadDeliveries(webhook.id)}
                  >
                    View Deliveries
                  </Button>

                  {selectedDeliveries[webhook.id] && (
                    <div className="mt-3 space-y-2">
                      {selectedDeliveries[webhook.id].slice(0, 5).map((delivery) => (
                        <div
                          key={delivery.id}
                          className="rounded border p-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{delivery.event_type}</span>
                            <div className="flex items-center gap-2">
                              {delivery.success ? (
                                <Badge variant="success" className="text-xs">
                                  {delivery.response_status}
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-xs">
                                  {delivery.response_status || "Failed"}
                                </Badge>
                              )}
                              <span className="text-muted-foreground">
                                {new Date(delivery.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          {delivery.attempts > 1 && (
                            <div className="text-muted-foreground mt-1">
                              {delivery.attempts} attempts
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
