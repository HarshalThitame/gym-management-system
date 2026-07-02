"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Shield, ShieldCheck, ShieldOff, Smartphone, Mail, Key, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  setupTotpAction,
  verifyTotpSetupAction,
  disableTwoFactorAction,
  regenerateRecoveryCodesAction,
  updateTwoFactorPreferencesAction
} from "../actions/two-factor-actions";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { FormMessage, FieldError } from "@/features/auth/components/form-message";

type TwoFactorSettingsProps = {
  currentStatus: {
    isEnabled: boolean;
    methods: Array<{
      method_type: string;
      is_enabled: boolean;
      is_verified: boolean;
      last_used_at: string | null;
    }>;
    preferences: {
      require_2fa: boolean;
      preferred_method: string | null;
      remember_device_days: number;
    } | null;
    hasRecoveryCodes: boolean;
    remainingRecoveryCodes?: number;
  } | null;
};

export function TwoFactorSettings({ currentStatus }: TwoFactorSettingsProps) {
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupData, setSetupData] = useState<{
    secret?: string;
    qrCodeUrl?: string;
    backupCodes?: string[];
  } | null>(null);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[]>([]);

  const [setupState, setupAction] = useActionState(setupTotpAction, initialAuthActionState);
  const [verifyState, verifyAction] = useActionState(verifyTotpSetupAction, initialAuthActionState);
  const [disableState, disableAction] = useActionState(disableTwoFactorAction, initialAuthActionState);
  const [regenState, regenAction] = useActionState(regenerateRecoveryCodesAction, initialAuthActionState);
  const [prefsState, prefsAction] = useActionState(updateTwoFactorPreferencesAction, initialAuthActionState);

  const handleSetup = async () => {
    const result = await setupAction(initialAuthActionState);
    if (result.status === "success" && result.secret) {
      setSetupData({
        secret: result.secret,
        qrCodeUrl: result.qrCodeUrl,
        backupCodes: result.backupCodes
      });
      setIsSettingUp(true);
    }
  };

  const handleRegenerate = async () => {
    const result = await regenAction(initialAuthActionState);
    if (result.status === "success" && result.backupCodes) {
      setNewRecoveryCodes(result.backupCodes);
      setShowRecoveryCodes(true);
    }
  };

  const isEnabled = currentStatus?.isEnabled ?? false;
  const totpMethod = currentStatus?.methods.find((m) => m.method_type === "totp");

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isEnabled ? (
                <div className="p-2 rounded-lg bg-green-500/10">
                  <ShieldCheck className="size-6 text-green-600" />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-muted">
                  <ShieldOff className="size-6 text-muted-foreground" />
                </div>
              )}
              <div>
                <CardTitle className="text-xl">Two-Factor Authentication</CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </div>
            </div>
            <Badge variant={isEnabled ? "success" : "neutral"}>
              {isEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!isEnabled ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Two-factor authentication adds an additional layer of security to your account by requiring more than just a password to sign in.
              </p>
              <Button onClick={handleSetup} variant="accent">
                <Shield className="size-4 mr-2" />
                Enable 2FA
              </Button>
              <FormMessage state={setupState} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-surface-muted">
                <div className="flex items-center gap-3">
                  <Smartphone className="size-5 text-accent" />
                  <div>
                    <p className="font-medium">Authenticator App (TOTP)</p>
                    <p className="text-sm text-muted-foreground">
                      {totpMethod?.last_used_at
                        ? `Last used ${new Date(totpMethod.last_used_at).toLocaleDateString()}`
                        : "Active"}
                    </p>
                  </div>
                </div>
                <Badge variant="success">Active</Badge>
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-surface-muted">
                <div className="flex items-center gap-3">
                  <Key className="size-5 text-accent" />
                  <div>
                    <p className="font-medium">Recovery Codes</p>
                    <p className="text-sm text-muted-foreground">
                      {currentStatus?.remainingRecoveryCodes ?? 0} codes remaining
                    </p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={handleRegenerate}>
                  <RefreshCw className="size-4 mr-2" />
                  Regenerate
                </Button>
              </div>

              <FormMessage state={regenState} />

              {showRecoveryCodes && newRecoveryCodes.length > 0 && (
                <div className="p-4 rounded-lg border border-warning/25 bg-warning/10">
                  <p className="font-medium mb-2">New Recovery Codes</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    Save these codes in a secure location. Each code can only be used once.
                  </p>
                  <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                    {newRecoveryCodes.map((code, i) => (
                      <div key={i} className="p-2 bg-surface rounded border border-border">
                        {code}
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      navigator.clipboard.writeText(newRecoveryCodes.join("\n"));
                    }}
                  >
                    <Download className="size-4 mr-2" />
                    Copy All
                  </Button>
                </div>
              )}

              <form action={disableAction}>
                <input type="hidden" name="method" value="all" />
                <div className="space-y-3">
                  <Input
                    type="password"
                    name="confirmPassword"
                    placeholder="Confirm your password to disable 2FA"
                    required
                  />
                  <FieldError message={disableState.fieldErrors?.confirmPassword?.[0]} />
                  <Button type="submit" variant="destructive">
                    Disable 2FA
                  </Button>
                  <FormMessage state={disableState} />
                </div>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Modal */}
      {isSettingUp && setupData && (
        <Card>
          <CardHeader>
            <CardTitle>Verify Authenticator Setup</CardTitle>
            <CardDescription>
              Scan the QR code with your authenticator app, then enter the 6-digit code below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* QR Code */}
            <div className="flex justify-center p-4 bg-white rounded-lg border border-border">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.qrCodeUrl ?? "")}`}
                alt="QR Code"
                className="size-48"
              />
            </div>

            {/* Manual Entry */}
            <div className="p-3 rounded-lg bg-surface-muted border border-border">
              <p className="text-xs font-medium text-muted-foreground mb-1">Manual entry key:</p>
              <p className="font-mono text-sm break-all">{setupData.secret}</p>
            </div>

            {/* Verification Form */}
            <form action={verifyAction} className="space-y-3">
              <Input
                type="text"
                name="token"
                placeholder="Enter 6-digit code"
                maxLength={6}
                pattern="[0-9]{6}"
                required
                className="text-center text-2xl tracking-widest"
              />
              <Button type="submit" variant="accent" className="w-full">
                Verify and Enable
              </Button>
              <FormMessage state={verifyState} />
            </form>

            {/* Backup Codes */}
            {setupData.backupCodes && (
              <div className="p-4 rounded-lg border border-warning/25 bg-warning/10">
                <p className="font-medium mb-2">Backup Recovery Codes</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Save these codes in a secure location. You can use them to access your account if you lose your authenticator device.
                </p>
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {setupData.backupCodes.map((code, i) => (
                    <div key={i} className="p-2 bg-surface rounded border border-border">
                      {code}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preferences Card */}
      {isEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2FA Preferences</CardTitle>
            <CardDescription>
              Configure how two-factor authentication works for your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={prefsAction} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Require 2FA for all sign-ins</p>
                  <p className="text-sm text-muted-foreground">
                    Always require 2FA when signing in from any device
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="require2fa"
                    value="true"
                    defaultChecked={currentStatus?.preferences?.require_2fa}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Preferred method</p>
                  <p className="text-sm text-muted-foreground">
                    Choose your default 2FA method
                  </p>
                </div>
                <select
                  name="preferredMethod"
                  defaultValue={currentStatus?.preferences?.preferred_method ?? "totp"}
                  className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                >
                  <option value="totp">Authenticator App</option>
                  <option value="email">Email</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Remember device for</p>
                  <p className="text-sm text-muted-foreground">
                    Days before requiring 2FA again on trusted devices
                  </p>
                </div>
                <select
                  name="rememberDays"
                  defaultValue={currentStatus?.preferences?.remember_device_days ?? 30}
                  className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
                >
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                </select>
              </div>

              <Button type="submit" variant="secondary">
                Save Preferences
              </Button>
              <FormMessage state={prefsState} />
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
