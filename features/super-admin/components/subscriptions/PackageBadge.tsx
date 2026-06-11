import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type PackageBadgeProps = {
  packageName: string | null;
};

const packageClasses: Record<string, string> = {
  lite: "border-slate-200 bg-slate-50 text-slate-700",
  standard: "border-indigo-200 bg-indigo-50 text-indigo-700",
  premium: "border-amber-200 bg-amber-50 text-amber-800"
};

export function PackageBadge({ packageName }: PackageBadgeProps) {
  const normalizedName = packageName?.toLowerCase() ?? "";

  return (
    <Badge className={cn(packageClasses[normalizedName] ?? "border-border bg-surface-muted text-muted-foreground")}>
      {packageName ?? "No plan"}
    </Badge>
  );
}
