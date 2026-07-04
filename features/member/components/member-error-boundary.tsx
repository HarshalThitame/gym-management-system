"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

type MemberErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
  featureName?: string;
};

export function MemberErrorBoundary({ error, reset, featureName }: MemberErrorBoundaryProps) {
  return (
    <motion.div
      className={cn("flex flex-col items-center justify-center gap-6 py-24 text-center")}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <motion.div
        className="rounded-full bg-red-500/15 p-5"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
      >
        <AlertTriangle aria-hidden="true" className="size-8 text-red-400" />
      </motion.div>
      <h1 className="text-2xl font-black">
        {featureName ? `${featureName} failed to load` : "Something went wrong"}
      </h1>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">
        {error.message || "An unexpected error occurred while loading this page. Please try again."}
      </p>
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button onClick={reset} variant="primary-gradient" size="lg">
          <RefreshCw className="size-4" />
          Try Again
        </Button>
      </motion.div>
      <p className="text-xs text-muted-foreground/60">
        If the problem persists, please contact support.
      </p>
    </motion.div>
  );
}
