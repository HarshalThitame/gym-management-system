"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Search,
  X,
  XCircle,
  ExternalLink,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { showToast, ToastContainer } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  approveRequestAction,
  rejectRequestAction,
  markRequestUnderReviewAction,
  getAllSubscriptionRequestsAction,
  getPendingRequestsCountAction,
  syncEntitlementsAction,
  syncUsageLimitsAction,
} from "@/features/subscription/super-admin-actions";
import type {
  SubscriptionRequestWithDetails,
  SubscriptionRequestType,
  SubscriptionRequestStatus,
} from "@/features/subscription/types";
import { REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS } from "@/features/subscription/types";

type RequestFilter = "all" | "pending" | "under_review" | "approved" | "rejected";

export function RequestQueueClient() {
  const [requests, setRequests] = useState<SubscriptionRequestWithDetails[]>([]);
  const [filter, setFilter] = useState<RequestFilter>("pending");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<SubscriptionRequestWithDetails | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveModal, setApproveModal] = useState<SubscriptionRequestWithDetails | null>(null);
  const [approveNote, setApproveNote] = useState("");
  const [detailModal, setDetailModal] = useState<SubscriptionRequestWithDetails | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const result = await getAllSubscriptionRequestsAction();
    if (result.ok && result.data) {
      setRequests(result.data);
    }
    setLoading(false);
  }, []);

  const loadPendingCount = useCallback(async () => {
    const result = await getPendingRequestsCountAction();
    if (result.ok && result.data) {
      setPendingCount(result.data.count);
    }
  }, []);

  useEffect(() => {
    loadRequests();
    loadPendingCount();
  }, [loadRequests, loadPendingCount]);

  const filtered = filter === "all"
    ? requests
    : requests.filter((r) => r.status === filter);

  const handleMarkReviewing = async (requestId: string) => {
    setActionLoading(requestId);
    const result = await markRequestUnderReviewAction({ requestId });
    if (result.ok) {
      showToast("Marked as under review", "success");
      loadRequests();
    } else {
      showToast(result.error ?? "Failed to mark as under review", "error");
    }
    setActionLoading(null);
  };

  const handleApprove = async () => {
    if (!approveModal) return;
    setActionLoading(approveModal.id);
    const result = await approveRequestAction({
      requestId: approveModal.id,
      adminNote: approveNote || null,
    });
    if (result.ok) {
      showToast(`${REQUEST_TYPE_LABELS[approveModal.request_type as SubscriptionRequestType] ?? "Request"} approved successfully`, "success");
      setApproveModal(null);
      setApproveNote("");
      loadRequests();
      loadPendingCount();
    } else {
      showToast(result.error ?? "Failed to approve", "error");
    }
    setActionLoading(null);
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    const result = await rejectRequestAction({
      requestId: rejectModal.id,
      rejectionReason: rejectReason || null,
    });
    if (result.ok) {
      showToast("Request rejected", "success");
      setRejectModal(null);
      setRejectReason("");
      loadRequests();
      loadPendingCount();
    } else {
      showToast(result.error ?? "Failed to reject", "error");
    }
    setActionLoading(null);
  };

  const handleSyncEntitlements = async (orgId: string) => {
    setActionLoading(`sync-${orgId}`);
    const result = await syncEntitlementsAction(orgId);
    if (result.ok) {
      showToast("Entitlements synced successfully", "success");
    } else {
      showToast(result.error ?? "Failed to sync entitlements", "error");
    }
    setActionLoading(null);
  };

  const handleSyncLimits = async (orgId: string) => {
    setActionLoading(`limits-${orgId}`);
    const result = await syncUsageLimitsAction(orgId);
    if (result.ok) {
      showToast("Usage limits synced successfully", "success");
    } else {
      showToast(result.error ?? "Failed to sync limits", "error");
    }
    setActionLoading(null);
  };

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      pending: "bg-amber-100 text-amber-800 border-amber-200",
      under_review: "bg-blue-100 text-blue-800 border-blue-200",
      approved: "bg-green-100 text-green-800 border-green-200",
      rejected: "bg-red-100 text-red-800 border-red-200",
      cancelled_by_organization: "bg-gray-100 text-gray-800 border-gray-200",
      completed: "bg-green-100 text-green-800 border-green-200",
    };
    return styles[status] ?? "bg-gray-100 text-gray-800 border-gray-200";
  }

  const tabs: { key: RequestFilter; label: string }[] = [
    { key: "pending", label: `Pending (${pendingCount})` },
    { key: "under_review", label: "Under Review" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "all", label: "All" },
  ];

  return (
    <div>
      <ToastContainer />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-semibold transition",
              filter === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            )}
            type="button"
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={loadRequests}
          className="ml-auto rounded-md bg-surface p-2 text-muted-foreground hover:bg-surface-muted"
          type="button"
          aria-label="Refresh"
        >
          <RefreshCw className="size-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="size-12 text-green-500" />
            <p className="mt-4 text-lg font-bold">No requests found</p>
            <p className="text-sm text-muted-foreground">All subscription requests have been processed.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => (
            <Card key={req.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black">
                        {REQUEST_TYPE_LABELS[req.request_type as SubscriptionRequestType] ?? req.request_type}
                      </h3>
                      <Badge className={getStatusBadge(req.status)}>
                        {REQUEST_STATUS_LABELS[req.status as SubscriptionRequestStatus] ?? req.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>Requested: {new Date(req.requested_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      {req.requested_package_name && (
                        <span>Package: {req.requested_package_name}</span>
                      )}
                      {req.current_package_name && (
                        <span>Current: {req.current_package_name}</span>
                      )}
                      {req.reason && (
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="size-3" />
                          {req.reason}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      onClick={() => setDetailModal(req)}
                      className="rounded-md border border-border bg-surface p-2 text-muted-foreground hover:bg-surface-muted"
                      type="button"
                      aria-label="View details"
                    >
                      <Eye className="size-4" />
                    </button>
                    {req.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleMarkReviewing(req.id)}
                          disabled={actionLoading === req.id}
                          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-muted disabled:opacity-50"
                          type="button"
                        >
                          {actionLoading === req.id ? <Loader2 className="size-3 animate-spin" /> : "Review"}
                        </button>
                        <Button
                          onClick={() => setApproveModal(req)}
                          size="sm"
                          variant="primary"
                        >
                          Approve
                        </Button>
                        <Button
                          onClick={() => setRejectModal(req)}
                          size="sm"
                          variant="destructive"
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {req.status === "under_review" && (
                      <>
                        <Button
                          onClick={() => setApproveModal(req)}
                          size="sm"
                          variant="primary"
                        >
                          Approve
                        </Button>
                        <Button
                          onClick={() => setRejectModal(req)}
                          size="sm"
                          variant="destructive"
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {req.status === "approved" && (
                      <>
                        <button
                          onClick={() => handleSyncEntitlements(req.organization_id)}
                          disabled={actionLoading === `sync-${req.organization_id}`}
                          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-muted disabled:opacity-50"
                          type="button"
                        >
                          {actionLoading === `sync-${req.organization_id}` ? <Loader2 className="size-3 animate-spin" /> : "Sync Features"}
                        </button>
                        <button
                          onClick={() => handleSyncLimits(req.organization_id)}
                          disabled={actionLoading === `limits-${req.organization_id}`}
                          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-muted disabled:opacity-50"
                          type="button"
                        >
                          {actionLoading === `limits-${req.organization_id}` ? <Loader2 className="size-3 animate-spin" /> : "Sync Limits"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => { setApproveModal(null); setApproveNote(""); }}>
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-black">Approve Request</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {REQUEST_TYPE_LABELS[approveModal.request_type as SubscriptionRequestType]} request
              {approveModal.requested_package_name ? ` for ${approveModal.requested_package_name}` : ""}
            </p>
            {approveModal.reason && (
              <p className="mt-3 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
                <strong>Reason:</strong> {approveModal.reason}
              </p>
            )}
            <textarea
              className="mt-4 h-24 w-full rounded-md border border-border bg-background p-3 text-sm"
              placeholder="Admin note (optional)"
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
            />
            <div className="mt-4 flex gap-3">
              <Button onClick={handleApprove} variant="primary" className="flex-1" disabled={actionLoading === approveModal.id}>
                {actionLoading === approveModal.id ? <Loader2 className="size-4 animate-spin" /> : null}
                Approve
              </Button>
              <Button onClick={() => { setApproveModal(null); setApproveNote(""); }} variant="secondary" className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => { setRejectModal(null); setRejectReason(""); }}>
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-black">Reject Request</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {REQUEST_TYPE_LABELS[rejectModal.request_type as SubscriptionRequestType]} request
              {rejectModal.requested_package_name ? ` for ${rejectModal.requested_package_name}` : ""}
            </p>
            <textarea
              className="mt-4 h-24 w-full rounded-md border border-border bg-background p-3 text-sm"
              placeholder="Rejection reason (required)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="mt-4 flex gap-3">
              <Button onClick={handleReject} variant="destructive" className="flex-1" disabled={actionLoading === rejectModal.id || !rejectReason.trim()}>
                {actionLoading === rejectModal.id ? <Loader2 className="size-4 animate-spin" /> : null}
                Reject
              </Button>
              <Button onClick={() => { setRejectModal(null); setRejectReason(""); }} variant="secondary" className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => setDetailModal(null)}>
          <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">Request Details</h2>
              <button onClick={() => setDetailModal(null)} className="rounded-md p-2 text-muted-foreground hover:bg-surface-muted" type="button" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <Row label="Type" value={REQUEST_TYPE_LABELS[detailModal.request_type as SubscriptionRequestType] ?? detailModal.request_type} />
              <Row label="Status" value={REQUEST_STATUS_LABELS[detailModal.status as SubscriptionRequestStatus] ?? detailModal.status} />
              <Row label="Requested At" value={new Date(detailModal.requested_at).toLocaleString("en-IN")} />
              {detailModal.under_review_at && <Row label="Under Review At" value={new Date(detailModal.under_review_at).toLocaleString("en-IN")} />}
              {detailModal.approved_at && <Row label="Approved At" value={new Date(detailModal.approved_at).toLocaleString("en-IN")} />}
              {detailModal.rejected_at && <Row label="Rejected At" value={new Date(detailModal.rejected_at).toLocaleString("en-IN")} />}
              {detailModal.current_package_name && <Row label="Current Package" value={detailModal.current_package_name} />}
              {detailModal.requested_package_name && <Row label="Requested Package" value={detailModal.requested_package_name} />}
              {detailModal.requested_billing_period && <Row label="Billing Period" value={detailModal.requested_billing_period} />}
              {detailModal.requested_price != null && <Row label="Price" value={`₹${(detailModal.requested_price / 100).toFixed(2)}`} />}
              {detailModal.reason && <Row label="Reason" value={detailModal.reason} />}
              {detailModal.organization_note && <Row label="Organization Note" value={detailModal.organization_note} />}
              {detailModal.admin_note && <Row label="Admin Note" value={detailModal.admin_note} />}
              {detailModal.rejection_reason && <Row label="Rejection Reason" value={detailModal.rejection_reason} />}
              {detailModal.payment_proof_url && (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-muted-foreground">Payment Proof:</span>
                  <a href={detailModal.payment_proof_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary underline">
                    <FileText className="size-3" /> View
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="min-w-32 font-semibold text-muted-foreground">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

function RefreshCw({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );
}
