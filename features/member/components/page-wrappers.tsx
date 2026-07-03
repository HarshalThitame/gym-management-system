"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

export function PageHeader({
  eyebrow,
  title,
  description,
  delay = 0
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {eyebrow && (
        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
      )}
      <h2 className={`${eyebrow ? "mt-2" : ""} text-3xl font-black gradient-text`}>{title}</h2>
      {description && (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      )}
    </motion.div>
  );
}

export function AnimatedCardSection({
  children,
  delay = 0,
  variant = "glass"
}: {
  children: ReactNode;
  delay?: number;
  variant?: "default" | "glass" | "glow";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: "blur(2px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.45, delay, ease: [0.2, 0, 0, 1] }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

export function AnimatedListSection({
  children,
  delay = 0
}: {
  children: ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.06, delayChildren: delay } }
      }}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedListItem({
  children,
  index = 0
}: {
  children: ReactNode;
  index?: number;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12, scale: 0.98 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: "easeOut" } }
      }}
    >
      {children}
    </motion.div>
  );
}
