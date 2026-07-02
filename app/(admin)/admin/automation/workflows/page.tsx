import { getWorkflowsAction } from "@/features/workflows/actions/workflows-actions";
import { WorkflowList } from "@/features/workflows/components/workflow-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Workflow Builder", description: "Create and manage automated workflows" };

export default async function WorkflowsPage() {
  let workflows: Awaited<ReturnType<typeof getWorkflowsAction>> = [];
  try {
    workflows = await getWorkflowsAction();
  } catch {}

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Automation</p>
            <h2 className="text-3xl font-black">Workflow Builder</h2>
          </div>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Create visual workflows with triggers, conditions, and actions to automate your gym operations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflows</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkflowList workflows={workflows} />
        </CardContent>
      </Card>
    </div>
  );
}
