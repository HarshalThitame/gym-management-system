"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Brain,
  BriefcaseBusiness,
  CalendarCheck,
  CalendarDays,
  Clock,
  CreditCard,
  Dumbbell,
  Flag,
  Gauge,
  Link2,
  MessageSquare,
  MoreHorizontal,
  ReceiptText,
  Scale,
  Settings,
  Shield,
  Tags,
  TrendingUp,
  UserRound,
  UserRoundPlus,
  UsersRound,
  Workflow,
  X,
  Zap
} from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

export type MobilePortalIconKey =
  | "activity"
  | "bar-chart"
  | "bell"
  | "bot"
  | "brain"
  | "briefcase"
  | "calendar-check"
  | "calendar-days"
  | "clock"
  | "credit-card"
  | "dumbbell"
  | "flag"
  | "gauge"
  | "gift"
  | "life-buoy"
  | "link"
  | "message-square"
  | "receipt"
  | "scale"
  | "settings"
  | "shield"
  | "shield-check"
  | "tags"
  | "target"
  | "trending-up"
  | "user"
  | "user-plus"
  | "users"
  | "wrench"
  | "zap";

export type MobilePortalNavItem = {
  href: string;
  label: string;
  iconKey: MobilePortalIconKey;
};

type MobileBottomNavProps = {
  items: MobilePortalNavItem[];
};

const navVariants: Variants = {
  hidden: { y: 80, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 30, mass: 1, delay: 0.15 },
  },
};

const panelVariants: Variants = {
  hidden: { y: 30, opacity: 0, scale: 0.96 },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 350, damping: 28, mass: 0.8 },
  },
  exit: {
    y: 20,
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.15, ease: "easeIn" },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.04 * i, type: "spring", stiffness: 300, damping: 24 },
  }),
};

export function MobileBottomNav({ items }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const primaryItems = useMemo(() => items.slice(0, 4), [items]);
  const overflowItems = useMemo(() => items.slice(4), [items]);

  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <AnimatePresence>
        {isOpen && overflowItems.length > 0 ? (
          <motion.div
            key="mobile-nav-overflow"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-40 rounded-lg border border-border bg-surface p-2 shadow-premium lg:hidden"
            drag={shouldReduceMotion ? false : "y"}
            dragConstraints={{ top: 0, bottom: 50 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 40) close();
            }}
          >
            <div className="mb-2 flex items-center justify-between px-2 py-1">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">More</p>
              <button
                aria-label="Close mobile navigation"
                className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                onClick={close}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {overflowItems.map((item, i) => {
                const active = isActivePath(pathname, item.href);
                const Icon = getPortalIcon(item.iconKey);

                return (
                  <motion.div
                    key={`${item.href}-${item.label}`}
                    variants={itemVariants}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                  >
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-12 items-center gap-3 rounded-md border px-3 text-sm font-bold transition",
                        active
                          ? "border-accent bg-accent text-accent-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-border-strong hover:text-foreground"
                      )}
                      href={item.href}
                      onClick={close}
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0" />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.nav
        aria-label="Mobile primary portal navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/94 px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-2 shadow-[0_-16px_50px_rgb(17_18_20/0.12)] backdrop-blur-xl lg:hidden"
        variants={navVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {primaryItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = getPortalIcon(item.iconKey);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-black leading-none transition",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                )}
                href={item.href}
                key={`${item.href}-${item.label}`}
              >
                <Icon aria-hidden="true" className="size-5" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
          <button
            aria-expanded={isOpen}
            aria-label={isOpen ? "Close more navigation" : "Open more navigation"}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[11px] font-black leading-none transition",
              isOpen ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            )}
            onClick={() => setIsOpen((value) => !value)}
            type="button"
          >
            <MoreHorizontal aria-hidden="true" className="size-5" />
            <span>More</span>
          </button>
        </div>
      </motion.nav>
    </>
  );
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getPortalIcon(iconKey: MobilePortalIconKey) {
  switch (iconKey) {
    case "activity":
      return Activity;
    case "bar-chart":
      return BarChart3;
    case "bell":
      return Bell;
    case "bot":
      return Bot;
    case "brain":
      return Brain;
    case "briefcase":
      return BriefcaseBusiness;
    case "calendar-check":
      return CalendarCheck;
    case "calendar-days":
      return CalendarDays;
    case "credit-card":
      return CreditCard;
    case "dumbbell":
      return Dumbbell;
    case "message-square":
      return MessageSquare;
    case "receipt":
      return ReceiptText;
    case "scale":
      return Scale;
    case "settings":
      return Settings;
    case "shield":
      return Shield;
    case "shield-check":
      return Shield;
    case "tags":
      return Tags;
    case "user":
      return UserRound;
    case "user-plus":
      return UserRoundPlus;
    case "users":
      return UsersRound;
    case "clock":
      return Clock;
    case "trending-up":
      return TrendingUp;
    case "flag":
      return Flag;
    case "link":
      return Link2;
    case "workflow":
      return Workflow;
    case "zap":
      return Zap;
    case "gauge":
    default:
      return Gauge;
  }
}
