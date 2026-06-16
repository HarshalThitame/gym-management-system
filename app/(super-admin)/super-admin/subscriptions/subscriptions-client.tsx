"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import dynamic from "next/dynamic";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { RequestQueueClient } from "./request-queue-client";

type Data = {
  error: string | null;
  organizations: any[];
  packages: any[];
  subscriptions: any[];
};

const PackageManagementClient = dynamic(
  () => import("./package-management-client").then((m) => m.PackageManagementClient),
  { ssr: false }
);

export function SubscriptionsClient({ data }: { data: Data }) {
  const [activeTab, setActiveTab] = useState<"packages" | "requests">("packages");

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("packages")}
          className={cn(
            "px-4 py-3 text-sm font-bold transition border-b-2",
            activeTab === "packages"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          type="button"
        >
          Package Management
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={cn(
            "px-4 py-3 text-sm font-bold transition border-b-2",
            activeTab === "requests"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          type="button"
        >
          Request Queue
        </button>
      </div>

      {activeTab === "packages" ? (
        <PackageManagementClient data={data} />
      ) : (
        <RequestQueueClient />
      )}
    </div>
  );
}
