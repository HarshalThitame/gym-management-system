"use client";

import { useState, useTransition, useEffect } from "react";
import { useActionState } from "react";
import {
  Shield, Download, Trash2, FileText, AlertTriangle, CheckCircle,
  Clock, Eye, XCircle, Users, Database, Scale
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Input } from "@/components/ui/input";
import {
  adminGetDeletionRequestsAction,
  adminReviewDeletionAction,
  adminExecuteDeletionAction,
  getGdprDashboardAction
} from "../actions/gdpr-actions";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { FormMessage } from "@/features/auth/components/form-message";

type DeletionRequest = {
  id: string;
  user_id: string;
  status: string;
  reason: string | null;
  rejection_reason: string | null;
  legal_hold: boolean;
  data_summary: Record<string, unknown> | null;
  created_at: string;
  reviewed_at: string | null;
  completed_at: string | null;
};

type DashboardData = {
  exportRequests: Array<{ id: string; status: string; created_at: string }>;
  deletionRequests: DeletionRequest[];
  processingRecords: Array<Record<string, unknown>>;
  breachRecords: Array<Record<string, unknown>>;
  stats: {
    pendingExports: number;
    pendingDeletions: number;
    activeProcessingRecords: number;
    openBreaches: number;
  };
};

export function GdprDashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedRequest, setSelectedRequest] = useState<DeletionRequest | null>(null);
  const [reviewState, reviewAction] = useActionState(adminReviewDeletionAction, initialAuthActionState);
  const [executeState, executeAction] = useActionState(adminExecuteDeletionAction, initialAuthActionState);

  useEffect(() => {
    startTransition(async () => {
      const data = await getGdprDashboardAction();
      setDashboard(data);
    });
  }, []);

  const refreshData = () => {
    startTransition(async () => {
      const data = await getGdprDashboardAction();
      setDashboard(data);
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "success" | "warning" | "error" | "info" | "neutral"> = {
      pending: "warning",
      reviewing: "info",
      approved: "success",
      processing: "info",
      completed: "success",
      rejected: "error",
      failed: "error"
    };
    return <Badge variant={variants[status] ?? "neutral"}>{status}</Badge>;
  };

  if (isPending && !dashboard) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {dashboard && (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Pending Exports"
            value={String(dashboard.stats.pendingExports)}
            icon={<Download className="size-5" />}
            detail="Awaiting processing"
            status={dashboard.stats.pendingExports > 0 ? "watch" : "good"}
          />
          <StatCard
            label="Pending Deletions"
            value={String(dashboard.stats.pendingDeletions)}
            icon={<Trash2 className="size-5" />}
            detail="Awaiting review"
            status={dashboard.stats.pendingDeletions > 0 ? "risk" : "good"}
          />
          <StatCard
            label="Processing Records"
            value={String(dashboard.stats.activeProcessingRecords)}
            icon={<Database className="size-5" />}
            detail="Active data processing"
          />
          <StatCard
            label="Open Breaches"
            value={String(dashboard.stats.openBreaches)}
            icon={<AlertTriangle className="size-5" />}
            detail="Security incidents"
            status={dashboard.stats.openBreaches > 0 ? "risk" : "good"}
          />
        </div>
      )}

      {/* Deletion Requests */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Trash2 className="size-5 text-red-600" />
            </div>
            <div>
              <CardTitle>Account Deletion Requests</CardTitle>
              <CardDescription>
                Review and process right-to-be-forgotten requests
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {dashboard?.deletionRequests.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle className="mx-auto size-12 text-green-500/50" />
              <p className="mt-2 text-sm text-muted-foreground">No deletion requests</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dashboard?.deletionRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-surface-muted transition-colors cursor-pointer"
                  onClick={() => setSelectedRequest(request)}
                >
                  <div className="shrink-0">
                    {request.status === "pending" || request.status === "reviewing" ? (
                      <Clock className="size-5 text-amber-500" />
                    ) : request.status === "completed" ? (
                      <CheckCircle className="size-5 text-green-500" />
                    ) : request.status === "rejected" ? (
                      <XCircle className="size-5 text-red-500" />
                    ) : (
                      <Eye className="size-5 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium font-mono">
                        {request.user_id.slice(0, 8)}...
                      </span>
                      {getStatusBadge(request.status)}
                      {request.legal_hold && (
                        <Badge variant="error">Legal Hold</Badge>
                      )}
                    </div>
                    {request.reason && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        Reason: {request.reason}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">
                      {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Processing Records */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Scale className="size-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Data Processing Records</CardTitle>
              <CardDescription>
                Article 30 records of processing activities
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {dashboard?.processingRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No processing records defined yet.
            </p>
          ) : (
            <div className="space-y-2">
              {dashboard?.processingRecords.map((record, i) => (
                <div key={i} className="p-3 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{String(record.purpose ?? "")}</p>
                    <Badge variant="info">{String(record.legal_basis ?? "")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Retention: {String(record.retention_period ?? "")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Deletion Request Detail</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">User ID</p>
                  <p className="text-sm font-mono">{selectedRequest.user_id}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  {getStatusBadge(selectedRequest.status)}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Requested</p>
                  <p className="text-sm">{new Date(selectedRequest.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Legal Hold</p>
                  <p className="text-sm">{selectedRequest.legal_hold ? "Yes" : "No"}</p>
                </div>
              </div>

              {selectedRequest.reason && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Reason</p>
                  <p className="text-sm">{selectedRequest.reason}</p>
                </div>
              )}

              {selectedRequest.data_summary && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Data Summary</p>
                  <pre className="p-3 rounded-lg bg-surface-muted border border-border text-xs overflow-x-auto">
                    {JSON.stringify(selectedRequest.data_summary, null, 2)}
                  </pre>
                </div>
              )}

              {/* Review Actions */}
              {(selectedRequest.status === "pending" || selectedRequest.status === "reviewing") && (
                <div className="space-y-3 pt-3 border-t border-border">
                  <p className="text-sm font-medium">Review Actions</p>

                  <form action={reviewAction} className="flex gap-2">
                    <input type="hidden" name="requestId" value={selectedRequest.id} />
                    <input type="hidden" name="approved" value="true" />
                    <Button type="submit" variant="accent" size="sm">
                      <CheckCircle className="size-4 mr-1" />
                      Approve
                    </Button>
                  </form>

                  <form action={reviewAction} className="space-y-2">
                    <input type="hidden" name="requestId" value={selectedRequest.id} />
                    <input type="hidden" name="approved" value="false" />
                    <Input
                      name="rejectionReason"
                      placeholder="Reason for rejection..."
                      className="text-sm"
                    />
                    <Button type="submit" variant="destructive" size="sm">
                      <XCircle className="size-4 mr-1" />
                      Reject
                    </Button>
                  </form>

                  <FormMessage state={reviewState} />
                </div>
              )}

              {/* Execute Deletion */}
              {selectedRequest.status === "approved" && !selectedRequest.legal_hold && (
                <div className="space-y-3 pt-3 border-t border-border">
                  <p className="text-sm font-medium text-red-600">Execute Deletion</p>
                  <p className="text-xs text-muted-foreground">
                    This will permanently delete all user data. This action cannot be undone.
                  </p>
                  <form action={executeAction}>
                    <input type="hidden" name="requestId" value={selectedRequest.id} />
                    <Button type="submit" variant="destructive">
                      <Trash2 className="size-4 mr-1" />
                      Execute Deletion
                    </Button>
                  </form>
                  <FormMessage state={executeState} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
