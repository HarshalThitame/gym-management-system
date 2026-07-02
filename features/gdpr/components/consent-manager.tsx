"use client";

import { useState, useTransition, useEffect } from "react";
import { useActionState } from "react";
import { Shield, Mail, MessageSquare, Bell, Cookie, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { updateConsentAction, getUserConsentsAction } from "../actions/gdpr-actions";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { FormMessage } from "@/features/auth/components/form-message";

type ConsentType = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  is_required: boolean;
  category: string;
};

type UserConsent = {
  id: string;
  consent_type: string;
  granted: boolean;
  granted_at: string | null;
  withdrawn_at: string | null;
};

export function ConsentManager() {
  const [consentTypes, setConsentTypes] = useState<ConsentType[]>([]);
  const [userConsents, setUserConsents] = useState<UserConsent[]>([]);
  const [isPending, startTransition] = useTransition();
  const [updateState, updateAction] = useActionState(updateConsentAction, initialAuthActionState);

  useEffect(() => {
    startTransition(async () => {
      const result = await getUserConsentsAction();
      setConsentTypes(result.consentTypes as ConsentType[]);
      setUserConsents(result.consents as UserConsent[]);
    });
  }, []);

  const getConsentStatus = (consentTypeKey: string): boolean | null => {
    const consent = userConsents.find((c) => c.consent_type === consentTypeKey);
    return consent?.granted ?? null;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "marketing": return <Mail className="size-4" />;
      case "functional": return <Shield className="size-4" />;
      case "analytics": return <Cookie className="size-4" />;
      case "required": return <CheckCircle className="size-4" />;
      default: return <Bell className="size-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "marketing": return "bg-purple-500/10 text-purple-600";
      case "functional": return "bg-blue-500/10 text-blue-600";
      case "analytics": return "bg-amber-500/10 text-amber-600";
      case "required": return "bg-green-500/10 text-green-600";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const groupedConsents = consentTypes.reduce((acc, ct) => {
    if (!acc[ct.category]) acc[ct.category] = [];
    acc[ct.category].push(ct);
    return acc;
  }, {} as Record<string, ConsentType[]>);

  const categoryLabels: Record<string, string> = {
    required: "Required",
    functional: "Functional",
    analytics: "Analytics",
    marketing: "Marketing"
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Privacy & Consent Settings</CardTitle>
          <CardDescription>
            Manage how we use your data. You can withdraw consent at any time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            Object.entries(groupedConsents).map(([category, types]) => (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${getCategoryColor(category)}`}>
                    {getCategoryIcon(category)}
                  </div>
                  <h3 className="font-medium">{categoryLabels[category] ?? category}</h3>
                </div>

                <div className="space-y-2 ml-7">
                  {types.map((consentType) => {
                    const status = getConsentStatus(consentType.key);
                    const isGranted = status === true;

                    return (
                      <div
                        key={consentType.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-border"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{consentType.label}</p>
                            {consentType.is_required && (
                              <Badge variant="neutral" className="text-xs">Required</Badge>
                            )}
                          </div>
                          {consentType.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {consentType.description}
                            </p>
                          )}
                        </div>

                        <form action={updateAction}>
                          <input type="hidden" name="consentType" value={consentType.key} />
                          <input type="hidden" name="granted" value={(!isGranted).toString()} />

                          {consentType.is_required ? (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="size-4" />
                              <span className="text-xs font-medium">Active</span>
                            </div>
                          ) : (
                            <Button
                              type="submit"
                              variant={isGranted ? "secondary" : "outline"}
                              size="sm"
                            >
                              {isGranted ? (
                                <>
                                  <CheckCircle className="size-3 mr-1" />
                                  Granted
                                </>
                              ) : (
                                <>
                                  <XCircle className="size-3 mr-1" />
                                  Grant
                                </>
                              )}
                            </Button>
                          )}
                        </form>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          <FormMessage state={updateState} />
        </CardContent>
      </Card>

      {/* Data Rights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Data Rights</CardTitle>
          <CardDescription>
            Under GDPR, you have the following rights regarding your personal data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-muted">
            <Shield className="size-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Right to Access</p>
              <p className="text-xs text-muted-foreground">
                You can request a copy of all personal data we hold about you.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-muted">
            <Mail className="size-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Right to Data Portability</p>
              <p className="text-xs text-muted-foreground">
                You can export your data in a machine-readable format.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-muted">
            <XCircle className="size-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Right to Erasure</p>
              <p className="text-xs text-muted-foreground">
                You can request deletion of your personal data (&quot;right to be forgotten&quot;).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-muted">
            <Cookie className="size-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Right to Restrict Processing</p>
              <p className="text-xs text-muted-foreground">
                You can withdraw consent for non-essential data processing at any time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
