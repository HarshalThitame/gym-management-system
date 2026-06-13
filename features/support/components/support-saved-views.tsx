"use client";

import { useState } from "react";
import { Save, Trash2, ChevronDown } from "lucide-react";
import type { SavedView } from "../services/support-saved-views-service";

export function SupportSavedViews({
  views,
  activeViewId,
  onSelect,
  onSave,
  onDelete,
}: {
  views: SavedView[];
  activeViewId: string | undefined;
  onSelect: (view: SavedView) => void;
  onSave: (name: string) => void;
  onDelete: (viewId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [viewName, setViewName] = useState("");

  const activeView = views.find((v) => v.id === activeViewId);

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="h-8 px-2 rounded-md border border-border text-xs flex items-center gap-1 hover:bg-muted transition-colors"
        >
          {activeView?.name ?? "Saved Views"}
          <ChevronDown className="h-3 w-3" />
        </button>
        <button
          onClick={() => setShowSaveDialog(true)}
          className="h-8 w-8 flex items-center justify-center rounded-md border border-border hover:bg-muted transition-colors"
          title="Save current view"
        >
          <Save className="h-3.5 w-3.5" />
        </button>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-56 rounded-md border border-border bg-card shadow-lg z-20 overflow-hidden">
            {views.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No saved views</p>
            ) : (
              views.map((view) => (
                <div key={view.id} className="flex items-center px-3 py-2 hover:bg-muted transition-colors group">
                  <button
                    onClick={() => { onSelect(view); setIsOpen(false); }}
                    className="flex-1 text-left text-xs truncate"
                  >
                    {view.name}
                  </button>
                  <button
                    onClick={() => onDelete(view.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-600 transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSaveDialog(false)}>
          <div className="bg-card rounded-lg border border-border p-4 w-80 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold">Save Current View</p>
            <input
              type="text"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="View name..."
              className="w-full h-9 rounded-md border border-border bg-background text-sm px-3 mt-3"
              autoFocus
            />
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => { if (viewName.trim()) { onSave(viewName.trim()); setViewName(""); setShowSaveDialog(false); } }}
                className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium"
              >
                Save
              </button>
              <button onClick={() => setShowSaveDialog(false)} className="h-8 px-3 rounded-md border border-border text-xs">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
