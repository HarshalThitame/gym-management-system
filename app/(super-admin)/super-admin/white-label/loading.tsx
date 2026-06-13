import { Card } from "@/components/ui/card";

export default function WhiteLabelLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="h-8 w-64 rounded bg-muted animate-pulse" />
      <div className="h-4 w-96 rounded bg-muted animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4"><div className="h-3 w-16 rounded bg-muted animate-pulse mb-2" /><div className="h-8 w-12 rounded bg-muted animate-pulse" /></Card>
        ))}
      </div>
      <div className="h-10 w-full rounded-lg bg-muted animate-pulse" />
      <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 w-full rounded-lg bg-muted animate-pulse" />)}</div>
    </div>
  );
}
