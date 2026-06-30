"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Edit3, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { showToast } from "@/components/ui/toast";
import { GenericSuccessDialog } from "@/features/organization-owner/components/modules/GenericSuccessDialog";
import type { CustomField } from "@/features/organization-owner/actions/member-field-actions";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

type CustomMemberFieldsPanelProps = {
  organizationId: string;
  hasFeature: boolean;
};

type FieldModalData = {
  open: boolean;
  editing: CustomField | null;
};

const initialModal: FieldModalData = { open: false, editing: null };

export function CustomMemberFieldsPanel({ organizationId, hasFeature }: CustomMemberFieldsPanelProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<FieldModalData>(initialModal);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [successAction, setSuccessAction] = useState<{ action: "created" | "updated" | "deleted"; title: string; itemName: string } | null>(null);

  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("text");
  const [formOptions, setFormOptions] = useState("");
  const [formRequired, setFormRequired] = useState(false);
  const [formSortOrder, setFormSortOrder] = useState(0);

  const loadFields = useCallback(async () => {
    setLoading(true);
    try {
      const { getCustomFields } = await import("@/features/organization-owner/actions/member-field-actions");
      const data = await getCustomFields(organizationId);
      setFields(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to load custom fields.", "error");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  const openCreate = () => {
    setFormName("");
    setFormType("text");
    setFormOptions("");
    setFormRequired(false);
    setFormSortOrder(fields.length);
    setModal({ open: true, editing: null });
  };

  const openEdit = (field: CustomField) => {
    setFormName(field.field_name);
    setFormType(field.field_type);
    setFormOptions(Array.isArray(field.options) ? field.options.join("\n") : "");
    setFormRequired(field.required);
    setFormSortOrder(field.sort_order);
    setModal({ open: true, editing: field });
  };

  const closeModal = () => setModal(initialModal);

  const handleSave = async () => {
    if (!formName.trim()) {
      showToast("Field name is required.", "error");
      return;
    }
    setSaving(true);
    try {
      const { createCustomField, updateCustomField } = await import("@/features/organization-owner/actions/member-field-actions");
      const options = formType === "select" ? formOptions.split("\n").map((o) => o.trim()).filter(Boolean) : undefined;

      const editData: Record<string, unknown> = {
        field_name: formName,
        field_type: formType,
        required: formRequired,
        sort_order: formSortOrder,
      };
      if (options) editData.options = options;

      if (modal.editing) {
        const result = await updateCustomField(organizationId, modal.editing.id, editData as { field_name?: string; field_type?: string; options?: string[] | null; required?: boolean; sort_order?: number });
        if (result.status === "error") {
          showToast(result.message, "error");
          return;
        }
        setSuccessAction({ action: "updated", title: "Field Updated!", itemName: modal.editing.field_name });
      } else {
        const result = await createCustomField(organizationId, editData as { field_name: string; field_type: string; options?: string[] | null; required?: boolean; sort_order?: number });
        if (result.status === "error") {
          showToast(result.message, "error");
          return;
        }
        setSuccessAction({ action: "created", title: "Field Created!", itemName: formName.trim() });
      }
      closeModal();
      loadFields();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to save field.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (fieldId: string) => {
    try {
      const { deleteCustomField } = await import("@/features/organization-owner/actions/member-field-actions");
      const result = await deleteCustomField(organizationId, fieldId);
      if (result.status === "error") {
        showToast(result.message, "error");
        return;
      }
      setSuccessAction({ action: "deleted", title: "Field Deleted!", itemName: fields.find((f) => f.id === fieldId)?.field_name ?? "Field" });
      setDeleteConfirm(null);
      loadFields();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to delete field.", "error");
    }
  };

  if (!hasFeature) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black">Custom Member Fields</h3>
            <p className="text-xs text-muted-foreground">Define additional fields to collect from members.</p>
          </div>
          <Button onClick={openCreate} size="sm" variant="primary"><Plus className="size-4" /> Add Field</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : fields.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No custom fields defined. Click &quot;Add Field&quot; to create one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-bold">Field Name</th>
                  <th className="py-2 pr-4 font-bold">Type</th>
                  <th className="py-2 pr-4 font-bold">Required</th>
                  <th className="py-2 pr-4 font-bold">Sort Order</th>
                  <th className="py-2 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field) => (
                  <tr key={field.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4 font-medium">{field.field_name}</td>
                    <td className="py-2 pr-4 capitalize">{field.field_type}</td>
                    <td className="py-2 pr-4">{field.required ? "Yes" : "No"}</td>
                    <td className="py-2 pr-4">{field.sort_order}</td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        <button className="flex size-8 items-center justify-center rounded hover:bg-surface-muted" onClick={() => openEdit(field)} aria-label={`Edit ${field.field_name}`}>
                          <Edit3 className="size-3.5" />
                        </button>
                        <button className="flex size-8 items-center justify-center rounded hover:bg-surface-muted text-red-500" onClick={() => setDeleteConfirm(field.id)} aria-label={`Delete ${field.field_name}`}>
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Field Modal */}
      {modal.open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={closeModal}>
          <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <h3 className="text-xl font-black">{modal.editing ? "Edit" : "Add"} Custom Field</h3>
              <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted" onClick={closeModal} type="button" aria-label="Close"><X className="size-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold">Field Name</label>
                <input className={selectClass} value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Medical Conditions" type="text" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold">Field Type</label>
                <select className={selectClass} value={formType} onChange={(e) => setFormType(e.target.value)}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="select">Select (Dropdown)</option>
                </select>
              </div>
              {formType === "select" ? (
                <div className="space-y-2">
                  <label className="text-sm font-bold">Options (one per line)</label>
                  <textarea className={selectClass + " min-h-[120px]"} value={formOptions} onChange={(e) => setFormOptions(e.target.value)} placeholder={"Option A\nOption B\nOption C"} rows={5} />
                </div>
              ) : null}
              <div className="space-y-2">
                <label className="text-sm font-bold">Sort Order</label>
                <input className={selectClass} value={formSortOrder} onChange={(e) => setFormSortOrder(Number(e.target.value))} type="number" min={0} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={formRequired} onChange={(e) => setFormRequired(e.target.checked)} className="size-4 rounded border-border" />
                Required field
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-border px-5 py-4">
              <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground" onClick={closeModal} type="button">Cancel</button>
              <button className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-sm disabled:opacity-50" onClick={handleSave} disabled={saving} type="button">
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {saving ? "Saving..." : modal.editing ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete Confirmation */}
      {deleteConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black">Delete Field?</h3>
            <p className="mt-2 text-sm text-muted-foreground">This will also remove all stored values for this field. This action cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-bold" onClick={() => setDeleteConfirm(null)} type="button">Cancel</button>
              <button className="rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white" onClick={() => handleDelete(deleteConfirm)} type="button">Delete</button>
            </div>
          </div>
        </div>
      ) : null}
      <GenericSuccessDialog
        action={successAction?.action ?? "created"}
        itemName={successAction?.itemName ?? ""}
        onClose={() => setSuccessAction(null)}
        open={successAction !== null}
        title={successAction?.title ?? ""}
      />
    </Card>
  );
}
