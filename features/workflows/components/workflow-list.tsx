"use client";

import { useState } from "react";
import { Play, Pause, Trash2, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkflowRow } from "../services/workflows-service";
import { toggleWorkflowAction, deleteWorkflowAction } from "../actions/workflows-actions";

type Props = {
  workflows: WorkflowRow[];
};

export function WorkflowList({ workflows }: Props) {
  const [items, setItems] = useState(workflows);

  const handleToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active" as "active" | "inactive";
    await toggleWorkflowAction(id, newStatus);
    setItems((prev) => prev.map((w) => (w.id === id ? { ...w, status: newStatus } : w)));
  };

  const handleDelete = async (id: string) => {
    await deleteWorkflowAction(id);
    setItems((prev) => prev.filter((w) => w.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{items.length} workflow{items.length !== 1 ? "s" : ""}</p>
        <Button size="sm" variant="accent">
          <Plus className="size-4 mr-1" /> New Workflow
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No workflows yet. Create your first workflow to automate tasks.</p>
      ) : (
        <div className="space-y-2">
          {items.map((workflow) => (
            <div key={workflow.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{workflow.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    workflow.status === "active" ? "bg-green-500/10 text-green-600" :
                    workflow.status === "inactive" ? "bg-gray-500/10 text-gray-500" :
                    workflow.status === "draft" ? "bg-yellow-500/10 text-yellow-600" :
                    "bg-red-500/10 text-red-600"
                  }`}>
                    {workflow.status}
                  </span>
                </div>
                {workflow.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{workflow.description}</p>
                )}
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  <span>Trigger: {workflow.trigger_type}</span>
                  {workflow.steps && Array.isArray(workflow.steps) && (
                    <span>{workflow.steps.length} step{workflow.steps.length !== 1 ? "s" : ""}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleToggle(workflow.id, workflow.status)}>
                  {workflow.status === "active" ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>
                <Button variant="ghost" size="sm">
                  <Settings className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(workflow.id)}>
                  <Trash2 className="size-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
