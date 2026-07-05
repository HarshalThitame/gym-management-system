"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Cpu, Eye, Monitor, Plus, ShieldAlert, Trash2, Wifi, WifiOff,
} from "lucide-react";
import { DataList } from "@/features/organization-owner/components/org-owner-data-list";
import { FilterBar } from "@/features/organization-owner/components/org-owner-filter-bar";
import { useModuleFilters } from "@/features/organization-owner/lib/use-module-filters";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EnterpriseStatusBadge } from "@/features/enterprise/components/enterprise-status-badge";
import { formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import { exportToCSV } from "@/features/organization-owner/lib/toast-utils";
import {
  formatDeviceFreshness,
  getDeviceHealthSnapshot,
  getDeviceHealthSummary,
} from "@/features/organization-owner/lib/device-health";

type DeviceItem = Record<string, unknown>;

export function DeviceManagementPanel({ dashboard }: { dashboard: any }) {
  const members = (dashboard.members ?? []) as DeviceItem[];
  const branches = (dashboard.branches ?? []) as DeviceItem[];
  const { filters, navigate, currentPage } = useModuleFilters();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);
  const [eventLogs, setEventLogs] = useState<DeviceItem[]>([]);
  const [eventLogTotal, setEventLogTotal] = useState(0);
  const [eventPage, setEventPage] = useState(1);
  const [showRegisterDrawer, setShowRegisterDrawer] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [showDecommissionConfirm, setShowDecommissionConfirm] = useState<string | null>(null);
  const [deviceTypes, setDeviceTypes] = useState<DeviceItem[]>([]);
  const [apiKeyResult, setApiKeyResult] = useState<string | null>(null);

  const pageSize = filters.pageSize ?? 12;

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize),
      });
      if (filters.status) params.set("status", filters.status);
      if (filters.q) params.set("device_type_id", filters.q);

      const res = await fetch(`/api/attendance/devices?${params}`);
      const json = await res.json();
      if (json.ok) {
        setDevices(json.data ?? []);
        setTotal(json.meta?.total ?? 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, filters.status, filters.q]);

  const fetchDeviceTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/attendance/devices/types");
      const json = await res.json();
      if (json.ok) setDeviceTypes(json.data ?? []);
    } catch {
      // silent
    }
  }, []);

  const fetchEventLogs = useCallback(async (deviceId: string, page = 1) => {
    try {
      const res = await fetch(
        `/api/attendance/devices/${deviceId}/logs?page=${page}&limit=20`
      );
      const json = await res.json();
      if (json.ok) {
        setEventLogs(json.data ?? []);
        setEventLogTotal(json.meta?.total ?? 0);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);
  useEffect(() => { fetchDeviceTypes(); }, [fetchDeviceTypes]);

  const onlineCount = devices.filter((d) => d.status === "online").length;
  const errorCount = devices.filter((d) => d.status === "error").length;
  const activeCount = devices.filter((d) => d.is_active === true).length;
  const healthSummary = useMemo(() => getDeviceHealthSummary(devices), [devices]);
  const assignedCount = devices.filter((d) => Boolean(d.branch_id)).length;
  const issueDevices = useMemo(() => devices
    .map((device) => ({ device, health: getDeviceHealthSnapshot(device) }))
    .filter(({ device, health }) => health.level === "critical" || health.level === "stale" || device.status === "error" || device.is_active !== true)
    .slice(0, 5), [devices]);

  const items = useMemo(() => devices.map((d) => {
    const type = d.device_types as Record<string, unknown> | undefined;
    return {
      id: d.id as string,
      title: d.device_name as string,
      subtitle: type ? `${type.name as string} · ${type.manufacturer as string ?? ""}`.trim().replace(/·\s*$/, "") : undefined,
      meta: `${d.location as string ?? "—"} · ${new Date(d.last_seen_at as string ?? d.created_at as string).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
      badge: d.status as string,
      badgeVariant: (d.status === "online" ? "success" : d.status === "error" ? "error" : "warning") as "success" | "error" | "warning",
      status: d.status as string,
      sections: [
        { label: "Type", value: type?.name as string ?? "—" },
        { label: "Location", value: d.location as string ?? "—" },
        { label: "IP Address", value: d.ip_address as string ?? "—" },
        { label: "Last Seen", value: d.last_seen_at ? new Date(d.last_seen_at as string).toLocaleString("en-IN") : "Never" },
      ],
      actions: [
        {
          label: "Details", onClick: () => {
            setSelectedDevice(d);
            fetchEventLogs(d.id as string);
            setEventPage(1);
          }, variant: "secondary" as const, icon: <Eye className="size-3.5" />
        },
        {
          label: "Edit", onClick: () => {
            setSelectedDevice(d);
            setShowEditDrawer(true);
          }, variant: "secondary" as const, icon: <Monitor className="size-3.5" />
        },
      ],
    };
  }), [devices, fetchEventLogs]);

  const handleApply = useCallback((f: Record<string, string>) => {
    navigate({ q: f.q, status: f.status });
  }, [navigate]);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <section className="grid gap-4 md:grid-cols-5">
        <StatCard detail="Devices currently online" icon={<Wifi className="size-5" />} label="Online" status={onlineCount > 0 ? "good" : "watch"} value={String(onlineCount)} />
        <StatCard detail="Devices in error state" icon={<AlertTriangle className="size-5" />} label="Errors" status={errorCount > 0 ? "risk" : "good"} value={String(errorCount)} />
        <StatCard detail="Active registered devices" icon={<Cpu className="size-5" />} label="Active" value={String(activeCount)} />
        <StatCard detail="Total devices" icon={<Activity className="size-5" />} label="Total" value={String(devices.length)} />
        <StatCard detail="Stale or critical devices" icon={<ShieldAlert className="size-5" />} label="Health Alerts" status={healthSummary.stale + healthSummary.critical > 0 ? "risk" : "good"} value={String(healthSummary.stale + healthSummary.critical)} />
      </section>

      {/* Filters + Register button */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <FilterBar
            filterGroups={[
              {
                key: "status", label: "Status", options: [
                  { value: "online", label: "Online" },
                  { value: "offline", label: "Offline" },
                  { value: "error", label: "Error" },
                  { value: "decommissioned", label: "Decommissioned" },
                ],
              },
            ]}
            searchPlaceholder="Search by device type..."
            onApply={handleApply}
            activeFilters={filters as unknown as Record<string, string>}
          />
        </div>
        <button
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          onClick={() => { setApiKeyResult(null); setShowRegisterDrawer(true); }}
          type="button"
        >
          <Plus className="size-4" /> Register Device
        </button>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-2xl font-black">Operations Snapshot</h3>
          <p className="text-sm text-muted-foreground">Fleet readiness, branch coverage, and devices that need follow-up.</p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <LifecycleRow label="Branch assigned" value={`${assignedCount}/${devices.length}`} />
          <LifecycleRow label="Healthy" value={String(healthSummary.healthy)} />
          <LifecycleRow label="Needs review" value={String(healthSummary.watch + healthSummary.stale + healthSummary.critical)} />
          <LifecycleRow label="Offline / inactive" value={String(devices.filter((d) => d.status !== "online").length)} />
          <div className="md:col-span-4 space-y-2">
            {issueDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No immediate device issues.</p>
            ) : issueDevices.map(({ device, health }) => (
              <div key={device.id as string} className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm">
                <div>
                  <p className="font-bold">{device.device_name as string}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDeviceFreshness(health)} · {device.branch_id ? "Branch assigned" : "Unassigned"}
                  </p>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-red-600">
                  {health.label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Device List */}
      <DataList
        loading={loading}
        onExportCSV={() => exportToCSV(
          devices.map((d) => ({
            name: d.device_name,
            type: (d.device_types as any)?.name ?? "",
            status: d.status,
            location: d.location,
            ip: d.ip_address,
            lastSeen: d.last_seen_at,
          })),
          "devices"
        )}
        headerTitle="Attendance Devices"
        items={items}
        totalItems={total}
        totalPages={Math.ceil(total / pageSize)}
        currentPage={currentPage}
        onPageChange={(p) => navigate({ page: p })}
        pageSize={pageSize}
      />

      {/* Detail Drawer */}
      {selectedDevice && !showEditDrawer && (
        <DeviceDetailDrawer
          device={selectedDevice}
          branches={branches}
          members={members}
          eventLogs={eventLogs}
          eventLogTotal={eventLogTotal}
          eventPage={eventPage}
          onEventPageChange={(p) => { setEventPage(p); fetchEventLogs(selectedDevice.id as string, p); }}
          onClose={() => { setSelectedDevice(null); setEventLogs([]); }}
          onEdit={() => setShowEditDrawer(true)}
          onRefreshed={() => {
            fetchDevices();
            fetchEventLogs(selectedDevice.id as string, eventPage);
          }}
          onDecommission={(id) => setShowDecommissionConfirm(id)}
        />
      )}

      {/* Register Drawer */}
      {showRegisterDrawer && (
        <DeviceRegisterDrawer
          branches={branches}
          deviceTypes={deviceTypes}
          apiKeyResult={apiKeyResult}
          onApiKeyResult={setApiKeyResult}
          onClose={() => { setShowRegisterDrawer(false); setApiKeyResult(null); }}
          onRegistered={() => { fetchDevices(); }}
        />
      )}

      {/* Edit Drawer */}
      {showEditDrawer && selectedDevice && (
        <DeviceEditDrawer
          device={selectedDevice}
          branches={branches}
          onClose={() => { setShowEditDrawer(false); setSelectedDevice(null); }}
          onUpdated={() => { fetchDevices(); }}
        />
      )}

      {/* Decommission Confirm */}
      {showDecommissionConfirm && (
        <DecommissionConfirmDialog
          deviceId={showDecommissionConfirm}
          onClose={() => setShowDecommissionConfirm(null)}
          onDecommissioned={() => { fetchDevices(); setShowDecommissionConfirm(null); setSelectedDevice(null); }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DeviceDetailDrawer({
  device, branches, members, eventLogs, eventLogTotal, eventPage, onEventPageChange, onClose, onEdit, onRefreshed, onDecommission,
}: {
  device: DeviceItem; branches: DeviceItem[]; members: DeviceItem[]; eventLogs: DeviceItem[]; eventLogTotal: number; eventPage: number;
  onEventPageChange: (p: number) => void; onClose: () => void; onEdit: () => void; onRefreshed: () => void; onDecommission: (id: string) => void;
}) {
  const type = device.device_types as Record<string, unknown> | undefined;
  const totalPages = Math.ceil(eventLogTotal / 20);
  const health = getDeviceHealthSnapshot(device);
  const [mappings, setMappings] = useState<DeviceItem[]>([]);
  const [mappingsLoading, setMappingsLoading] = useState(false);
  const [mappingError, setMappingError] = useState("");
  const [mappingSubmitting, setMappingSubmitting] = useState(false);
  const [mappingMemberId, setMappingMemberId] = useState<string>(String(members[0]?.id ?? ""));
  const [mappingDeviceUserId, setMappingDeviceUserId] = useState("");
  const [mappingDeviceUserName, setMappingDeviceUserName] = useState("");
  const [pinging, setPinging] = useState(false);
  const [pingMessage, setPingMessage] = useState("");
  const branch = branches.find((item) => item.id === device.branch_id) as DeviceItem | undefined;

  useEffect(() => {
    if (!mappingMemberId && members.length > 0) {
      setMappingMemberId(String(members[0].id));
    }
  }, [mappingMemberId, members]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadMappings() {
      setMappingsLoading(true);
      setMappingError("");
      try {
        const response = await fetch(`/api/attendance/devices/${device.id}/mappings`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error?.message ?? "Failed to load mappings.");
        }
        if (active) {
          setMappings(json.data ?? []);
        }
      } catch (error) {
        if (controller.signal.aborted || !active) return;
        setMappingError(error instanceof Error ? error.message : "Failed to load mappings.");
      } finally {
        if (active) setMappingsLoading(false);
      }
    }

    void loadMappings();
    return () => {
      active = false;
      controller.abort();
    };
  }, [device.id]);

  const handleSaveMapping = async () => {
    if (!mappingMemberId || !mappingDeviceUserId.trim()) {
      setMappingError("Member and device user ID are required.");
      return;
    }

    setMappingSubmitting(true);
    setMappingError("");
    try {
      const response = await fetch(`/api/attendance/devices/${device.id}/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: mappingMemberId,
          deviceUserId: mappingDeviceUserId.trim(),
          deviceUserName: mappingDeviceUserName.trim() || undefined,
          isActive: true,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error?.message ?? "Failed to save mapping.");
      }
      setMappings((current) => {
        const next = current.filter((item) => item.id !== json.data.id);
        return [json.data, ...next];
      });
      setMappingDeviceUserId("");
      setMappingDeviceUserName("");
    } catch (error) {
      setMappingError(error instanceof Error ? error.message : "Failed to save mapping.");
    } finally {
      setMappingSubmitting(false);
    }
  };

  const handleDeactivateMapping = async (mappingId: string) => {
    setMappingSubmitting(true);
    setMappingError("");
    try {
      const response = await fetch(`/api/attendance/devices/${device.id}/mappings/${mappingId}`, {
        method: "DELETE",
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error?.message ?? "Failed to deactivate mapping.");
      }
      setMappings((current) => current.map((item) => (item.id === mappingId ? { ...item, is_active: false } : item)));
    } catch (error) {
      setMappingError(error instanceof Error ? error.message : "Failed to deactivate mapping.");
    } finally {
      setMappingSubmitting(false);
    }
  };

  const handlePing = async () => {
    setPinging(true);
    setPingMessage("");
    try {
      const response = await fetch(`/api/attendance/devices/${device.id}/ping`, { method: "POST" });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error?.message ?? "Failed to ping device.");
      }
      setPingMessage(`Heartbeat recorded at ${new Date(json?.data?.timestamp ?? Date.now()).toLocaleString("en-IN")}`);
      onRefreshed();
    } catch (error) {
      setPingMessage(error instanceof Error ? error.message : "Failed to ping device.");
    } finally {
      setPinging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Device details">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {device.status === "online" ? <Wifi className="size-4 text-green-600" /> : device.status === "error" ? <ShieldAlert className="size-4 text-red-600" /> : <WifiOff className="size-4 text-muted-foreground" />}
              <h2 className="text-xl font-black">{device.device_name as string}</h2>
              <EnterpriseStatusBadge status={device.status as string} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{type?.name as string ?? ""} {type?.manufacturer ? `· ${type.manufacturer}` : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={() => onEdit()} type="button" aria-label="Edit"><Monitor className="size-4" /></button>
            <button className="flex size-10 items-center justify-center rounded-md text-red-600 hover:bg-red-50" onClick={() => onDecommission(device.id as string)} type="button" aria-label="Decommission"><Trash2 className="size-4" /></button>
            <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close"><Activity className="size-5" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <Card>
            <CardHeader><h3 className="text-lg font-black">Device Info</h3></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">Name</p><p className="text-sm font-bold">{device.device_name as string}</p></div>
              <div><p className="text-xs text-muted-foreground">Status</p><EnterpriseStatusBadge status={device.status as string} /></div>
              <div><p className="text-xs text-muted-foreground">Type</p><p className="text-sm font-bold">{type?.name as string ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Active</p><p className="text-sm font-bold">{device.is_active ? "Yes" : "No"}</p></div>
              <div><p className="text-xs text-muted-foreground">Branch</p><p className="text-sm font-bold">{branch?.name as string ?? "Unassigned"}</p></div>
              <div><p className="text-xs text-muted-foreground">Location</p><p className="text-sm font-bold">{device.location as string ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">IP Address</p><p className="text-sm font-bold">{device.ip_address as string ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Serial Number</p><p className="text-sm font-bold">{device.serial_number as string ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Last Seen</p><p className="text-sm font-bold">{device.last_seen_at ? new Date(device.last_seen_at as string).toLocaleString("en-IN") : "Never"}</p></div>
              <div><p className="text-xs text-muted-foreground">Freshness</p><p className="text-sm font-bold">{formatDeviceFreshness(health)}</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-lg font-black">Provisioning Lifecycle</h3></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 text-sm">
                <LifecycleRow label="Registered" value={device.id ? "Yes" : "No"} />
                <LifecycleRow label="Branch assigned" value={branch?.name ? branch.name : "Not assigned"} />
                <LifecycleRow label="Heartbeat" value={device.last_seen_at ? new Date(device.last_seen_at as string).toLocaleString("en-IN") : "No heartbeat yet"} />
                <LifecycleRow label="API key" value={device.is_active ? "Active" : "Revoked / inactive"} />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm font-bold hover:bg-surface disabled:opacity-50"
                  disabled={pinging}
                  onClick={() => void handlePing()}
                  type="button"
                >
                  {pinging ? "Pinging..." : "Ping now"}
                </button>
                <button
                  className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm font-bold hover:bg-surface"
                  onClick={onEdit}
                  type="button"
                >
                  Assign branch / rotate key
                </button>
              </div>
              {pingMessage ? <p className="text-xs text-muted-foreground">{pingMessage}</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-lg font-black">Health Monitor</h3><p className="text-sm text-muted-foreground">Freshness and alert thresholds derived from last heartbeat and event history.</p></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 text-sm">
                <LifecycleRow label="Health state" value={health.label} />
                <LifecycleRow label="Stale threshold" value="30m" />
                <LifecycleRow label="Critical threshold" value="2h" />
                <LifecycleRow label="Freshness" value={formatDeviceFreshness(health)} />
              </div>
              <div className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs text-muted-foreground">
                Health status is computed locally from device heartbeat data. Ping failures, offline states, and devices older than 30 minutes surface as alerts in this panel.
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><h3 className="text-lg font-black">Event Logs ({eventLogTotal})</h3></CardHeader>
            <CardContent className="space-y-2">
              {eventLogs.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <>
                  {eventLogs.map((log) => (
                    <div key={log.id as string} className="flex items-center justify-between rounded-lg border border-border bg-surface-muted px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${log.event_type === "ping" ? "bg-green-500" : log.event_type === "error" ? "bg-red-500" : "bg-amber-500"}`} />
                        <span className="text-xs font-bold uppercase tracking-wider">{formatEnterpriseLabel(log.event_type as string)}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(log.occurred_at as string).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  ))}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <button className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={eventPage <= 1} onClick={() => onEventPageChange(eventPage - 1)} type="button">Previous</button>
                      <span className="text-xs text-muted-foreground">Page {eventPage} of {totalPages}</span>
                      <button className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={eventPage >= totalPages} onClick={() => onEventPageChange(eventPage + 1)} type="button">Next</button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h3 className="text-lg font-black">RFID / NFC mappings</h3>
              <p className="text-sm text-muted-foreground">Bind a device-specific card UID to a member. The check-in API resolves this mapping on kiosk devices.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Member</span>
                  <select
                    className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm"
                    value={mappingMemberId}
                    onChange={(event) => setMappingMemberId(event.target.value)}
                  >
                    {members.length === 0 ? <option value="">No members available</option> : null}
                    {members.map((member) => (
                      <option key={member.id as string} value={member.id as string}>
                        {member.full_name as string} {member.member_code ? `· ${member.member_code as string}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Device User ID</span>
                  <input
                    className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm"
                    placeholder="RFID UID / NFC serial / biometric ID"
                    value={mappingDeviceUserId}
                    onChange={(event) => setMappingDeviceUserId(event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Display name</span>
                  <input
                    className="h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm"
                    placeholder="Optional label shown on the device"
                    value={mappingDeviceUserName}
                    onChange={(event) => setMappingDeviceUserName(event.target.value)}
                  />
                </label>
                <button
                  className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
                  disabled={mappingSubmitting || !mappingMemberId || !mappingDeviceUserId.trim()}
                  onClick={() => void handleSaveMapping()}
                  type="button"
                >
                  {mappingSubmitting ? "Saving..." : "Save mapping"}
                </button>
              </div>
              {mappingError ? <p className="text-sm font-semibold text-red-600">{mappingError}</p> : null}
              <div className="space-y-2">
                {mappingsLoading ? <p className="text-sm text-muted-foreground">Loading mappings...</p> : null}
                {!mappingsLoading && mappings.length === 0 ? <p className="text-sm text-muted-foreground">No member mappings yet.</p> : null}
                {mappings.map((mapping) => {
                  const member = members.find((item) => item.id === mapping.member_id) as Record<string, unknown> | undefined;
                  return (
                    <div key={mapping.id as string} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-muted px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{member?.full_name as string ?? "Unknown member"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {mapping.device_user_id as string}
                          {mapping.device_user_name ? ` · ${mapping.device_user_name as string}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${mapping.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                          {mapping.is_active ? "Active" : "Inactive"}
                        </span>
                        {mapping.is_active ? (
                          <button
                            className="text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-50"
                            disabled={mappingSubmitting}
                            onClick={() => void handleDeactivateMapping(mapping.id as string)}
                            type="button"
                          >
                            Disable
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DeviceRegisterDrawer({
  deviceTypes, branches, apiKeyResult, onApiKeyResult, onClose, onRegistered,
}: {
  deviceTypes: DeviceItem[]; branches: DeviceItem[]; apiKeyResult: string | null; onApiKeyResult: (k: string | null) => void;
  onClose: () => void; onRegistered: () => void;
}) {
  const [deviceName, setDeviceName] = useState("");
  const [deviceTypeId, setDeviceTypeId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [location, setLocation] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (!deviceName || !deviceTypeId) { setError("Device name and type are required."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/attendance/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_name: deviceName, device_type_id: deviceTypeId, branch_id: branchId || undefined, location, ip_address: ipAddress, serial_number: serialNumber }),
      });
      const json = await res.json();
      if (json.ok) {
        onApiKeyResult(json.data.api_key);
        onRegistered();
      } else {
        setError(json.error?.message ?? "Failed to register device.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Register device">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-xl font-black">Register Device</h2>
          <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close"><Activity className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {apiKeyResult ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm font-bold text-green-800">Device Registered Successfully</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Save this API key</p>
                <p className="mt-1 break-all font-mono text-sm text-amber-900">{apiKeyResult}</p>
                <p className="mt-2 text-xs text-amber-700">This key will not be shown again. Store it securely.</p>
              </div>
              <button className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90" onClick={onClose} type="button">Done</button>
            </div>
          ) : (
            <>
              {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-sm text-red-800">{error}</p></div>}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Device Name *</label>
                <input className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} placeholder="Front Desk Scanner" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Device Type *</label>
                <select className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" value={deviceTypeId} onChange={(e) => setDeviceTypeId(e.target.value)}>
                  <option value="">Select type...</option>
                  {deviceTypes.map((t) => <option key={t.id as string} value={t.id as string}>{t.name as string}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Branch</label>
                <select className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {branches.map((branch) => <option key={branch.id as string} value={branch.id as string}>{branch.name as string}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Location</label>
                <input className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Main Entrance" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">IP Address</label>
                <input className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} placeholder="192.168.1.100" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Serial Number</label>
                <input className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="SN-001" />
              </div>
              <button className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50" disabled={submitting || !deviceName || !deviceTypeId} onClick={handleRegister} type="button">
                {submitting ? "Registering..." : "Register Device"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DeviceEditDrawer({ device, branches, onClose, onUpdated }: { device: DeviceItem; branches: DeviceItem[]; onClose: () => void; onUpdated: () => void }) {
  const [deviceName, setDeviceName] = useState(device.device_name as string ?? "");
  const [branchId, setBranchId] = useState(device.branch_id as string ?? "");
  const [location, setLocation] = useState(device.location as string ?? "");
  const [isActive, setIsActive] = useState(device.is_active === true);
  const [regenerateKey, setRegenerateKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const handleUpdate = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/attendance/devices/${device.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_name: deviceName, branch_id: branchId || undefined, location, is_active: isActive, regenerate_api_key: regenerateKey }),
      });
      const json = await res.json();
      if (json.ok) {
        if (json.data.api_key) setNewKey(json.data.api_key);
        onUpdated();
      } else {
        setError(json.error?.message ?? "Failed to update device.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col overflow-hidden bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Edit device">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-xl font-black">Edit Device</h2>
          <button className="flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground" onClick={onClose} type="button" aria-label="Close"><Activity className="size-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {newKey ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">New API Key Generated</p>
                <p className="mt-1 break-all font-mono text-sm text-amber-900">{newKey}</p>
                <p className="mt-2 text-xs text-amber-700">The old key is no longer valid.</p>
              </div>
              <button className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90" onClick={onClose} type="button">Done</button>
            </div>
          ) : (
            <>
              {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3"><p className="text-sm text-red-800">{error}</p></div>}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Device Name</label>
                <input className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Location</label>
                <input className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Branch</label>
                <select className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {branches.map((branch) => <option key={branch.id as string} value={branch.id as string}>{branch.name as string}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4" />
                <span className="text-sm font-bold">Device Active</span>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
                <input type="checkbox" checked={regenerateKey} onChange={(e) => setRegenerateKey(e.target.checked)} className="size-4" />
                <span className="text-sm font-bold">Regenerate API Key</span>
              </label>
              <button className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50" disabled={submitting} onClick={handleUpdate} type="button">
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LifecycleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-muted px-3 py-2">
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function DecommissionConfirmDialog({ deviceId, onClose, onDecommissioned }: { deviceId: string; onClose: () => void; onDecommissioned: () => void }) {
  const [submitting, setSubmitting] = useState(false);

  const handleDecommission = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/attendance/devices/${deviceId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) onDecommissioned();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Decommission confirm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-red-100"><Trash2 className="size-5 text-red-600" /></div>
          <div><h3 className="text-lg font-black">Decommission Device?</h3><p className="text-sm text-muted-foreground">This will deactivate the device and revoke its API key.</p></div>
        </div>
        <div className="mt-6 flex gap-3">
          <button className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-surface-muted" onClick={onClose} type="button">Cancel</button>
          <button className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50" disabled={submitting} onClick={handleDecommission} type="button">
            {submitting ? "Decommissioning..." : "Decommission"}
          </button>
        </div>
      </div>
    </div>
  );
}
