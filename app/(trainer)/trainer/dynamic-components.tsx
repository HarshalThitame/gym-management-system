"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const PageTransition = dynamic(() => import("@/components/motion/page-transition"), { ssr: false });
const CommandPaletteWrapper = dynamic(() => import("./command-palette-wrapper"), { ssr: false });

export function PageTransitionWrapper({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}

export function CommandPalette() {
  return <CommandPaletteWrapper />;
}
