import { WifiOff, CalendarDays, Dumbbell, RefreshCw } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const metadata = {
  title: "Offline",
  description: "Apex Performance Club offline fallback for cached member and operations workflows."
};

const offlineItems = [
  {
    title: "Member dashboard",
    description: "Previously opened dashboard cards remain available from the device cache.",
    icon: CalendarDays
  },
  {
    title: "Workout and nutrition drafts",
    description: "Mobile logs can be saved locally and synced when the network returns.",
    icon: Dumbbell
  },
  {
    title: "Automatic recovery",
    description: "Queued actions retry in the background after connectivity is restored.",
    icon: RefreshCw
  }
];

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-obsidian text-white">
      <section className="container-page flex min-h-screen items-center py-12">
        <div className="w-full max-w-3xl">
          <div className="mb-8 inline-flex size-14 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <WifiOff aria-hidden="true" className="size-7" />
          </div>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-accent">Offline mode</p>
          <h1 className="max-w-2xl text-4xl font-black leading-tight text-balance md:text-6xl">
            You can keep moving. Apex will sync when you are back online.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
            Your current connection is unavailable. Open previously viewed pages, save draft logs, and return to a live workflow as soon as the device reconnects.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/member" variant="accent">
              Open cached portal
            </ButtonLink>
            <ButtonLink href="/" variant="outline">
              Back to website
            </ButtonLink>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {offlineItems.map((item) => (
              <Card className="border-white/12 bg-white/8 text-white shadow-none" key={item.title}>
                <CardHeader>
                  <item.icon aria-hidden="true" className="size-5 text-accent" />
                  <h2 className="text-base font-black">{item.title}</h2>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-white/68">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
