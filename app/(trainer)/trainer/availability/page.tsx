import type { Metadata } from "next";
import { CalendarRange, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { getTrainerAvailability, getTrainerTimeOff } from "@/features/training/services/training-service";
import { requireTrainerPortalAccess } from "@/features/trainer/lib/access";
import { createMetadata } from "@/lib/seo/metadata";
import { AvailabilityForm, AvailabilitySlotList, TimeOffForm, TimeOffList } from "./client";

export const metadata: Metadata = createMetadata({
  title: "My Availability",
  description: "Manage your weekly availability schedule and time-off requests.",
  path: "/trainer/availability",
});

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function TrainerAvailabilityPage() {
  const context = await requireTrainerPortalAccess("/trainer/availability");
  const [availability, timeOff] = await Promise.all([
    getTrainerAvailability(context.userId ?? "", context.profile?.gym_id ?? null),
    getTrainerTimeOff(context.userId ?? ""),
  ]);

  return (
    <div className="space-y-8">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/trainer" }, { label: "My Availability" }]} />
      <div className="animate-fade-in-up">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Schedule</p>
        <h2 className="mt-2 text-3xl font-black">My Availability</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Set your weekly availability windows and manage time-off requests. Members and admins will see your available slots.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-accent to-purple-600 text-white shadow-glow">
                <Clock className="size-5" />
              </div>
              <div>
                <h3 className="text-2xl font-black">Weekly Schedule</h3>
                <p className="text-xs font-semibold text-muted-foreground">Set your regular weekly hours</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <AvailabilityForm />
            <AvailabilitySlotList availability={availability} dayNames={dayNames} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-glow">
                <CalendarRange className="size-5" />
              </div>
              <div>
                <h3 className="text-2xl font-black">Time Off</h3>
                <p className="text-xs font-semibold text-muted-foreground">Request and manage time-off</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <TimeOffForm />
            <TimeOffList timeOff={timeOff} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-muted-foreground" />
            <p className="text-sm font-bold text-muted-foreground">Your schedule is visible to gym admins and members when they book sessions.</p>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
