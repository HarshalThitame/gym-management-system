export function computeSlaRemainingMinutes(createdAt: string, slaMinutes: number, slaBreached?: boolean): {
  remainingMinutes: number;
  percent: number;
  status: "good" | "warning" | "breached";
  label: string;
} {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const elapsed = (now - created) / 60000;
  const remaining = Math.max(0, slaMinutes - elapsed);
  const percent = Math.min(100, Math.round((elapsed / slaMinutes) * 100));

  let status: "good" | "warning" | "breached" = "good";
  if (slaBreached) status = "breached";
  else if (percent >= 80) status = "warning";

  let label: string;
  if (status === "breached") {
    label = `OVERDUE by ${Math.round(Math.abs(remaining))}h`;
  } else if (remaining >= 60) {
    const hours = Math.floor(remaining / 60);
    const mins = Math.round(remaining % 60);
    label = `${hours}h ${mins}m remaining`;
  } else {
    label = `${Math.round(remaining)}m remaining`;
  }

  return { remainingMinutes: remaining, percent, status, label };
}
