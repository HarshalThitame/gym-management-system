import { BulkOperationsHistory } from "@/features/bulk-operations/components/bulk-operations-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BulkOperationsPage() {
  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Bulk Operations</h1>
        <p className="text-muted-foreground">
          View and manage bulk operations history
        </p>
      </div>

      <BulkOperationsHistory />

      <Card>
        <CardHeader>
          <CardTitle>About Bulk Operations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Bulk operations allow you to perform actions on multiple records at once, saving time and improving efficiency.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border p-4">
              <h3 className="font-semibold text-foreground">Bulk Delete</h3>
              <p className="mt-1 text-xs">
                Remove multiple records simultaneously. Use with caution as this action cannot be undone.
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <h3 className="font-semibold text-foreground">Bulk Update</h3>
              <p className="mt-1 text-xs">
                Update common fields across multiple records with the same values.
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <h3 className="font-semibold text-foreground">Bulk Assign</h3>
              <p className="mt-1 text-xs">
                Assign multiple records to a team member or department in one operation.
              </p>
            </div>
          </div>
          <p className="text-xs">
            All bulk operations are logged and can be tracked in the history above. Operations run asynchronously and may take a few moments to complete.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
