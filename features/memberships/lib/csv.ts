import { formatMoney } from "./business-rules";

type ReportRow = {
  membership: {
    id: string;
    status: string;
    start_date: string;
    end_date: string;
    payment_status: string;
    total_amount: number | null;
  };
  member: {
    member_code: string;
    full_name: string;
    email: string | null;
    phone: string;
  } | null;
  plan: {
    name: string;
    plan_type: string;
  } | null;
};

export function membershipRowsToCsv(rows: ReportRow[]) {
  const headers = [
    "Member Code",
    "Member Name",
    "Email",
    "Phone",
    "Plan",
    "Plan Type",
    "Membership Status",
    "Start Date",
    "Expiry Date",
    "Payment Status",
    "Total Amount"
  ];

  const body = rows.map((row) => [
    row.member?.member_code ?? "",
    row.member?.full_name ?? "",
    row.member?.email ?? "",
    row.member?.phone ?? "",
    row.plan?.name ?? "",
    row.plan?.plan_type ?? "",
    row.membership.status,
    row.membership.start_date,
    row.membership.end_date,
    row.membership.payment_status,
    formatMoney(row.membership.total_amount ?? 0)
  ]);

  return [headers, ...body].map((line) => line.map(escapeCsvValue).join(",")).join("\n");
}

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
