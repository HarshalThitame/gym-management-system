import { getAutomationRulesAction } from "@/features/automation/actions/automation-actions";
import { AutomationRuleList } from "@/features/automation/components/automation-rule-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Trigger-Based Automation", description: "Configure event-driven automation rules" };

export default async function AutomationTriggersPage() {
  let rules: Awaited<ReturnType<typeof getAutomationRulesAction>> = [];
  try {
    rules = await getAutomationRulesAction();
  } catch {}

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Automation</p>
            <h2 className="text-3xl font-black">Trigger-Based Automation</h2>
          </div>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Set up event-driven automation rules that respond to member activities, payments, and other events.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automation Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <AutomationRuleList rules={rules} />
        </CardContent>
      </Card>
    </div>
  );
}
