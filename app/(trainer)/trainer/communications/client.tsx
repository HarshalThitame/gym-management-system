"use client";

import { useState, useActionState } from "react";
import { motion } from "framer-motion";
import { Send, MessageSquare, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TrainerRow } from "@/types/training";

export function StaffChatSection({
  trainers,
  currentTrainerId,
}: {
  trainers: TrainerRow[];
  currentTrainerId: string;
}) {
  const [selectedTrainer, setSelectedTrainer] = useState<string>("");
  const [message, setMessage] = useState("");

  const otherTrainers = trainers.filter((t) => t.id !== currentTrainerId);

  if (otherTrainers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface-muted/50 p-6 text-center">
        <UsersRound className="mx-auto size-6 text-muted-foreground/50" />
        <p className="mt-2 text-sm font-bold text-muted-foreground">No other trainers available</p>
        <p className="mt-1 text-xs text-muted-foreground">Inter-trainer messaging will be available when other trainers are added.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Send message to trainer</p>
      <div className="flex gap-3">
        <div className="flex-1">
          <select
            value={selectedTrainer}
            onChange={(e) => setSelectedTrainer(e.target.value)}
            className="flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">Select a trainer...</option>
            {otherTrainers.map((t) => (
              <option key={t.id} value={t.id}>{t.display_name}</option>
            ))}
          </select>
        </div>
      </div>
      {selectedTrainer && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-3"
        >
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="Type your message..."
            className="flex-1 rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <Button className="shrink-0 self-end">
            <Send className="mr-2 size-4" />
            Send
          </Button>
        </motion.div>
      )}
    </div>
  );
}
