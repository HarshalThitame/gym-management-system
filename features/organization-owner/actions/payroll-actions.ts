"use server";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrgFeatureAccess } from "@/features/entitlement";

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
  await requireOrgFeatureAccess(organizationId, "payroll_export");

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

export async function exportPayrollCSV(
  organizationId: string,
  month: string,
  year: string
): Promise<string> {
  await requireOrgFeatureAccess(organizationId, "payroll_export");

  const result = await getMonthlyPayroll(organizationId, month, year);

  const header = "Trainer Name,Base Salary (₹),Commissions (₹),Deductions (₹),Net Payable (₹),Commission Count";
  const rows = result.records.map((r) =>
    [
      `"${r.trainerName}"`,
      r.baseSalary,
      r.totalCommissions,
      r.deductions,
      r.netPayable,
      r.commissionCount,
    ].join(",")
  );

  const lines = [header, ...rows];

  if (lines.length === 1) {
    lines.push('"No payroll data for this month",0,0,0,0,0');
  }

  lines.push("");
  lines.push(`"Total Payroll",,,,${result.summary.totalPayroll},`);
  lines.push(`"Total Trainers",,,,${result.summary.totalTrainers},`);
  lines.push(`"Average per Trainer",,,,${result.summary.avgPerTrainer},`);

  return lines.join("\n");
}

export async function exportPayrollPDF(
  organizationId: string,
  month: string,
  year: string
): Promise<Uint8Array> {
  await requireOrgFeatureAccess(organizationId, "payroll_export");

  const result = await getMonthlyPayroll(organizationId, month, year);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const dark = rgb(0.067, 0.071, 0.078);
  const muted = rgb(0.37, 0.39, 0.43);
  const accent = rgb(0.07, 0.47, 0.85);
  let y = 780;

  const monthLabel = new Date(Number(year), Number(month) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  page.drawText("Payroll Report", { x: 48, y, size: 22, font: bold, color: dark });
  page.drawText(monthLabel, { x: 48, y: y - 20, size: 11, font: regular, color: muted });
  y -= 60;

  page.drawText(`Total Payroll: ₹${result.summary.totalPayroll.toLocaleString("en-IN")}`, { x: 48, y, size: 11, font: bold, color: accent });
  page.drawText(`Trainers: ${result.summary.totalTrainers}`, { x: 300, y, size: 11, font: regular, color: dark });
  y -= 20;
  page.drawText(`Avg per Trainer: ₹${result.summary.avgPerTrainer.toLocaleString("en-IN")}`, { x: 48, y, size: 11, font: regular, color: dark });
  y -= 40;

  page.drawRectangle({ x: 48, y: y - 6, width: 499, height: 22, color: rgb(0.94, 0.95, 0.92) });
  page.drawText("Trainer Name", { x: 56, y, size: 9, font: bold, color: dark });
  page.drawText("Base Salary", { x: 240, y, size: 9, font: bold, color: dark });
  page.drawText("Commissions", { x: 320, y, size: 9, font: bold, color: dark });
  page.drawText("Net Payable", { x: 430, y, size: 9, font: bold, color: dark });
  y -= 28;

  for (const record of result.records) {
    if (y < 100) {
      y = 780;
      const newPage = pdf.addPage([595, 842]);
      page.drawRectangle({ x: 48, y: y - 6, width: 499, height: 22, color: rgb(0.94, 0.95, 0.92) });
    }
    page.drawText(record.trainerName.slice(0, 28), { x: 56, y, size: 9, font: regular, color: dark });
    page.drawText(`₹${record.baseSalary.toLocaleString("en-IN")}`, { x: 240, y, size: 9, font: regular, color: dark });
    page.drawText(`₹${record.totalCommissions.toLocaleString("en-IN")}`, { x: 320, y, size: 9, font: regular, color: dark });
    page.drawText(`₹${record.netPayable.toLocaleString("en-IN")}`, { x: 430, y, size: 9, font: bold, color: dark });
    y -= 18;
  }

  page.drawText("Generated by Gym Management Platform", { x: 48, y: 60, size: 9, font: regular, color: muted });
  page.drawText(`Report period: ${monthLabel}`, { x: 48, y: 45, size: 8, font: regular, color: muted });

  return pdf.save();
}
