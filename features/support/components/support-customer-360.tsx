"use client";

import { useState } from "react";
import { CalendarDays, Dumbbell, BookOpen, Smartphone, Award, TrendingDown } from "lucide-react";
import type { SupportTicketRow, SupportCustomerHealthScoreRow } from "@/types/enterprise";

function HealthScoreGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? "text-green-600" : score >= 50 ? "text-amber-600" : "text-red-600";
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{score.toFixed(0)}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium truncate ml-2">{value ?? "—"}</span>
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

type CustomerHealthData = {
  health: SupportCustomerHealthScoreRow | null;
  tickets: SupportTicketRow[];
  membership: Record<string, unknown> | null;
  attendance: Array<Record<string, unknown>>;
  attendanceRate: number;
  bookings: Array<Record<string, unknown>>;
  rewardPoints: number;
  lastLoginAt: string | null;
  loginCount: number;
  openTickets: number;
  lifetimeValue: number;
  churnProbability: number;
  satisfactionScore: number;
  healthScore: number;
  complaintFrequency: number;
};

export function SupportCustomer360({
  customerId,
  customerName,
  customerEmail,
  health,
}: {
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  health: CustomerHealthData;
}) {
  const [tab, setTab] = useState<string>("summary");
  const tickets = health.tickets ?? [];
  const recentTickets = tickets.slice(0, 10);

  const tabs = [
    { key: "summary", label: "Summary" },
    { key: "activity", label: "Activity" },
    { key: "financial", label: "Financial" },
    { key: "risk", label: "Risk" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Customer</p>
        <p className="text-sm font-bold truncate">{customerName}</p>
        <p className="text-xs text-muted-foreground truncate">{customerEmail}</p>
        <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
          <span className="font-mono">ID: {customerId.slice(0, 8)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <TabButton key={t.key} active={tab === t.key} label={t.label} onClick={() => setTab(t.key)} />
        ))}
      </div>

      {tab === "summary" && (
        <>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Health Scores</p>
            <div className="grid grid-cols-4 gap-3">
              <HealthScoreGauge score={health.healthScore} label="Health" />
              <HealthScoreGauge score={health.satisfactionScore} label="Satisfaction" />
              <HealthScoreGauge score={Math.max(0, 100 - health.churnProbability)} label="Retention" />
              <HealthScoreGauge score={Math.max(0, 100 - Math.min(100, health.complaintFrequency * 10))} label="Sentiment" />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick Stats</p>
            <InfoRow label="Lifetime Value" value={`₹${(health.lifetimeValue / 100).toLocaleString("en-IN")}`} />
            <InfoRow label="Churn Probability" value={`${health.churnProbability.toFixed(1)}%`} />
            <InfoRow label="Open Tickets" value={health.openTickets} />
            <InfoRow label="Attendance Rate" value={`${health.attendanceRate}%`} />
            <InfoRow label="Reward Points" value={health.rewardPoints.toLocaleString()} />
          </div>

          {recentTickets.length > 0 && (
            <div className="rounded-lg border border-border bg-card">
              <div className="px-4 py-2 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Tickets ({tickets.length})</p>
              </div>
              <div className="divide-y divide-border max-h-[240px] overflow-y-auto">
                {recentTickets.map((t) => (
                  <div key={t.id} className="px-4 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground">{t.ticket_number}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        ["resolved", "closed"].includes(t.status) ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {t.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5 truncate">{t.subject}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(t.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === "activity" && (
        <>
          {health.membership && (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Dumbbell className="h-3 w-3" /> Membership
              </p>
              <InfoRow label="Plan" value={(health.membership.membership_plans as Record<string, unknown>)?.name as string ?? "—"} />
              <InfoRow label="Status" value={health.membership.status as string} />
              <InfoRow label="Joined" value={health.membership.start_date ? new Date(health.membership.start_date as string).toLocaleDateString() : "—"} />
              <InfoRow label="Expires" value={health.membership.end_date ? new Date(health.membership.end_date as string).toLocaleDateString() : "—"} />
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3" /> Attendance (Last 30 Days)
            </p>
            <InfoRow label="Visits" value={health.attendance.length} />
            <InfoRow label="Rate" value={`${health.attendanceRate}%`} />
            <div className="mt-2 flex flex-wrap gap-1">
              {health.attendance.slice(0, 14).map((a, i) => (
                <div
                  key={i}
                  className="w-5 h-5 rounded-sm bg-green-200 border border-green-300"
                  title={a.check_in_at ? new Date(a.check_in_at as string).toLocaleDateString() : ""}
                />
              ))}
            </div>
          </div>

          {health.bookings.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <BookOpen className="h-3 w-3" /> Upcoming Bookings
              </p>
              {health.bookings.map((b, i) => {
                const session = b.class_sessions as Record<string, unknown> | null;
                return (
                  <div key={i} className="flex items-center justify-between py-1 text-xs">
                    <span className="truncate">{session?.name as string ?? "Class"}</span>
                    <span className="text-muted-foreground shrink-0 ml-2">
                      {session?.starts_at ? new Date(session.starts_at as string).toLocaleDateString() : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <Smartphone className="h-3 w-3" /> App Usage
            </p>
            <InfoRow label="Last Login" value={health.lastLoginAt ? new Date(health.lastLoginAt).toLocaleDateString() : "—"} />
            <InfoRow label="Total Logins" value={health.loginCount} />
          </div>

          {health.rewardPoints > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Award className="h-3 w-3" /> Rewards
              </p>
              <InfoRow label="Points Balance" value={health.rewardPoints.toLocaleString()} />
            </div>
          )}
        </>
      )}

      {tab === "financial" && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Financial Overview</p>
          <InfoRow label="Lifetime Value" value={`₹${(health.lifetimeValue / 100).toLocaleString("en-IN")}`} />
          <InfoRow label="Churn Probability" value={`${health.churnProbability.toFixed(1)}%`} />
          <InfoRow label="Open Tickets" value={health.openTickets} />
          <InfoRow label="Total Complaints" value={health.complaintFrequency} />
        </div>
      )}

      {tab === "risk" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              <TrendingDown className="h-3 w-3 text-red-500" /> Risk Indicators
            </p>
            <InfoRow label="Churn Probability" value={
              <span className={`font-bold ${health.churnProbability > 50 ? "text-red-600" : health.churnProbability > 25 ? "text-amber-600" : "text-green-600"}`}>
                {health.churnProbability.toFixed(1)}%
              </span>
            } />
            <InfoRow label="Satisfaction Score" value={
              <span className={`font-bold ${health.satisfactionScore >= 80 ? "text-green-600" : health.satisfactionScore >= 50 ? "text-amber-600" : "text-red-600"}`}>
                {health.satisfactionScore.toFixed(1)}
              </span>
            } />
            <InfoRow label="Complaint Frequency" value={health.complaintFrequency} />
            <InfoRow label="Attendance Rate" value={
              <span className={`font-bold ${health.attendanceRate >= 70 ? "text-green-600" : health.attendanceRate >= 40 ? "text-amber-600" : "text-red-600"}`}>
                {health.attendanceRate}%
              </span>
            } />
            <InfoRow label="Open Support Tickets" value={health.openTickets} />
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Health Score Breakdown</p>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[10px] mb-0.5"><span>Resolution Rate</span><span>25%</span></div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-green-500" style={{ width: "25%" }} /></div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-0.5"><span>SLA Compliance</span><span>20%</span></div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: "20%" }} /></div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-0.5"><span>Attendance</span><span>20%</span></div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-amber-500" style={{ width: `${health.attendanceRate * 0.2}%` }} /></div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-0.5"><span>Payment Health</span><span>15%</span></div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-purple-500" style={{ width: "15%" }} /></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
