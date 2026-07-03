"use client";

import type { ReactNode } from "react";
import PageTransition from "@/components/motion/page-transition";
import { ToastContainer } from "@/components/ui/toast";

export function MemberPageWrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <ToastContainer />
      <PageTransition>
        {children}
      </PageTransition>
    </>
  );
}
