"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Camera, Search, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button";
import { FieldError, FormMessage } from "@/features/auth/components/form-message";
import type { AccessDeviceRow, AttendanceSessionRow } from "@/types/attendance";
import type { MemberRow } from "@/types/membership";
import {
  checkOutAction,
  manualCheckInAction,
  qrCheckInAction,
  regenerateQrTokenAction,
  saveAccessDeviceAction,
  syncInactivityAlertsAction
} from "../actions/attendance-actions";

const selectClass = "h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-foreground shadow-sm";

type BarcodeDetectorResult = {
  rawValue?: string;
};

type BrowserBarcodeDetector = {
  detect: (source: HTMLVideoElement) => Promise<BarcodeDetectorResult[]>;
};

type BrowserBarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BrowserBarcodeDetector;

declare global {
  interface Window {
    BarcodeDetector?: BrowserBarcodeDetectorConstructor;
  }
}

export function ManualCheckInForm({ members, devices }: { members: MemberRow[]; devices: AccessDeviceRow[] }) {
  const [state, formAction] = useActionState(manualCheckInAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <SelectMember members={members} />
      <SelectDevice devices={devices} />
      <Textarea name="notes" placeholder="Reception notes or override context" />
      <AuthSubmitButton>Check In Member</AuthSubmitButton>
    </form>
  );
}

export function QrScanForm({ devices, defaultToken = "" }: { devices: AccessDeviceRow[]; defaultToken?: string }) {
  const [state, formAction] = useActionState(qrCheckInAction, initialAuthActionState);
  const [token, setToken] = useState(defaultToken);
  const [scannerStatus, setScannerStatus] = useState<"idle" | "starting" | "active" | "unsupported" | "error">("idle");
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const detectorRef = useRef<BrowserBarcodeDetector | null>(null);

  useEffect(() => {
    setToken(defaultToken);
  }, [defaultToken]);

  useEffect(() => {
    return () => {
      cleanupScanner();
    };
  }, []);

  async function startScanner() {
    if (!("mediaDevices" in navigator) || !navigator.mediaDevices.getUserMedia) {
      setScannerStatus("unsupported");
      setScannerMessage("Camera scanning is not available in this browser. Use the manual scan field.");
      return;
    }

    if (!window.BarcodeDetector) {
      setScannerStatus("unsupported");
      setScannerMessage("This browser does not support camera QR detection. Use a USB scanner or paste the token.");
      return;
    }

    setScannerStatus("starting");
    setScannerMessage("Opening camera...");

    try {
      detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setScannerStatus("active");
      setScannerMessage("Point the camera at the member QR code.");
      scanFrame();
    } catch {
      setScannerStatus("error");
      setScannerMessage("Camera permission was denied or the camera could not be opened.");
      stopScanner();
    }
  }

  function stopScanner() {
    cleanupScanner();
    setScannerStatus((current) => (current === "active" || current === "starting" ? "idle" : current));
  }

  function cleanupScanner() {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    detectorRef.current = null;
  }

  function scanFrame() {
    animationFrameRef.current = window.requestAnimationFrame(() => {
      void detectBarcode();
    });
  }

  async function detectBarcode() {
    const detector = detectorRef.current;
    const video = videoRef.current;

    if (!detector || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      scanFrame();
      return;
    }

    try {
      const results = await detector.detect(video);
      const rawValue = results[0]?.rawValue?.trim();

      if (rawValue) {
        setToken(rawValue);
        setScannerMessage("QR captured. Review the access point, then submit check-in.");
        stopScanner();
        return;
      }
    } catch {
      setScannerStatus("error");
      setScannerMessage("Camera scan failed. Use the manual scan field.");
      stopScanner();
      return;
    }

    scanFrame();
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="space-y-3 rounded-md border border-border bg-surface-muted p-3">
        <video
          aria-label="QR scanner camera preview"
          className="aspect-video w-full rounded-md border border-border bg-ink object-cover"
          muted
          playsInline
          ref={videoRef}
        />
        <div className="flex flex-wrap gap-2">
          <Button disabled={scannerStatus === "starting" || scannerStatus === "active"} onClick={startScanner} size="sm" type="button" variant="secondary">
            <Camera className="size-4" />
            {scannerStatus === "starting" ? "Opening..." : "Open Camera"}
          </Button>
          <Button disabled={scannerStatus !== "active" && scannerStatus !== "starting"} onClick={stopScanner} size="sm" type="button" variant="ghost">
            <Square className="size-4" />
            Stop
          </Button>
        </div>
        {scannerMessage ? <p className="text-xs font-semibold text-muted-foreground" role="status">{scannerMessage}</p> : null}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="tokenValue">QR token or scan URL</label>
        <Input id="tokenValue" name="tokenValue" onChange={(event) => setToken(event.target.value)} placeholder="Paste scanned QR payload" value={token} />
        <FieldError message={state.fieldErrors?.tokenValue?.[0]} />
      </div>
      <SelectDevice devices={devices} />
      <AuthSubmitButton>Validate QR and Check In</AuthSubmitButton>
    </form>
  );
}

export function CheckOutForm({ session, devices }: { session: AttendanceSessionRow; devices: AccessDeviceRow[] }) {
  const [state, formAction] = useActionState(checkOutAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-2">
      <FormMessage state={state} />
      <input name="sessionId" suppressHydrationWarning type="hidden" value={session.id} />
      <SelectDevice devices={devices} compact />
      <Input name="notes" placeholder="Checkout notes" />
      <Button className="w-full" type="submit" variant="secondary">Check Out</Button>
    </form>
  );
}

export function RegenerateQrForm({ memberId }: { memberId: string }) {
  const [state, formAction] = useActionState(regenerateQrTokenAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-2">
      <FormMessage state={state} />
      <input name="memberId" suppressHydrationWarning type="hidden" value={memberId} />
      <Button type="submit" variant="secondary">Regenerate QR</Button>
    </form>
  );
}

export function AccessDeviceForm() {
  const [state, formAction] = useActionState(saveAccessDeviceAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="deviceCode" label="Device code" state={state}>
          <Input id="deviceCode" name="deviceCode" placeholder="REC-01" />
        </Field>
        <Field name="name" label="Device name" state={state}>
          <Input id="name" name="name" placeholder="Front Desk Scanner" />
        </Field>
        <select className={selectClass} name="deviceType" defaultValue="reception" aria-label="Device type">
          <option value="reception">Reception</option>
          <option value="qr_scanner">QR scanner</option>
          <option value="turnstile">Turnstile</option>
          <option value="rfid_reader">RFID reader</option>
          <option value="biometric">Biometric</option>
          <option value="face_recognition">Face recognition</option>
          <option value="kiosk">Kiosk</option>
          <option value="api">API</option>
        </select>
        <select className={selectClass} name="status" defaultValue="active" aria-label="Device status">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="maintenance">Maintenance</option>
          <option value="retired">Retired</option>
        </select>
      </div>
      <Input name="location" placeholder="Entrance, reception desk, turnstile lane" />
      <AuthSubmitButton>Save Device</AuthSubmitButton>
    </form>
  );
}

export function SyncInactivityAlertsForm() {
  const [state, formAction] = useActionState(syncInactivityAlertsAction, initialAuthActionState);

  return (
    <form action={formAction} className="space-y-2">
      <FormMessage state={state} />
      <AuthSubmitButton>Sync Absence Alerts</AuthSubmitButton>
    </form>
  );
}

function SelectMember({ members }: { members: MemberRow[] }) {
  const [query, setQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id ?? "");
  const visibleMembers = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return members;
    }

    return members.filter((member) => {
      const searchable = `${member.full_name} ${member.member_code} ${member.phone} ${member.email ?? ""}`.toLowerCase();
      return searchable.includes(normalized);
    });
  }, [members, query]);
  const fallbackMemberId = visibleMembers[0]?.id ?? "";

  useEffect(() => {
    if (!visibleMembers.some((member) => member.id === selectedMemberId)) {
      setSelectedMemberId(fallbackMemberId);
    }
  }, [fallbackMemberId, selectedMemberId, visibleMembers]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-sm font-bold" htmlFor="memberSearch">Find member</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            id="memberSearch"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search loaded members by name, phone, email, or member ID"
            value={query}
          />
        </div>
        <p className="text-xs font-semibold text-muted-foreground">
          {visibleMembers.length} of {members.length} loaded members match. Use the page search above when the member is outside this list.
        </p>
      </div>
      <label className="text-sm font-bold" htmlFor="memberId">Member</label>
      <select className={selectClass} id="memberId" name="memberId" onChange={(event) => setSelectedMemberId(event.target.value)} value={selectedMemberId}>
        {visibleMembers.map((member) => (
          <option key={member.id} value={member.id}>{member.full_name} · {member.member_code}</option>
        ))}
        {visibleMembers.length === 0 ? <option value="">No loaded member matches this search</option> : null}
      </select>
    </div>
  );
}

function SelectDevice({ devices, compact = false }: { devices: AccessDeviceRow[]; compact?: boolean }) {
  return (
    <div className={compact ? "" : "space-y-2"}>
      {compact ? null : <label className="text-sm font-bold" htmlFor="deviceId">Access point</label>}
      <select className={selectClass} id="deviceId" name="deviceId" defaultValue="">
        <option value="">Reception default</option>
        {devices.map((device) => (
          <option key={device.id} value={device.id}>{device.name}</option>
        ))}
      </select>
    </div>
  );
}

function Field({ name, label, state, children }: { name: string; label: string; state: { fieldErrors?: Record<string, string[]> }; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-bold" htmlFor={name}>{label}</label>
      {children}
      <FieldError message={state.fieldErrors?.[name]?.[0]} />
    </div>
  );
}
