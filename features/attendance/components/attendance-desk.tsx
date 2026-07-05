"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { CheckCircle2, QrCode, Search, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { FormMessage } from "@/features/auth/components/form-message";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { QrCameraScanner } from "./qr-camera-scanner";
import { MemberProfileCard } from "./member-profile-card";
import { AttendanceSearch } from "./attendance-search";
import { OccupancyMeter } from "./occupancy-meter";
import { manualCheckInAction, qrCheckInAction, checkOutAction } from "../actions/attendance-actions";
import type { AccessDeviceRow, AttendanceSessionRow } from "@/types/attendance";
import type { MemberRow } from "@/types/membership";
import type { MembershipRow } from "@/types/membership";

type MemberSummary = Pick<MemberRow, "id" | "full_name" | "member_code" | "phone" | "email" | "photo_url" | "gender" | "last_attendance_date" | "is_currently_in_gym">;
type MembershipSummary = Pick<MembershipRow, "status" | "start_date" | "end_date">;

type AttendanceDeskProps = {
  gymId: string | null;
  branchId?: string | null;
  devices: AccessDeviceRow[];
  currentSessions: Array<AttendanceSessionRow & { member: Pick<MemberRow, "id" | "member_code" | "full_name" | "phone"> | null }>;
  metrics: {
    currentInside: number;
    todayCheckIns: number;
    capacityPercentage: number;
    capacity?: number;
  };
};

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

export function AttendanceDesk({ gymId, branchId = null, devices, currentSessions, metrics }: AttendanceDeskProps) {
  const [mode, setMode] = useState<"checkin" | "qr" | "checkout">("checkin");
  const [selectedMember, setSelectedMember] = useState<MemberSummary | null>(null);
  const [selectedMemberMembership, setSelectedMemberMembership] = useState<MembershipSummary | null>(null);
  const [batchMemberIds, setBatchMemberIds] = useState("");
  const [batchSessionType, setBatchSessionType] = useState("class");
  const [batchSessionName, setBatchSessionName] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState<"checkin" | "checkout" | null>(null);

  const [checkInState, checkInAction] = useActionState(manualCheckInAction, initialAuthActionState);
  const [checkOutState, checkOutAction_] = useActionState(checkOutAction, initialAuthActionState);
  const [qrState, qrAction] = useActionState(qrCheckInAction, initialAuthActionState);

  const handleSelectMember = async (member: MemberSummary) => {
    setSelectedMember(member);
    try {
      const res = await fetch(`/api/members/${member.id}/membership`);
      if (res.ok) {
        const data = await res.json();
        setSelectedMemberMembership(data.membership ?? null);
      } else {
        setSelectedMemberMembership(null);
      }
    } catch {
      setSelectedMemberMembership(null);
    }
  };

  const handleModeChange = (newMode: "checkin" | "qr" | "checkout") => {
    setMode(newMode);
    if (newMode !== mode) setSelectedMember(null);
  };

  const handleDoCheckIn = () => {
    if (!selectedMember) return;
    const fd = new FormData();
    fd.set("memberId", selectedMember.id);
    fd.set("deviceId", "");
    fd.set("notes", "");
    checkInAction(fd);
  };

  const handleDoCheckOut = () => {
    if (!selectedMember) return;
    const fd = new FormData();
    fd.set("memberId", selectedMember.id);
    fd.set("sessionId", "");
    fd.set("deviceId", "");
    fd.set("notes", "");
    checkOutAction_(fd);
  };

  const batchMembers = useMemo(() => {
    return batchMemberIds
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);
  }, [batchMemberIds]);

  const handleBatchRequest = async (kind: "checkin" | "checkout") => {
    if (batchMembers.length === 0) {
      setBatchMessage("Add at least one member ID before running a batch action.");
      return;
    }

    setBatchBusy(kind);
    setBatchMessage(null);

    try {
      const response = await fetch(`/api/v1/attendance/${kind === "checkin" ? "batch-checkin" : "batch-checkout"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId,
          branchId,
          memberIds: batchMembers,
          sessionType: batchSessionType,
          sessionName: batchSessionName,
          notes: batchNotes,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        setBatchMessage(json?.error?.message ?? "Batch action failed.");
        return;
      }

      const data = json.data as { checkedInCount?: number; checkedOutCount?: number; failedCount?: number; results?: Array<{ memberId: string; success: boolean; message: string }> } | null;
      const completed = kind === "checkin" ? data?.checkedInCount ?? 0 : data?.checkedOutCount ?? 0;
      const failed = data?.failedCount ?? 0;
      const firstResult = data?.results?.[0]?.message;
      setBatchMessage(`${completed} completed, ${failed} failed.${firstResult ? ` ${firstResult}` : ""}`);
    } catch {
      setBatchMessage("Batch action failed. Try again.");
    } finally {
      setBatchBusy(null);
    }
  };

  const capacity = metrics.capacity ?? 120;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
      {/* ═══ LEFT: Check-in / QR / Checkout ═══ */}
      <div className="space-y-5">
        {/* Mode switcher */}
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-0.5 self-start" role="tablist" aria-label="Attendance mode">
          <button
            aria-selected={mode === "checkin"}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${mode === "checkin" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => handleModeChange("checkin")}
            role="tab"
            type="button"
          >
            <span className="inline-flex items-center">
              <Search className="mr-1.5 inline size-3.5" />
              <span>Check In</span>
            </span>
          </button>
          <button
            aria-selected={mode === "qr"}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${mode === "qr" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => handleModeChange("qr")}
            role="tab"
            type="button"
          >
            <span className="inline-flex items-center">
              <QrCode className="mr-1.5 inline size-3.5" />
              <span>QR Scan</span>
            </span>
          </button>
          <button
            aria-selected={mode === "checkout"}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${mode === "checkout" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => handleModeChange("checkout")}
            role="tab"
            type="button"
          >
            <span className="inline-flex items-center">
              <CheckCircle2 className="mr-1.5 inline size-3.5" />
              <span>Check Out</span>
            </span>
          </button>
        </div>

        {/* Search */}
        <AttendanceSearch gymId={gymId} onSelect={handleSelectMember} />

        {/* Selected member card */}
        {selectedMember && (
          <MemberProfileCard
            member={selectedMember}
            membership={selectedMemberMembership}
            onCheckIn={mode === "checkin" ? handleDoCheckIn : undefined}
            onCheckOut={mode === "checkout" ? handleDoCheckOut : undefined}
          />
        )}

        {/* Check-in state messages */}
        <FormMessage state={checkInState} />
        <FormMessage state={checkOutState} />

        <div className="space-y-3 rounded-xl border border-border bg-surface p-5">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.12em] text-muted-foreground">Batch tools</p>
            <p className="mt-1 text-sm text-muted-foreground">Bulk check members in or out by pasting member IDs. Scope stays tied to this desk&apos;s gym and branch.</p>
          </div>
          <Textarea
            className="min-h-[88px]"
            onChange={(event) => setBatchMemberIds(event.target.value)}
            placeholder="member-1, member-2, member-3"
            value={batchMemberIds}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Input onChange={(event) => setBatchSessionType(event.target.value)} placeholder="class" value={batchSessionType} />
            <Input onChange={(event) => setBatchSessionName(event.target.value)} placeholder="Morning Strength" value={batchSessionName} />
          </div>
          <Textarea
            className="min-h-[72px]"
            onChange={(event) => setBatchNotes(event.target.value)}
            placeholder="Optional notes"
            value={batchNotes}
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={batchBusy !== null} onClick={() => void handleBatchRequest("checkin")} type="button" variant="secondary">
              {batchBusy === "checkin" ? "Checking in..." : "Batch Check In"}
            </Button>
            <Button disabled={batchBusy !== null} onClick={() => void handleBatchRequest("checkout")} type="button" variant="destructive">
              {batchBusy === "checkout" ? "Checking out..." : "Batch Check Out"}
            </Button>
          </div>
          {batchMessage ? <p className="text-sm font-semibold text-muted-foreground">{batchMessage}</p> : null}
        </div>

        {/* QR mode */}
        {mode === "qr" && (
          <QrCheckInSection devices={devices} qrState={qrState} qrAction={qrAction} />
        )}

        {/* Check-out by member search */}
        {mode === "checkout" && !selectedMember && (
          <div className="rounded-lg border border-border bg-surface-muted p-6 text-center">
            <UsersRound className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 font-bold">Search and select a member above to check them out</p>
            <p className="mt-1 text-sm text-muted-foreground">Only members currently inside can be checked out.</p>
          </div>
        )}
      </div>

      {/* ═══ RIGHT: Live Occupancy Panel ═══ */}
      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-surface p-5">
          <OccupancyMeter capacity={capacity} current={metrics.currentInside} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-surface-muted p-3 text-center">
              <p className="text-2xl font-black">{metrics.todayCheckIns}</p>
              <p className="text-xs font-semibold text-muted-foreground">Today</p>
            </div>
            <div className="rounded-lg bg-surface-muted p-3 text-center">
              <p className="text-2xl font-black">{currentSessions.length}</p>
              <p className="text-xs font-semibold text-muted-foreground">Inside</p>
            </div>
          </div>
        </div>

        {/* Active sessions */}
        <div className="space-y-3">
          <p className="text-sm font-black uppercase tracking-[0.12em] text-muted-foreground">
            Currently Inside ({currentSessions.length})
          </p>
          {currentSessions.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm font-semibold text-muted-foreground">
              No members currently inside
            </div>
          )}
          <div className="max-h-[480px] space-y-2 overflow-y-auto" role="list" aria-label="Active sessions">
            {currentSessions.map((session) => (
              <ActiveSessionRow
                devices={devices}
                key={session.id}
                session={session}
                checkOutState={checkOutState}
                checkOutAction={checkOutAction_}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActiveSessionRow({
  session,
  devices,
  checkOutState,
  checkOutAction: boundCheckOutAction,
}: {
  session: AttendanceSessionRow & { member: Pick<MemberRow, "id" | "member_code" | "full_name" | "phone"> | null };
  devices: AccessDeviceRow[];
  checkOutState: { status: string; message: string; fieldErrors?: Record<string, string[]> };
  checkOutAction: (fd: FormData) => void;
}) {
  const duration = Math.round((Date.now() - new Date(session.check_in_at).getTime()) / 60000);

  return (
    <div className="rounded-lg border border-border bg-surface p-3 transition hover:border-primary/20 hover:shadow-sm" role="listitem">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-bold">{session.member?.full_name ?? "Member"}</p>
            <span className="shrink-0 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success">
              {duration}m
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
            {session.member?.member_code ?? ""} · {new Date(session.check_in_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <form action={boundCheckOutAction} className="shrink-0">
          <input name="sessionId" type="hidden" value={session.id} />
          <input name="memberId" type="hidden" value="" />
          <select aria-label="Check-out device" className="h-8 rounded border border-border bg-surface px-2 text-xs font-semibold" name="deviceId">
            <option value="">Desk</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Button aria-label={`Check out ${session.member?.full_name ?? "member"}`} className="ml-2 h-8 text-xs" size="sm" type="submit" variant="destructive">Check Out</Button>
          <FormMessage state={checkOutState} />
        </form>
      </div>
    </div>
  );
}

function QrCheckInSection({
  devices,
  qrState,
  qrAction,
}: {
  devices: AccessDeviceRow[];
  qrState: { status: string; message: string; fieldErrors?: Record<string, string[]> };
  qrAction: (fd: FormData) => void;
}) {
  const [token, setToken] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);

  return (
    <form action={qrAction} className="space-y-4 rounded-xl border border-border bg-surface p-5" ref={formRef}>
      <div className="flex items-center gap-2">
        <QrCode className="size-5 text-muted-foreground" />
        <p className="font-bold">QR Attendance</p>
      </div>
      <p className="text-sm text-muted-foreground">Scan the member QR code with a camera or USB scanner. Paste the token only as fallback.</p>
      <FormMessage state={qrState} />
      <QrCameraScanner
        captureMessage="Point the camera at the member QR code."
        errorMessage="Camera scan failed. Use the manual scan field."
        onCapture={(value) => {
          setToken(value);
          window.setTimeout(() => formRef.current?.requestSubmit(), 0);
        }}
        unsupportedMessage="Camera scanning is not available in this browser. Use a USB scanner or paste the token."
      />
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="qr-token">QR Token</label>
        <Input
          id="qr-token"
          name="tokenValue"
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste scanned QR payload..."
          value={token}
        />
      </div>
      <select className={selectClass} defaultValue="" name="deviceId">
        <option value="">Reception default</option>
        {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <AuthSubmitButton>Validate and Check In</AuthSubmitButton>
    </form>
  );
}
