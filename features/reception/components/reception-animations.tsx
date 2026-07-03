"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

const pageVariants = {
  initial: { opacity: 0, y: 24 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
  }
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" }
  }
};

export function ReceptionAnimatedPage({ children }: { children: ReactNode }) {
  return (
    <motion.div initial="initial" animate="animate" variants={pageVariants}>
      {children}
    </motion.div>
  );
}

export function AnimatedStaggerContainer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedStaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  );
}

export function AnimatedCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      whileHover={{
        y: -4,
        boxShadow: "0 20px 60px rgba(102, 126, 234, 0.25)",
        transition: { duration: 0.3, ease: "easeOut" }
      }}
      variants={staggerItem}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedStat({ value, label, detail }: { value: string; label: string; detail: string }) {
  return (
    <motion.div
      className="rounded-xl border border-border/60 bg-gradient-to-br from-surface to-surface-muted p-5 backdrop-blur-sm"
      variants={staggerItem}
      whileHover={{
        y: -4,
        scale: 1.02,
        boxShadow: "0 12px 40px rgba(102, 126, 234, 0.15)",
        transition: { duration: 0.25 }
      }}
    >
      <motion.p
        className="text-3xl font-black tabular-nums"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2, type: "spring", stiffness: 100 }}
      >
        {value}
      </motion.p>
      <p className="mt-1 text-sm font-black text-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{detail}</p>
    </motion.div>
  );
}

export function AnimatedHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-black bg-gradient-to-r from-foreground via-foreground to-accent bg-clip-text text-transparent">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
    </motion.section>
  );
}
