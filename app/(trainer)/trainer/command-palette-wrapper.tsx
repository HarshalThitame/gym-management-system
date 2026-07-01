"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Dumbbell, Gauge, MessageSquare, Clock, TrendingUp, Brain, Activity, UsersRound, Target, CheckCircle2 } from "lucide-react";
import { useEffect } from "react";
import { CommandPalette } from "@/components/ui/command-palette";
import { useCommandPalette } from "@/features/ux/hooks/use-keyboard-shortcuts";

export default function CommandPaletteWrapper() {
  const router = useRouter();
  const { open, setOpen } = useCommandPalette();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [setOpen]);

  const handleNavigate = useCallback(
    (href: string) => {
      router.push(href);
      setOpen(false);
    },
    [router, setOpen]
  );

  return (
    <CommandPalette
      open={open}
      onClose={() => setOpen(false)}
      items={[
        {
          id: "go-dashboard",
          label: "Dashboard",
          description: "Trainer home",
          category: "Navigation",
          icon: <Gauge className="size-4" />,
          shortcut: "G D",
          onSelect: () => handleNavigate("/trainer"),
        },
        {
          id: "go-sessions",
          label: "Sessions",
          description: "Calendar and session management",
          category: "Navigation",
          icon: <CalendarDays className="size-4" />,
          shortcut: "G S",
          onSelect: () => handleNavigate("/trainer/sessions"),
        },
        {
          id: "go-members",
          label: "Members",
          description: "Assigned member profiles",
          category: "Navigation",
          icon: <UsersRound className="size-4" />,
          shortcut: "G M",
          onSelect: () => handleNavigate("/trainer/members"),
        },
        {
          id: "go-programs",
          label: "Programs",
          description: "Program library and templates",
          category: "Navigation",
          icon: <Dumbbell className="size-4" />,
          shortcut: "G P",
          onSelect: () => handleNavigate("/trainer/programs"),
        },
        {
          id: "go-progress",
          label: "Progress Photos",
          description: "Member progress tracking",
          category: "Navigation",
          icon: <Activity className="size-4" />,
          shortcut: "G H",
          onSelect: () => handleNavigate("/trainer/progress"),
        },
        {
          id: "go-availability",
          label: "Availability",
          description: "Manage your schedule and time off",
          category: "Navigation",
          icon: <Clock className="size-4" />,
          shortcut: "G A",
          onSelect: () => handleNavigate("/trainer/availability"),
        },
        {
          id: "go-communications",
          label: "Communications",
          description: "Notifications and staff chat",
          category: "Navigation",
          icon: <MessageSquare className="size-4" />,
          shortcut: "G C",
          onSelect: () => handleNavigate("/trainer/communications"),
        },
        {
          id: "go-performance",
          label: "Performance",
          description: "Metrics and commissions",
          category: "Navigation",
          icon: <TrendingUp className="size-4" />,
          shortcut: "G R",
          onSelect: () => handleNavigate("/trainer/performance"),
        },
        {
          id: "go-ai",
          label: "AI Assistant",
          description: "AI recommendations and program generator",
          category: "Navigation",
          icon: <Brain className="size-4" />,
          shortcut: "G I",
          onSelect: () => handleNavigate("/trainer/ai"),
        },
        {
          id: "mark-complete",
          label: "Mark Session Complete",
          description: "Quick-complete a training session",
          category: "Actions",
          icon: <CheckCircle2 className="size-4" />,
          shortcut: "⌘⇧C",
          onSelect: () => {
            setOpen(false);
            setTimeout(() => {
              const path = "/trainer/sessions";
              router.push(path);
            }, 100);
          },
        },
        {
          id: "new-session",
          label: "Quick Session",
          description: "Create a new session",
          category: "Actions",
          icon: <Target className="size-4" />,
          shortcut: "⌘N",
          onSelect: () => {
            setOpen(false);
            router.push("/trainer/sessions");
          },
        },
      ]}
    />
  );
}
