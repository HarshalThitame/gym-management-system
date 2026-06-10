"use client";

import Image from "next/image";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Trainer } from "@/types/content";

type TrainerDirectoryProps = {
  trainers: Trainer[];
};

export function TrainerDirectory({ trainers }: TrainerDirectoryProps) {
  const [query, setQuery] = useState("");
  const [specialization, setSpecialization] = useState("All");
  const specializations = ["All", ...Array.from(new Set(trainers.map((trainer) => trainer.specialization)))];
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      trainers.filter((trainer) => {
        const matchesQuery =
          !normalizedQuery ||
          trainer.name.toLowerCase().includes(normalizedQuery) ||
          trainer.role.toLowerCase().includes(normalizedQuery) ||
          trainer.bio.toLowerCase().includes(normalizedQuery);
        const matchesSpecialization = specialization === "All" || trainer.specialization === specialization;
        return matchesQuery && matchesSpecialization;
      }),
    [normalizedQuery, specialization, trainers]
  );

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:flex-row md:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search trainers</span>
          <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <Input className="pl-10" placeholder="Search by coach, specialty, or goal" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2">
          {specializations.map((item) => (
            <button
              className={`rounded-full border px-3 py-2 text-sm font-bold transition ${specialization === item ? "border-ink bg-ink text-white" : "border-border bg-surface-muted text-foreground hover:border-border-strong"}`}
              key={item}
              onClick={() => setSpecialization(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {filtered.map((trainer) => (
          <Card className="overflow-hidden" id={trainer.slug} key={trainer.slug}>
            <div className="relative aspect-[3/4]">
              <Image alt={`${trainer.name}, ${trainer.role}`} className="object-cover" fill sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw" src={trainer.image} />
            </div>
            <div className="p-5">
              <Badge variant="info">{trainer.specialization}</Badge>
              <h2 className="mt-4 text-xl font-black">{trainer.name}</h2>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">{trainer.role}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{trainer.bio}</p>
              <div className="mt-4 grid gap-2 text-sm">
                <p><strong>Experience:</strong> {trainer.experience}</p>
                <p><strong>Certifications:</strong> {trainer.certifications.join(", ")}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="mt-8 rounded-lg border border-border bg-surface p-6 text-center font-semibold text-muted-foreground">
          No trainers match that search. Try a different specialty or speak with the team.
        </p>
      ) : null}
    </div>
  );
}

