import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCurrency, formatCompactNumber } from "@/features/enterprise/lib/business-rules";
import type { SubscriptionAnalytics } from "../../services/subscription-analytics-service";

export function SubscriptionAnalyticsCards({ analytics }: { analytics: SubscriptionAnalytics }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <AnalyticCard
        label="Active Subscriptions"
        value={formatCompactNumber(analytics.activeSubscriptions)}
        detail={`${analytics.activeChange >= 0 ? "+" : ""}${analytics.activeChange} this period`}
        trend={analytics.activeChange >= 0 ? "up" : "down"}
      />
      <AnalyticCard
        label="Monthly Recurring Revenue"
        value={formatCurrency(analytics.mrr, "INR")}
        detail={`ARR ${formatCurrency(analytics.arr, "INR")}`}
        trend="neutral"
      />
      <AnalyticCard
        label="Trial Conversion"
        value={`${analytics.trialConversionRate}%`}
        detail={`${analytics.trialingSubscriptions} currently trialing`}
        trend={analytics.trialConversionRate >= 40 ? "up" : "down"}
      />
      <AnalyticCard
        label="Add-on Revenue"
        value={formatCurrency(analytics.totalAddonMrr, "INR")}
        detail={`${formatCurrency(analytics.addonMrr, "INR")} / active sub`}
        trend="neutral"
      />
    </div>
  );
}

function AnalyticCard({
  label,
  value,
  detail,
  trend,
}: {
  label: string;
  value: string;
  detail: string;
  trend: "up" | "down" | "neutral";
}) {
  const trendColor =
    trend === "up"
      ? "text-green-600 dark:text-green-400"
      : trend === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <Card>
      <CardHeader className="pb-2 sm:pb-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground" aria-label={label}>{label}</p>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-black sm:text-2xl md:text-3xl" aria-live="polite">{value}</p>
        <p className={`mt-1 text-xs font-semibold ${trendColor}`} role="status">
          <span className={trend === "up" ? "sr-only" : trend === "down" ? "sr-only" : ""}>
            {trend === "up" ? "Increase: " : trend === "down" ? "Decrease: " : ""}
          </span>
          {detail}
        </p>
      </CardContent>
    </Card>
  );
}
