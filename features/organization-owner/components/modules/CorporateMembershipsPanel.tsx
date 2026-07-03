"use client";

import { useCallback, useEffect, useMemo, useState, useActionState, useRef } from "react";
import { AlertTriangle, ArrowLeft, Banknote, Building2, CheckCircle2, Edit3, Plus, Search, Trash2, Unlink, UserRoundPlus, UsersRound, XCircle } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OrgOwnerDrawer, DrawerField, DrawerSubmitButton, DrawerFormMessage } from "@/features/organization-owner/components/org-owner-drawer";
import { Button } from "@/components/ui/button";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { showToast } from "@/components/ui/toast";
import { formatCurrency, formatCompactNumber } from "@/features/enterprise/lib/business-rules";
import {
  getCorporateAccounts,
  getCorporateAccount,
  createCorporateAccountAction,
  updateCorporateAccountAction,
  deleteCorporateAccountAction,
  bulkAddCorporateEmployeesAction,
  unlinkCorporateEmployeeAction,
  type CorporateAccountWithEmployees,
} from "@/features/organization-owner/actions/corporate-actions";
import { GenericConfirmDialog } from "@/features/organization-owner/components/modules/GenericConfirmDialog";
import { GenericSuccessDialog } from "@/features/organization-owner/components/modules/GenericSuccessDialog";
import type { Database } from "@/types/database";

type CorporateRow = CorporateAccountWithEmployees;
type MemberRow = Database["public"]["Tables"]["members"]["Row"];

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

type CorporateMembershipsPanelProps = {
  dashboard: OrganizationOwnerDashboard;
  hasFeature: boolean;
};

type PreviewEntry = {
  index: number;
  fullName: string;
  phone: string;
  email: string;
  valid: boolean;
  error: string;
};

export function CorporateMembershipsPanel({ dashboard, hasFeature }: CorporateMembershipsPanelProps) {
  // ── View state ──
  const [view, setView] = useState<"list" | "detail">("list");
  const [selectedAccount, setSelectedAccount] = useState<CorporateRow | null>(null);
  const [employees, setEmployees] = useState<MemberRow[]>([]);
  const [employeeMemberships, setEmployeeMemberships] = useState<Map<string, { planName: string; status: string }>>(new Map());
  const [companyRevenue, setCompanyRevenue] = useState(0);

  // ── Data state ──
  const [accounts, setAccounts] = useState<CorporateRow[]>([]);
  const [summary, setSummary] = useState<{ totalCompanies: number; totalEmployees: number; totalRevenue: number }>({ totalCompanies: 0, totalEmployees: 0, totalRevenue: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Drawer state ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CorporateRow | null>(null);
  const [createState, createFormAction] = useActionState(createCorporateAccountAction, initialAuthActionState);
  const [updateState, updateFormAction] = useActionState(updateCorporateAccountAction, initialAuthActionState);

  // ── Bulk add state ──
  const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [bulkGymId, setBulkGymId] = useState("");
  const [bulkPlanId, setBulkPlanId] = useState("");
  const [bulkErrors, setBulkErrors] = useState<{ index: number; message: string }[]>([]);
  const [bulkState, bulkFormAction] = useActionState(bulkAddCorporateEmployeesAction, initialAuthActionState);
  const [pendingDelete, setPendingDelete] = useState<{ accountId: string; name: string } | null>(null);
  const [successAction, setSuccessAction] = useState<{ action: "created" | "updated" | "deleted"; title: string; itemName: string } | null>(null);
  const lastSavedCompanyName = useRef("");

  // ── Preview: parse and validate bulk input locally ──
  const previewEntries = useMemo((): PreviewEntry[] => {
    if (!bulkInput.trim()) return [];
    const lines = bulkInput.split("\n").filter((l) => l.trim());
    return lines.map((line, i) => {
      const parts = line.split(",").map((p) => p.trim());
      const fullName = parts[0] ?? "";
      const phone = parts[1] ?? "";
      const email = parts[2] ?? "";
      const errs: string[] = [];
      if (!fullName || fullName.length < 2) errs.push("Invalid name");
      if (!phone || phone.length < 8) errs.push("Invalid phone");
      return {
        index: i,
        fullName,
        phone,
        email,
        valid: errs.length === 0,
        error: errs.join("; "),
      };
    });
  }, [bulkInput]);

  const previewValidCount = previewEntries.filter((e) => e.valid).length;
  const previewInvalidCount = previewEntries.length - previewValidCount;

  // ── Load accounts ──
  const loadAccounts = useCallback(async () => {
    if (!hasFeature) return;
    setLoading(true);
    try {
      const result = await getCorporateAccounts(dashboard.organization.id, { q: search || "", page: 1, pageSize: 50 });
      setAccounts(result.accounts);
      setSummary(result.summary);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [dashboard.organization.id, search, hasFeature]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // ── Load account detail (with memberships and revenue) ──
  const loadDetail = useCallback(async (account: CorporateRow) => {
    setSelectedAccount(account);
    setView("detail");
    setCompanyRevenue(0);
    setEmployeeMemberships(new Map());
    try {
      const result = await getCorporateAccount(dashboard.organization.id, account.id);
      const emps = (result.employees ?? []) as MemberRow[];
      setEmployees(emps);
      setSelectedAccount(result as CorporateRow);

      // Compute employee memberships and revenue from dashboard data
      const membershipMap = new Map<string, { planName: string; status: string }>();
      let revenue = 0;
      for (const emp of emps) {
        const activeMs = dashboard.memberships.find(
          (m) => m.member_id === emp.id && m.status === "active"
        );
        if (activeMs) {
          const plan = dashboard.membershipPlans.find((p) => p.id === activeMs.membership_plan_id);
          membershipMap.set(emp.id, {
            planName: plan?.name ?? "Unknown plan",
            status: activeMs.status,
          });
          revenue += Number(activeMs.price_amount ?? 0) + Number(activeMs.joining_fee_amount ?? 0) - Number(activeMs.discount_amount ?? 0);
        }
      }
      setEmployeeMemberships(membershipMap);
      setCompanyRevenue(revenue);
    } catch {
      // ignore
    }
  }, [dashboard.organization.id, dashboard.memberships, dashboard.membershipPlans]);

  // ── Handlers ──
  const openCreate = useCallback(() => { setEditingAccount(null); setDrawerOpen(true); }, []);
  const openEdit = useCallback((a: CorporateRow) => { setEditingAccount(a); setDrawerOpen(true); }, []);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); setEditingAccount(null); }, []);
  const closeBulkDrawer = useCallback(() => { setBulkDrawerOpen(false); setBulkInput(""); setBulkGymId(""); setBulkPlanId(""); setBulkErrors([]); }, []);
  const backToList = useCallback(() => { setView("list"); setSelectedAccount(null); setEmployees([]); }, []);

  const handleDelete = useCallback((accountId: string, name: string) => {
    setPendingDelete({ accountId, name });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const fd = new FormData();
    fd.set("accountId", pendingDelete.accountId);
    try {
      const result = await deleteCorporateAccountAction(initialAuthActionState, fd);
      if (result.status === "success") {
        setSuccessAction({ action: "deleted", title: "Company Deleted!", itemName: pendingDelete.name });
        loadAccounts();
        if (view === "detail") backToList();
      } else {
        showToast(result.message || "Failed to delete.", "error");
      }
    } catch {
      showToast("Failed to delete.", "error");
    }
    setPendingDelete(null);
  }, [pendingDelete, loadAccounts, view, backToList, setSuccessAction]);

  const handleUnlink = useCallback(async (memberId: string) => {
    const fd = new FormData();
    fd.set("memberId", memberId);
    try {
      const result = await unlinkCorporateEmployeeAction(initialAuthActionState, fd);
      showToast(result.message || "Unlinked.", result.status === "success" ? "success" : "error");
      if (result.status === "success" && selectedAccount) {
        loadDetail(selectedAccount);
      }
    } catch {
      showToast("Failed to unlink.", "error");
    }
  }, [selectedAccount, loadDetail]);

  // ── Watch form action results ──
  useEffect(() => {
    if (createState.status === "success") { closeDrawer(); loadAccounts(); setSuccessAction({ action: "created", title: "Company Created!", itemName: lastSavedCompanyName.current || "Corporate Account" }); }
    if (createState.status === "error" && createState.message) showToast(createState.message, "error");
  }, [createState, closeDrawer, loadAccounts, setSuccessAction]);

  useEffect(() => {
    if (updateState.status === "success") { closeDrawer(); loadAccounts(); setSuccessAction({ action: "updated", title: "Company Updated!", itemName: lastSavedCompanyName.current || "Corporate Account" }); }
    if (updateState.status === "error" && updateState.message) showToast(updateState.message, "error");
  }, [updateState, closeDrawer, loadAccounts, setSuccessAction]);

  useEffect(() => {
    if (bulkState.status === "success" || bulkState.status === "error") {
      if (bulkState.message) showToast(bulkState.message, bulkState.status === "success" ? "success" : "error");
      if (bulkState.status === "success") {
        closeBulkDrawer();
        if (selectedAccount) loadDetail(selectedAccount);
      }
    }
  }, [bulkState, closeBulkDrawer, selectedAccount, loadDetail]);

  // ── Filter membership plans by selected gym for bulk drawer ──
  const filteredPlans = useMemo(() => {
    if (!bulkGymId) return dashboard.membershipPlans.filter((p) => p.status === "active");
    return dashboard.membershipPlans.filter(
      (p) => p.status === "active" && (!p.gym_id || p.gym_id === bulkGymId)
    );
  }, [dashboard.membershipPlans, bulkGymId]);

  // ── Plan breakdown for detail view ──
  const planBreakdown = useMemo(() => {
    if (!selectedAccount) return [];
    const planCounts = new Map<string, number>();
    for (const [, info] of employeeMemberships) {
      if (info.planName) {
        planCounts.set(info.planName, (planCounts.get(info.planName) ?? 0) + 1);
      }
    }
    return Array.from(planCounts.entries()).sort((a, b) => b[1] - a[1]);
  }, [employeeMemberships, selectedAccount]);

  if (!hasFeature) {
    return (
      <div className="rounded-lg border border-border bg-surface p-12 text-center">
        <p className="text-sm text-muted-foreground">Corporate memberships are not included in your current plan. Upgrade to Enterprise to unlock this feature.</p>
      </div>
    );
  }

  // ── Company List View ──
  if (view === "list") {
    return (
      <div className="space-y-6">
        {/* Summary cards */}
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard detail="Active companies in your organization" icon={<Building2 className="size-5" />} label="Companies" value={String(summary.totalCompanies)} />
          <StatCard detail="Employees linked to corporate accounts" icon={<UsersRound className="size-5" />} label="Corporate Employees" value={formatCompactNumber(summary.totalEmployees)} />
          <StatCard detail="Revenue from corporate memberships" icon={<Banknote className="size-5" />} label="Corporate Revenue" value={formatCurrency(summary.totalRevenue)} />
        </section>

        {/* Search + Add */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-11 w-full rounded-md border border-border bg-surface pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Search companies by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={openCreate} size="sm" variant="primary">
            <Plus className="size-4" /> Add Company
          </Button>
        </div>

        {/* Company table */}
        <div className="rounded-lg border border-border bg-surface">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">Loading companies...</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Building2 className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No corporate accounts yet.</p>
              <Button onClick={openCreate} size="sm" variant="secondary">
                <Plus className="size-4" /> Add your first company
              </Button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Company</th>
                  <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Contact</th>
                  <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Employees</th>
                  <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Discount</th>
                  <th className="px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acct) => (
                  <tr
                    key={acct.id}
                    className="border-b border-border/50 transition-colors hover:bg-surface-muted cursor-pointer"
                    onClick={() => loadDetail(acct)}
                  >
                    <td className="px-5 py-3">
                      <p className="text-sm font-bold">{acct.company_name}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-sm">{acct.contact_person ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{acct.contact_email ?? acct.contact_phone ?? ""}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-bold text-accent">
                        <UsersRound className="size-3" /> {acct.employee_count ?? 0}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm font-bold">{Number(acct.discount_percentage)}%</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${acct.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {acct.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={() => openEdit(acct)} title="Edit" type="button">
                          <Edit3 className="size-3.5" />
                        </button>
                        <button className="rounded-md p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700" onClick={() => handleDelete(acct.id, acct.company_name)} title="Delete" type="button">
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Create/Edit Drawer */}
        <OrgOwnerDrawer
          description={editingAccount ? `Editing ${editingAccount.company_name}` : "Add a corporate partner"}
          onClose={closeDrawer}
          open={drawerOpen}
          title={editingAccount ? "Edit Company" : "Add Company"}
          size="lg"
        >
          <form action={editingAccount ? updateFormAction : createFormAction} className="space-y-5" onSubmit={() => {
            const input = document.querySelector<HTMLInputElement>('input[name="companyName"]');
            if (input) lastSavedCompanyName.current = input.value;
          }}>
            <DrawerFormMessage status={editingAccount ? updateState.status : createState.status} message={editingAccount ? updateState.message : createState.message} />
            {editingAccount ? <input name="accountId" type="hidden" value={editingAccount.id} /> : null}
            <div className="grid gap-5 md:grid-cols-2">
              <DrawerField label="Company Name" required>
                <input className={selectClass} defaultValue={editingAccount?.company_name ?? ""} name="companyName" required type="text" />
              </DrawerField>
              <DrawerField label="Contact Person">
                <input className={selectClass} defaultValue={editingAccount?.contact_person ?? ""} name="contactPerson" type="text" />
              </DrawerField>
              <DrawerField label="Contact Email">
                <input className={selectClass} defaultValue={editingAccount?.contact_email ?? ""} name="contactEmail" type="email" />
              </DrawerField>
              <DrawerField label="Contact Phone">
                <input className={selectClass} defaultValue={editingAccount?.contact_phone ?? ""} name="contactPhone" type="text" />
              </DrawerField>
              <DrawerField label="Billing Email">
                <input className={selectClass} defaultValue={editingAccount?.billing_email ?? ""} name="billingEmail" type="email" />
              </DrawerField>
              <DrawerField label="Discount Percentage (0-100)">
                <input className={selectClass} defaultValue={editingAccount ? String(editingAccount.discount_percentage) : "0"} max="100" min="0" name="discountPercentage" type="number" />
              </DrawerField>
            </div>
            <DrawerField label="Address">
              <input className={selectClass} defaultValue={editingAccount?.address ?? ""} name="address" type="text" />
            </DrawerField>
            <DrawerField label="Notes">
              <textarea className={selectClass} defaultValue={editingAccount?.notes ?? ""} name="notes" rows={3} />
            </DrawerField>
            <div className="flex justify-end gap-3 border-t border-border pt-6">
              <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeDrawer} type="button">Cancel</button>
              <DrawerSubmitButton>{editingAccount ? "Update" : "Add Company"}</DrawerSubmitButton>
            </div>
          </form>
        </OrgOwnerDrawer>
        <GenericConfirmDialog
          open={!!pendingDelete}
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
          title="Delete Corporate Account?"
          itemName={pendingDelete?.name ?? ""}
          warning="Employees will be unlinked but not deleted."
        />
        <GenericSuccessDialog
          action={successAction?.action ?? "created"}
          itemName={successAction?.itemName ?? ""}
          onClose={() => setSuccessAction(null)}
          open={successAction !== null}
          title={successAction?.title ?? ""}
        />
      </div>
    );
  }

  // ── Company Detail View ──
  if (!selectedAccount) return null;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground" onClick={backToList} type="button">
        <ArrowLeft className="size-4" /> Back to companies
      </button>

      {/* Company info card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black">{selectedAccount.company_name}</h2>
              <p className="text-sm text-muted-foreground">{selectedAccount.contact_person ? `Contact: ${selectedAccount.contact_person}` : "No contact person"} · {employees.length} employees</p>
            </div>
            <Button onClick={() => openEdit(selectedAccount)} size="sm" variant="secondary">
              <Edit3 className="size-4" /> Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Discount</p><p className="text-sm font-bold">{Number(selectedAccount.discount_percentage)}%</p></div>
            <div><p className="text-xs text-muted-foreground">Billing Email</p><p className="text-sm font-bold">{selectedAccount.billing_email ?? "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Contact Phone</p><p className="text-sm font-bold">{selectedAccount.contact_phone ?? "—"}</p></div>
            <div className="md:col-span-3"><p className="text-xs text-muted-foreground">Address</p><p className="text-sm font-bold">{selectedAccount.address ?? "—"}</p></div>
            {selectedAccount.notes ? (
              <div className="md:col-span-3"><p className="text-xs text-muted-foreground">Notes</p><p className="text-sm">{selectedAccount.notes}</p></div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Revenue Summary + Plan Breakdown */}
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader><h3 className="text-lg font-black">Revenue Summary</h3></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Corporate Revenue</span>
                <span className="text-lg font-black">{formatCurrency(companyRevenue)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Employees</span>
                <span className="text-sm font-bold">{employees.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">With Active Membership</span>
                <span className="text-sm font-bold">{Array.from(employeeMemberships.values()).filter((m) => m.status === "active").length}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h3 className="text-lg font-black">Plan Breakdown</h3></CardHeader>
          <CardContent>
            {planBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active membership plans.</p>
            ) : (
              <div className="space-y-2">
                {planBreakdown.map(([planName, count]) => (
                  <div key={planName} className="flex items-center justify-between rounded-md border border-border bg-background p-2 px-3">
                    <span className="text-sm font-bold">{planName}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground">
                      <UsersRound className="size-3" /> {count} employee{count !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Employee list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black">Employees ({employees.length})</h3>
            <Button onClick={() => { setBulkDrawerOpen(true); setBulkGymId(""); setBulkPlanId(""); setBulkInput(""); setBulkErrors([]); }} size="sm" variant="primary">
              <UserRoundPlus className="size-4" /> Add Employees
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <UsersRound className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No employees linked to this company yet.</p>
              <Button onClick={() => { setBulkDrawerOpen(true); setBulkGymId(""); setBulkPlanId(""); setBulkInput(""); setBulkErrors([]); }} size="sm" variant="secondary">
                <UserRoundPlus className="size-4" /> Add employees
              </Button>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Name</th>
                  <th className="px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Phone</th>
                  <th className="px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Email</th>
                  <th className="px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Membership</th>
                  <th className="px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Status</th>
                  <th className="px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Joined</th>
                  <th className="px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Branch</th>
                  <th className="px-4 py-2 text-right text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const gym = dashboard.gyms.find((g) => g.id === emp.gym_id);
                  const membership = employeeMemberships.get(emp.id);
                  return (
                    <tr key={emp.id} className="border-b border-border/50 transition-colors hover:bg-surface-muted">
                      <td className="px-4 py-2.5">
                        <p className="text-sm font-bold">{emp.full_name}</p>
                        <p className="text-xs text-muted-foreground">{emp.member_code}</p>
                      </td>
                      <td className="px-4 py-2.5 text-sm">{emp.phone}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{emp.email ?? "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{membership?.planName ?? "No plan"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${emp.status === "active" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">
                        {emp.joined_at ? new Date(emp.joined_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{gym?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleUnlink(emp.id)}
                          title="Unlink from corporate"
                          type="button"
                        >
                          <Unlink className="size-3" /> Unlink
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Bulk Add Drawer with Preview */}
      <OrgOwnerDrawer
        description={`Add employees to ${selectedAccount.company_name} in bulk`}
        onClose={closeBulkDrawer}
        open={bulkDrawerOpen}
        title="Bulk Add Employees"
        size="lg"
      >
        <form action={bulkFormAction} className="space-y-5">
          <DrawerFormMessage status={bulkState.status} message={bulkState.message} />
          <input name="accountId" type="hidden" value={selectedAccount.id} />
          <div className="grid gap-5 md:grid-cols-2">
            <DrawerField label="Gym" required>
              <select className={selectClass} name="gymId" required value={bulkGymId} onChange={(e) => { setBulkGymId(e.target.value); setBulkPlanId(""); }}>
                <option value="">Select gym</option>
                {dashboard.gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </DrawerField>
            <DrawerField label="Membership Plan (optional)">
              <select className={selectClass} name="membershipPlanId" value={bulkPlanId} onChange={(e) => setBulkPlanId(e.target.value)}>
                <option value="">No membership plan</option>
                {filteredPlans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({formatCurrency(Number(p.price_amount))})</option>
                ))}
              </select>
            </DrawerField>
          </div>
          <DrawerField label={`Employees (one per line: "Full Name, Phone, Email")`} required>
            <textarea
              className={selectClass}
              name="bulkInput"
              rows={8}
              placeholder={`John Doe, 9876543210, john@example.com\nJane Smith, 9876543211, jane@example.com\n...`}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              required
            />
          </DrawerField>

          {/* ── Preview Section ── */}
          {previewEntries.length > 0 ? (
            <div className="rounded-lg border border-border bg-surface-muted/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">
                  Preview ({previewEntries.length} lines)
                </p>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="size-3.5" /> {previewValidCount} valid
                  </span>
                  {previewInvalidCount > 0 ? (
                    <span className="flex items-center gap-1 text-red-500">
                      <XCircle className="size-3.5" /> {previewInvalidCount} errors
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {previewEntries.map((entry) => (
                  <div
                    key={entry.index}
                    className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                      entry.valid ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {entry.valid ? (
                      <CheckCircle2 className="size-3 shrink-0" />
                    ) : (
                      <AlertTriangle className="size-3 shrink-0" />
                    )}
                    <span className="font-bold">{entry.index + 1}.</span>
                    <span>{entry.fullName || "(empty)"}</span>
                    {entry.phone ? <span className="text-muted-foreground">· {entry.phone}</span> : null}
                    {entry.email ? <span className="text-muted-foreground">· {entry.email}</span> : null}
                    {!entry.valid ? <span className="font-bold ml-auto">{entry.error}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* ── Inline Bulk Errors (post-submit) ── */}
          {bulkErrors.length > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-red-700 mb-2">Errors ({bulkErrors.length})</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {bulkErrors.map((err, i) => (
                  <p key={i} className="text-xs text-red-700">
                    <span className="font-bold">Line {err.index + 1}:</span> {err.message}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Discount of {Number(selectedAccount.discount_percentage)}% will be applied to membership pricing.
          </p>
          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button className="rounded-md border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground transition-all hover:border-border-strong" onClick={closeBulkDrawer} type="button">Cancel</button>
            <DrawerSubmitButton>Add All</DrawerSubmitButton>
          </div>
        </form>
      </OrgOwnerDrawer>
    </div>
  );
}
