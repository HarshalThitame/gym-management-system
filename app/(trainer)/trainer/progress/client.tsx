"use client";

import { useActionState } from "react";
import { motion } from "framer-motion";
import { Camera, Upload, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadProgressPhotoAction } from "@/features/training/actions/trainer-self-service-actions";
import { initialAuthActionState } from "@/features/auth/actions/action-state";
import type { MemberProgressPhotoRow } from "@/types/training";

const photoTypeLabels: Record<string, string> = {
  front: "Front View",
  back: "Back View",
  side: "Side View",
  custom: "Custom",
};

export function ProgressPhotoSection({
  memberId,
  photos,
}: {
  memberId: string;
  photos: MemberProgressPhotoRow[];
}) {
  const [state, formAction, pending] = useActionState(uploadProgressPhotoAction, initialAuthActionState);

  const groupedByDate = photos.reduce<Record<string, MemberProgressPhotoRow[]>>((acc, photo) => {
    const key = photo.recorded_on;
    if (!acc[key]) acc[key] = [];
    acc[key].push(photo);
    return acc;
  }, {});

  const dates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 150, damping: 20 }}
      className="overflow-hidden rounded-2xl border border-border bg-surface shadow-premium"
    >
      <div className="border-b border-border bg-gradient-to-r from-accent/5 to-purple-600/5 p-6">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-glow">
            <Camera className="size-5" />
          </div>
          <div>
            <h3 className="text-2xl font-black">Progress Photos</h3>
            <p className="text-xs font-semibold text-muted-foreground">Track visual transformation over time</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <form action={formAction} className="mb-6 space-y-4 rounded-lg border border-dashed border-accent/30 bg-accent/5 p-4">
          <input type="hidden" name="memberId" value={memberId} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Photo</label>
              <input
                type="file"
                name="photoFile"
                accept="image/jpeg,image/png,image/webp"
                className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-accent hover:file:bg-accent/20"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Type</label>
              <select
                name="photoType"
                className="flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
                defaultValue="front"
              >
                <option value="front">Front View</option>
                <option value="back">Back View</option>
                <option value="side">Side View</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Date</label>
              <input
                type="date"
                name="recordedOn"
                defaultValue={new Date().toISOString().split("T")[0]}
                className="flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Notes (optional)</label>
            <textarea
              name="notes"
              rows={2}
              className="flex w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-semibold transition-all duration-200 focus:border-accent focus:ring-2 focus:ring-accent/20"
              placeholder="e.g., Notable muscle definition improvement..."
            />
          </div>
          {state?.status === "error" && (
            <p className="text-sm font-bold text-destructive animate-shake">{state.message}</p>
          )}
          {state?.status === "success" && (
            <p className="text-sm font-bold text-success">{state.message}</p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            <Upload className="mr-2 size-4" />
            {pending ? "Uploading..." : "Upload Photo"}
          </Button>
        </form>

        {dates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-muted/50 p-8 text-center">
            <Camera className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-bold text-muted-foreground">No progress photos yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Upload before/after photos to track visual transformation.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {dates.map((date) => (
              <div key={date}>
                <div className="mb-3 flex items-center gap-2">
                  <Calendar className="size-4 text-muted-foreground" />
                  <p className="text-sm font-bold">{new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {groupedByDate[date].map((photo) => (
                    <div
                      key={photo.id}
                      className="group relative overflow-hidden rounded-xl border border-border bg-surface-muted/50 transition-all duration-300 hover:border-accent/30 hover:shadow-glow-sm"
                    >
                      <div className="aspect-[3/4] bg-surface-muted">
                        <img
                          src={photo.photo_url}
                          alt={photoTypeLabels[photo.photo_type] ?? "Progress photo"}
                          className="size-full object-cover transition-all duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-3">
                        <p className="text-xs font-bold text-white">{photoTypeLabels[photo.photo_type] ?? photo.photo_type}</p>
                        {photo.notes && (
                          <p className="mt-0.5 text-[10px] text-white/70">{photo.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
