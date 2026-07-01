"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import type { EquipmentRow } from "../services/equipment-service";
import { saveEquipmentAction, deleteEquipmentAction } from "../actions/equipment-actions";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

function Field({ name, label, state, children }: { name: string; label: string; state: { fieldErrors?: Record<string, string[]> }; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold" htmlFor={name}>{label}</label>
      {children}
      <FieldError message={state.fieldErrors?.[name]?.[0]} />
    </div>
  );
}

function HiddenInput({ name, value }: { name: string; value: string }) {
  return <input name={name} suppressHydrationWarning type="hidden" value={value} />;
}

export function EquipmentForm({ equipment }: { equipment?: EquipmentRow | null }) {
  const [state, formAction] = useActionState(saveEquipmentAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <HiddenInput name="equipmentId" value={equipment?.id ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="name" label="Equipment Name" state={state}>
          <Input id="name" name="name" defaultValue={equipment?.name ?? ""} required />
        </Field>
        <Field name="equipmentType" label="Equipment Type" state={state}>
          <Input id="equipmentType" name="equipmentType" defaultValue={equipment?.equipment_type ?? ""} required placeholder="e.g., Cardio, Strength, Free Weights" />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="brand" label="Brand" state={state}>
          <Input id="brand" name="brand" defaultValue={equipment?.brand ?? ""} />
        </Field>
        <Field name="model" label="Model" state={state}>
          <Input id="model" name="model" defaultValue={equipment?.model ?? ""} />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="serialNumber" label="Serial Number" state={state}>
          <Input id="serialNumber" name="serialNumber" defaultValue={equipment?.serial_number ?? ""} />
        </Field>
        <Field name="location" label="Location" state={state}>
          <Input id="location" name="location" defaultValue={equipment?.location ?? ""} placeholder="e.g., Main Floor, Zone A" />
        </Field>
      </div>
      <Field name="status" label="Status" state={state}>
        <select id="status" name="status" className={selectClass} defaultValue={equipment?.status ?? "active"}>
          <option value="active">Active</option>
          <option value="maintenance">Under Maintenance</option>
          <option value="retired">Retired</option>
        </select>
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="purchaseDate" label="Purchase Date" state={state}>
          <Input id="purchaseDate" name="purchaseDate" type="date" defaultValue={equipment?.purchase_date ?? ""} />
        </Field>
        <Field name="purchasePrice" label="Purchase Price" state={state}>
          <Input id="purchasePrice" name="purchasePrice" type="number" step="0.01" defaultValue={equipment?.purchase_price ? String(equipment.purchase_price / 100) : ""} />
        </Field>
      </div>
      <Field name="warrantyExpiry" label="Warranty Expiry" state={state}>
        <Input id="warrantyExpiry" name="warrantyExpiry" type="date" defaultValue={equipment?.warranty_expiry ?? ""} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="amcProvider" label="AMC Provider" state={state}>
          <Input id="amcProvider" name="amcProvider" defaultValue={equipment?.amc_provider ?? ""} />
        </Field>
        <Field name="amcExpiry" label="AMC Expiry" state={state}>
          <Input id="amcExpiry" name="amcExpiry" type="date" defaultValue={equipment?.amc_expiry ?? ""} />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field name="serviceIntervalDays" label="Service Interval (Days)" state={state}>
          <Input id="serviceIntervalDays" name="serviceIntervalDays" type="number" defaultValue={equipment?.service_interval_days ? String(equipment.service_interval_days) : ""} />
        </Field>
        <Field name="lastServiceDate" label="Last Service Date" state={state}>
          <Input id="lastServiceDate" name="lastServiceDate" type="date" defaultValue={equipment?.last_service_date ?? ""} />
        </Field>
        <Field name="nextServiceDate" label="Next Service Date" state={state}>
          <Input id="nextServiceDate" name="nextServiceDate" type="date" defaultValue={equipment?.next_service_date ?? ""} />
        </Field>
      </div>
      <Field name="notes" label="Notes" state={state}>
        <Textarea id="notes" name="notes" defaultValue={equipment?.notes ?? ""} rows={3} />
      </Field>
      <AuthSubmitButton>{equipment ? "Update Equipment" : "Add Equipment"}</AuthSubmitButton>
    </form>
  );
}

export function EquipmentDeleteForm({ equipmentId }: { equipmentId: string }) {
  const [state, formAction] = useActionState(deleteEquipmentAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <HiddenInput name="equipmentId" value={equipmentId} />
      <p className="text-sm font-semibold text-destructive">This will permanently delete the equipment record.</p>
      <AuthSubmitButton>Delete Equipment</AuthSubmitButton>
    </form>
  );
}
