import { getFeatureFlagsAction, getOrgFeatureFlagsAction } from "@/features/feature-flags/actions/feature-flags-actions";
import { FeatureFlagManager } from "@/features/feature-flags/components/feature-flag-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Feature Flags", description: "Manage feature flags and rollout" };

export default async function FeatureFlagsPage() {
  let flags: Awaited<ReturnType<typeof getFeatureFlagsAction>> = [];
  let orgFlags: Awaited<ReturnType<typeof getOrgFeatureFlagsAction>> = [];
  try {
    [flags, orgFlags] = await Promise.all([getFeatureFlagsAction(), getOrgFeatureFlagsAction()]);
  } catch {}

  const orgFlagMap = new Map(orgFlags.map((of) => [of.feature_flag_id, of]));

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Configuration</p>
            <h2 className="text-3xl font-black">Feature Flags</h2>
          </div>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Toggle features on/off per organization with gradual rollout support.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Feature Toggles</CardTitle>
        </CardHeader>
        <CardContent>
          <FeatureFlagManager flags={flags} orgFlagMap={Object.fromEntries(orgFlagMap)} />
        </CardContent>
      </Card>
    </div>
  );
}
