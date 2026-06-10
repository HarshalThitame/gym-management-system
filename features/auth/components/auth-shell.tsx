import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-obsidian text-white">
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        <section className="flex min-h-[38vh] flex-col justify-between border-b border-white/10 bg-[linear-gradient(135deg,rgb(200_242_74/0.18),transparent_42%),linear-gradient(180deg,rgb(255_255_255/0.08),transparent)] p-6 lg:min-h-screen lg:border-b-0 lg:border-r lg:p-10">
          <Link className="text-sm font-black uppercase tracking-[0.22em]" href="/">
            Apex Performance Club
          </Link>
          <div className="max-w-xl py-12 lg:py-0">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
            <h1 className="mt-4 text-balance text-4xl font-black leading-tight md:text-6xl">{title}</h1>
            <p className="mt-5 text-lg leading-8 text-white/70">{description}</p>
          </div>
          <p className="hidden text-sm text-white/50 lg:block">Secure access for members, trainers, and gym operations teams.</p>
        </section>
        <section className="flex items-center justify-center bg-background px-4 py-10 text-foreground sm:px-6 lg:px-10">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-premium sm:p-7">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
