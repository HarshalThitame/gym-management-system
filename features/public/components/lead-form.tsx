"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { LeadSchema, type LeadInput } from "@/features/public/schemas/lead";

type LeadFormProps = {
  type: LeadInput["type"];
  compact?: boolean;
  defaultInterest?: string;
};

type ApiResponse =
  | { ok: true; message: string; data: { stored: boolean } }
  | { ok: false; error: { message: string; fieldErrors?: Partial<Record<keyof LeadInput, string[]>> } };

export function LeadForm({ type, compact = false, defaultInterest }: LeadFormProps) {
  const [status, setStatus] = useState<{ kind: "idle" | "success" | "error"; message?: string }>({ kind: "idle" });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<LeadInput>({
    resolver: zodResolver(LeadSchema),
    defaultValues: {
      type,
      interest: defaultInterest ?? "",
      consent: true,
      message: type === "free_trial" ? "I would like to book a free trial and understand the right membership for my goal." : ""
    }
  });

  async function onSubmit(values: LeadInput) {
    setStatus({ kind: "idle" });
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const result = (await response.json()) as ApiResponse;

    if (!result.ok) {
      setStatus({ kind: "error", message: result.error.message });
      return;
    }

    setStatus({ kind: "success", message: result.message });
    reset({
      type,
      interest: defaultInterest ?? "",
      consent: true,
      message: type === "free_trial" ? "I would like to book a free trial and understand the right membership for my goal." : ""
    });
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <input type="hidden" {...register("type")} />
      <FieldError message={errors.type?.message} />
      <div className={compact ? "grid gap-4" : "grid gap-4 md:grid-cols-2"}>
        <Field label="Full name" error={errors.name?.message}>
          <Input autoComplete="name" {...register("name")} />
        </Field>
        <Field label="Phone number" error={errors.phone?.message}>
          <Input autoComplete="tel" inputMode="tel" {...register("phone")} />
        </Field>
      </div>
      <div className={compact ? "grid gap-4" : "grid gap-4 md:grid-cols-2"}>
        <Field label="Email address" error={errors.email?.message}>
          <Input autoComplete="email" inputMode="email" {...register("email")} />
        </Field>
        <Field label={type === "free_trial" ? "Preferred trial date" : "Main interest"} error={type === "free_trial" ? errors.preferredDate?.message : errors.interest?.message}>
          {type === "free_trial" ? <Input min={new Date().toISOString().slice(0, 10)} type="date" {...register("preferredDate")} /> : <Input {...register("interest")} />}
        </Field>
      </div>
      {type === "free_trial" ? (
        <Field label="Main fitness goal" error={errors.interest?.message}>
          <Input {...register("interest")} />
        </Field>
      ) : null}
      <Field label="Message" error={errors.message?.message}>
        <Textarea {...register("message")} />
      </Field>
      <label className="flex gap-3 text-sm leading-6 text-muted-foreground">
        <input className="mt-1 size-4 rounded border-border accent-ink" type="checkbox" {...register("consent")} />
        <span>I agree to be contacted by Apex Performance Club about this request.</span>
      </label>
      <FieldError message={errors.consent?.message} />
      <Button disabled={isSubmitting} type="submit" variant="accent">
        {isSubmitting ? <Loader2 aria-hidden="true" className="animate-spin" size={18} /> : null}
        {isSubmitting ? "Sending" : type === "free_trial" ? "Reserve Trial" : "Send Request"}
      </Button>
      {status.kind === "success" ? (
        <p className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-800">
          <CheckCircle2 className="mt-0.5 shrink-0" size={16} /> {status.message}
        </p>
      ) : null}
      {status.kind === "error" ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">{status.message}</p> : null}
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-foreground">{label}</span>
      {children}
      <FieldError message={error} />
    </label>
  );
}

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <span className="text-sm font-semibold text-destructive">{message}</span>;
}
