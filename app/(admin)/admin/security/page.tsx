import type { Metadata } from "next";
import { Shield, Globe, Lock, Key } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSecurityDashboardAction, adminGetIpWhitelistAction, adminGetPasswordPolicyAction, adminAddIpAction, adminRemoveIpAction, adminUpdatePasswordPolicyAction } from "@/features/security/actions/security-actions";

export const metadata: Metadata = {
  title: "Security Settings",
  description: "Manage IP whitelisting, password policies, and security settings."
};

export default async function AdminSecurityPage() {
  const [dashboard, whitelist, passwordPolicy] = await Promise.all([
    getSecurityDashboardAction(),
    adminGetIpWhitelistAction(),
    adminGetPasswordPolicyAction()
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/10">
            <Shield className="size-6 text-accent" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Security</p>
            <h2 className="text-3xl font-black">Security Settings</h2>
          </div>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Configure IP whitelisting, password policies, and account lockout settings.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Shield className="size-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-black">{dashboard.activeSessions}</p>
                <p className="text-xs text-muted-foreground">Active Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Globe className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-black">{dashboard.whitelistedIps}</p>
                <p className="text-xs text-muted-foreground">Whitelisted IPs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Lock className="size-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-black">{dashboard.lockedAccounts}</p>
                <p className="text-xs text-muted-foreground">Locked Accounts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Key className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-black">{dashboard.hasPasswordPolicy ? "Active" : "Default"}</p>
                <p className="text-xs text-muted-foreground">Password Policy</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* IP Whitelist */}
      <Card>
        <CardHeader>
          <CardTitle>IP Whitelist</CardTitle>
          <CardDescription>
            Restrict admin access to specific IP addresses
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={adminAddIpAction} className="flex gap-2">
            <Input name="ipAddress" placeholder="IP Address (e.g., 192.168.1.1)" required className="flex-1" />
            <Input name="label" placeholder="Label (optional)" className="w-48" />
            <Button type="submit" variant="accent">Add IP</Button>
          </form>

          {whitelist.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No IP whitelist configured. All IPs are allowed.
            </p>
          ) : (
            <div className="space-y-2">
              {whitelist.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm font-medium font-mono">{entry.ip_address}</p>
                    {entry.label && <p className="text-xs text-muted-foreground">{entry.label}</p>}
                  </div>
                  <form action={adminRemoveIpAction}>
                    <input type="hidden" name="id" value={entry.id} />
                    <Button variant="ghost" size="sm" type="submit">Remove</Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password Policy */}
      <Card>
        <CardHeader>
          <CardTitle>Password Policy</CardTitle>
          <CardDescription>
            Configure password requirements and account lockout settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={adminUpdatePasswordPolicyAction} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Minimum Length</label>
                <Input name="minLength" type="number" min="8" max="128" defaultValue={passwordPolicy?.min_length ?? 12} />
              </div>
              <div>
                <label className="text-sm font-medium">Max Login Attempts</label>
                <Input name="maxLoginAttempts" type="number" min="3" max="20" defaultValue={passwordPolicy?.max_login_attempts ?? 5} />
              </div>
              <div>
                <label className="text-sm font-medium">Lockout Duration (minutes)</label>
                <Input name="lockoutDuration" type="number" min="5" max="1440" defaultValue={passwordPolicy?.lockout_duration_minutes ?? 15} />
              </div>
              <div>
                <label className="text-sm font-medium">Prevent Reuse (count)</label>
                <Input name="preventReuse" type="number" min="0" max="24" defaultValue={passwordPolicy?.prevent_reuse_count ?? 5} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="requireUppercase" value="true" defaultChecked={passwordPolicy?.require_uppercase ?? true} className="rounded" />
                <span className="text-sm">Require uppercase letter</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="requireLowercase" value="true" defaultChecked={passwordPolicy?.require_lowercase ?? true} className="rounded" />
                <span className="text-sm">Require lowercase letter</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="requireNumbers" value="true" defaultChecked={passwordPolicy?.require_numbers ?? true} className="rounded" />
                <span className="text-sm">Require number</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="requireSpecialChars" value="true" defaultChecked={passwordPolicy?.require_special_chars ?? true} className="rounded" />
                <span className="text-sm">Require special character</span>
              </label>
            </div>

            <Button type="submit" variant="accent">Save Policy</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
