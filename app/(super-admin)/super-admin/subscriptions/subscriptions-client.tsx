"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import dynamic from "next/dynamic";

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
  return <PackageManagementClient data={data} />;
}
