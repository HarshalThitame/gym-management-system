"use client";

import { useCallback, useEffect, useState, useActionState, useRef } from "react";
import { Check, Edit3, Percent, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import type { CommissionRateRow } from "@/features/organization-owner/actions/commission-actions";
import { setCommissionRate, setDefaultCommissionRate, getDefaultCommissionRates } from "@/features/organization-owner/actions/commission-actions";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { showToast } from "@/components/ui/toast";

type Props = {
  organizationId: string;
  trainers: Array<{ id: string; display_name: string }>;
};

const sourceTypes = ["pt_session", "class", "membership_sale"] as const;

const selectClass = "h-10 w-24 rounded-md border border-border bg-surface px-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function CommissionRatesPanel({ organizationId, trainers }: Props) {
  const [rates, setRates] = useState<CommissionRateRow[]>([]);
  const [defaultRates, setDefaultRates] = useState<CommissionRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [, formAction] = useActionState(setCommissionRate, initialAuthActionState);
  const formRef = useRef<HTMLFormElement>(null);

  const fetchRates = useCallback(async () => {
    try {
      const { getCommissionRates, getDefaultCommissionRates: getDefaults } = await import("@/features/organization-owner/actions/commission-actions");
      const [ratesResult, defaultsResult] = await Promise.all([
        getCommissionRates(organizationId),
        getDefaults(organizationId),
      ]);
      setRates(ratesResult);
      setDefaultRates(defaultsResult);
    } catch {
      setRates([]);
      setDefaultRates([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const getRateForTrainer = (trainerId: string, sourceType: string) => {
    return rates.find((r) => r.trainer_id === trainerId && r.source_type === sourceType);
  };

  const handleSetRate = async (trainerId: string, sourceType: string, rate: number) => {
    const fd = new FormData();
    fd.append("trainerId", trainerId);
    fd.append("sourceType", sourceType);
    fd.append("rate", String(rate));
    const { setCommissionRate: setRate } = await import("@/features/organization-owner/actions/commission-actions");
    const result = await setRate(initialAuthActionState, fd);
    if (result.status === "success") {
      showToast("Rate updated.", "success");
      fetchRates();
    } else {
      showToast(result.message ?? "Failed to update rate.", "error");
    }
  };

  const handleSetDefaultRate = async (sourceType: string, rate: number) => {
    const fd = new FormData();
    fd.append("sourceType", sourceType);
    fd.append("rate", String(rate));
    const result = await setDefaultCommissionRate(initialAuthActionState, fd);
    if (result.status === "success") {
      showToast("Default rate updated.", "success");
      fetchRates();
    } else {
      showToast(result.message ?? "Failed to update default rate.", "error");
    }
  };

  const getDefaultRate = (sourceType: string) => {
    return defaultRates.find((r) => r.source_type === sourceType)?.rate ?? 0;
  };

  return (
    <div className="space-y-6">
      {/* ═══ DEFAULT RATES ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="size-5" />
            <h3 className="text-lg font-black">Default Commission Rates</h3>
          </div>
          <p className="text-sm text-muted-foreground">Org-wide defaults applied when no trainer-specific rate is set. Rate of 0 means no commission.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            {sourceTypes.map((st) => (
              <div key={st} className="flex flex-col items-center gap-2 rounded-lg border border-border p-4">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{formatEnterpriseLabel(st)}</span>
                <DefaultRateCell
                  sourceType={st}
                  currentRate={getDefaultRate(st)}
                  onSave={handleSetDefaultRate}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-black">Per-Trainer Rates</h3>
          <p className="text-sm text-muted-foreground">Override default rates for individual trainers. Set to 0 to use org-wide defaults.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading rates...</div>
          ) : trainers.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No trainers found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2.5 font-bold text-muted-foreground">Trainer</th>
                    <th className="px-3 py-2.5 text-center font-bold text-muted-foreground">PT Session Rate</th>
                    <th className="px-3 py-2.5 text-center font-bold text-muted-foreground">Class Rate</th>
                    <th className="px-3 py-2.5 text-center font-bold text-muted-foreground">Membership Sale Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {trainers.map((trainer) => (
                    <tr key={trainer.id} className="border-b border-border hover:bg-surface-muted/50">
                      <td className="px-3 py-3 font-medium">{trainer.display_name}</td>
                      {sourceTypes.map((st) => {
                        const rate = getRateForTrainer(trainer.id, st);
                        return (
                          <td key={st} className="px-3 py-3 text-center">
                            <RateCell
                              trainerId={trainer.id}
                              sourceType={st}
                              currentRate={rate?.rate ?? 0}
                              onSave={handleSetRate}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <form ref={formRef} action={formAction} className="hidden">
        <input name="trainerId" type="hidden" />
        <input name="sourceType" type="hidden" />
        <input name="rate" type="hidden" />
      </form>
    </div>
  );
}

function RateCell({
  trainerId,
  sourceType,
  currentRate,
  onSave,
}: {
  trainerId: string;
  sourceType: string;
  currentRate: number;
  onSave: (trainerId: string, sourceType: string, rate: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentRate);

  const handleSave = () => {
    onSave(trainerId, sourceType, value);
    setEditing(false);
  };

  const handleCancel = () => {
    setValue(currentRate);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center justify-center gap-1">
        <input
          type="number"
          className="h-9 w-20 rounded-md border border-border bg-background px-2 text-center text-sm"
          value={value}
          min={0}
          max={100}
          step={0.5}
          onChange={(e) => setValue(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
          autoFocus
        />
        <Button size="sm" variant="ghost" onClick={handleSave}><Check className="size-3.5" /></Button>
        <Button size="sm" variant="ghost" onClick={handleCancel}><X className="size-3.5" /></Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <span className={`text-sm font-bold ${currentRate > 0 ? "" : "text-muted-foreground"}`}>
        {currentRate}%
      </span>
      <Button size="sm" variant="ghost" onClick={() => { setValue(currentRate); setEditing(true); }}>
        <Edit3 className="size-3" />
      </Button>
    </div>
  );
}

function DefaultRateCell({
  sourceType,
  currentRate,
  onSave,
}: {
  sourceType: string;
  currentRate: number;
  onSave: (sourceType: string, rate: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentRate);

  const handleSave = () => {
    onSave(sourceType, value);
    setEditing(false);
  };

  const handleCancel = () => {
    setValue(currentRate);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center justify-center gap-1">
        <input
          type="number"
          className="h-10 w-24 rounded-md border border-border bg-background px-2 text-center text-base font-bold"
          value={value}
          min={0}
          max={100}
          step={0.5}
          onChange={(e) => setValue(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
          autoFocus
        />
        <Button size="sm" variant="ghost" onClick={handleSave}><Check className="size-4" /></Button>
        <Button size="sm" variant="ghost" onClick={handleCancel}><X className="size-4" /></Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`text-2xl font-black ${currentRate > 0 ? "text-foreground" : "text-muted-foreground"}`}>
        {currentRate}%
      </span>
      <Button size="sm" variant="ghost" onClick={() => { setValue(currentRate); setEditing(true); }}>
        <Edit3 className="size-3.5" />
      </Button>
    </div>
  );
}
