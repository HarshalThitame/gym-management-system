"use client";

import { useState } from "react";
import { Trash2, Edit, UserPlus, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { bulkDeleteAction, bulkUpdateAction, bulkAssignAction } from "../actions/bulk-operations-actions";

type BulkActionBarProps = {
  selectedIds: string[];
  entityType: string;
  onClearSelection: () => void;
  onOperationComplete?: () => void;
  availableActions?: ("delete" | "update" | "assign")[];
  updateFields?: Record<string, any>;
  assignOptions?: { label: string; value: string }[];
};

export function BulkActionBar({
  selectedIds,
  entityType,
  onClearSelection,
  onOperationComplete,
  availableActions = ["delete", "update", "assign"],
  updateFields,
  assignOptions
}: BulkActionBarProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState("");

  if (selectedIds.length === 0) return null;

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setIsProcessing(true);
    try {
      await bulkDeleteAction({ entityType, entityIds: selectedIds });
      onClearSelection();
      onOperationComplete?.();
    } catch (error) {
      console.error("Bulk delete failed:", error);
    } finally {
      setIsProcessing(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleUpdate = async () => {
    if (!updateFields) return;
    
    setIsProcessing(true);
    try {
      await bulkUpdateAction({ entityType, entityIds: selectedIds, updates: updateFields });
      onClearSelection();
      onOperationComplete?.();
      setShowUpdateDialog(false);
    } catch (error) {
      console.error("Bulk update failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedAssignee) return;

    setIsProcessing(true);
    try {
      await bulkAssignAction({ entityType, entityIds: selectedIds, assignTo: selectedAssignee });
      onClearSelection();
      onOperationComplete?.();
      setShowAssignDialog(false);
      setSelectedAssignee("");
    } catch (error) {
      console.error("Bulk assign failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const entityLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-premium-lg animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="flex items-center gap-2">
          <Badge variant="accent" className="px-2.5 py-0.5">
            {selectedIds.length}
          </Badge>
          <span className="text-sm font-medium">
            {entityLabel}{selectedIds.length !== 1 ? "s" : ""} selected
          </span>
        </div>

        <div className="h-5 w-px bg-border" />

        <div className="flex items-center gap-1.5">
          {availableActions.includes("assign") && assignOptions && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAssignDialog(true)}
              disabled={isProcessing}
              className="gap-1.5"
            >
              <UserPlus className="size-3.5" />
              Assign
            </Button>
          )}

          {availableActions.includes("update") && updateFields && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUpdateDialog(true)}
              disabled={isProcessing}
              className="gap-1.5"
            >
              <Edit className="size-3.5" />
              Update
            </Button>
          )}

          {availableActions.includes("delete") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isProcessing}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              {showDeleteConfirm ? "Confirm Delete" : "Delete"}
            </Button>
          )}
        </div>

        <div className="h-5 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onClearSelection();
            setShowDeleteConfirm(false);
          }}
          disabled={isProcessing}
          className="gap-1.5"
        >
          <X className="size-3.5" />
          Cancel
        </Button>

        {isProcessing && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Assign Dialog */}
      {showAssignDialog && assignOptions && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-premium-lg">
            <h3 className="text-lg font-bold">Assign to</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Assign {selectedIds.length} {entityLabel.toLowerCase()}{selectedIds.length !== 1 ? "s" : ""} to a team member
            </p>

            <div className="mt-4 space-y-2">
              {assignOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setSelectedAssignee(option.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    selectedAssignee === option.value
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border hover:bg-surface-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAssignDialog(false);
                  setSelectedAssignee("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssign}
                disabled={!selectedAssignee || isProcessing}
              >
                {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                <span className="ml-1.5">Assign</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Update Dialog */}
      {showUpdateDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-premium-lg">
            <h3 className="text-lg font-bold">Bulk Update</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Update {selectedIds.length} {entityLabel.toLowerCase()}{selectedIds.length !== 1 ? "s" : ""}
            </p>

            <div className="mt-4 rounded-lg bg-surface-muted p-3">
              <p className="text-xs font-medium text-muted-foreground">Changes to apply:</p>
              <pre className="mt-1 text-xs">
                {JSON.stringify(updateFields, null, 2)}
              </pre>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowUpdateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                <span className="ml-1.5">Apply</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-premium-lg">
            <h3 className="text-lg font-bold text-destructive">Confirm Delete</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete {selectedIds.length} {entityLabel.toLowerCase()}{selectedIds.length !== 1 ? "s" : ""}? 
              This action cannot be undone.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                <span className="ml-1.5">Delete</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
