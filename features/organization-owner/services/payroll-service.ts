import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PayrollRecord = {
  trainerId: string;
  trainerName: string;
  baseSalary: number;
  totalCommissions: number;
  deductions: number;
  netPayable: number;
  commissionCount: number;
};

export type PayrollResult = {
  records: PayrollRecord[];
  month: string;
  year: string;
  summary: {
    totalPayroll: number;
    totalTrainers: number;
    avgPerTrainer: number;
  };
};

export async function getMonthlyPayroll(
  organizationId: string,
  month: string,
  year: string
): Promise<PayrollResult> {
  const supabase = await createSupabaseServerClient();
  const paddedMonth = month.padStart(2, "0");
  const startDate = `${year}-${paddedMonth}-01`;
  const endDate = `${year}-${paddedMonth}-31`;

  const { data: gyms } = await supabase
    .from("gyms")
    .select("id")
    .eq("organization_id", organizationId);

  const gymIds = (gyms ?? []).map((g: { id: string }) => g.id);
  if (gymIds.length === 0) {
    return { records: [], month, year, summary: { totalPayroll: 0, totalTrainers: 0, avgPerTrainer: 0 } };
  }

  const { data: commissions } = await supabase
    .from("trainer_commissions")
    .select("trainer_id, amount, status")
    .eq("organization_id", organizationId)
    .gte("calculated_at", startDate)
    .lte("calculated_at", endDate)
    .eq("status", "paid");

  const { data: trainers } = await supabase
    .from("trainers")
    .select("id, display_name, base_salary")
    .in("gym_id", gymIds);

  const commissionByTrainer = new Map<string, { total: number; count: number }>();
  for (const c of commissions ?? []) {
    const existing = commissionByTrainer.get(c.trainer_id) ?? { total: 0, count: 0 };
    existing.total += c.amount;
    existing.count += 1;
    commissionByTrainer.set(c.trainer_id, existing);
  }

  const records: PayrollRecord[] = (trainers ?? []).map((t) => {
    const comm = commissionByTrainer.get(t.id) ?? { total: 0, count: 0 };
    return {
      trainerId: t.id,
      trainerName: t.display_name,
      baseSalary: t.base_salary ?? 0,
      totalCommissions: comm.total,
      deductions: 0,
      netPayable: (t.base_salary ?? 0) + comm.total,
      commissionCount: comm.count,
    };
  });

  records.sort((a, b) => b.netPayable - a.netPayable);

  const totalPayroll = records.reduce((s, r) => s + r.netPayable, 0);
  const totalTrainers = records.filter((r) => r.netPayable > 0).length;

  return {
    records,
    month,
    year,
    summary: {
      totalPayroll,
      totalTrainers,
      avgPerTrainer: totalTrainers > 0 ? Math.round(totalPayroll / totalTrainers) : 0,
    },
  };
}
