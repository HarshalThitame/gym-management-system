"use client";

import { Apple, Activity, BarChart3, Dumbbell } from "lucide-react";
import type { OrganizationOwnerDashboard } from "@/features/organization-owner/services/organization-owner-service";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";

type NutritionEnterpriseModuleProps = { dashboard: OrganizationOwnerDashboard;
  moduleData?: unknown;
  moduleFilters?: Record<string, unknown>; };

export function NutritionEnterpriseModule({ dashboard }: NutritionEnterpriseModuleProps) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard detail="Meal plan templates" icon={<Apple className="size-5" />} label="Templates" value="0" />
        <StatCard detail="Members on nutrition plans" icon={<Activity className="size-5" />} label="Active Plans" value="0" />
        <StatCard detail="Average member compliance" icon={<BarChart3 className="size-5" />} label="Compliance" value="0%" />
        <StatCard detail="Trainers managing nutrition" icon={<Dumbbell className="size-5" />} label="Trainers" value="0" />
      </section>
      <EmptyState description="Create nutrition templates and meal plans for your members." title="Nutrition Management" type="initial_setup" />
    </div>
  );
}
