"use client";
import { Monitor, Smartphone, Tablet } from "lucide-react";

type Device = "desktop" | "tablet" | "mobile";

export function DevicePreviewToggle({ device, onChange }: { device: Device; onChange: (d: Device) => void }) {
  const devices: { key: Device; icon: typeof Monitor; label: string; width: string }[] = [
    { key: "desktop", icon: Monitor, label: "Desktop", width: "100%" },
    { key: "tablet", icon: Tablet, label: "Tablet", width: "420px" },
    { key: "mobile", icon: Smartphone, label: "Mobile", width: "320px" },
  ];

  return (
    <div className="flex gap-1 p-0.5 rounded-md bg-muted/50">
      {devices.map((d) => {
        const Icon = d.icon;
        return (
          <button
            key={d.key}
            onClick={() => onChange(d.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${device === d.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            title={d.label}
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{d.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function getDeviceWidth(device: Device): string {
  if (device === "desktop") return "100%";
  if (device === "tablet") return "420px";
  return "320px";
}

export type { Device };
