"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { GalleryItem } from "@/types/content";

type GalleryBrowserProps = {
  items: GalleryItem[];
};

export function GalleryBrowser({ items }: GalleryBrowserProps) {
  const [category, setCategory] = useState("All");
  const [active, setActive] = useState<GalleryItem | null>(null);
  const categories = ["All", ...Array.from(new Set(items.map((item) => item.category)))];
  const filtered = useMemo(() => (category === "All" ? items : items.filter((item) => item.category === category)), [category, items]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {categories.map((item) => (
          <button
            className={`rounded-full border px-3 py-2 text-sm font-bold transition ${category === item ? "border-ink bg-ink text-white" : "border-border bg-surface text-foreground hover:border-border-strong"}`}
            key={item}
            onClick={() => setCategory(item)}
            type="button"
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-3">
        {filtered.map((item, index) => (
          <button
            aria-label={`Open ${item.title}`}
            className="group mb-4 block w-full break-inside-avoid overflow-hidden rounded-lg border border-border bg-surface text-left"
            key={item.id}
            onClick={() => setActive(item)}
            type="button"
          >
            <div className={`relative ${index % 3 === 0 ? "aspect-[4/5]" : "aspect-[4/3]"}`}>
              <Image alt={item.alt} className="object-cover transition duration-300 group-hover:scale-[1.03]" fill loading="lazy" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" src={item.image} />
            </div>
            <div className="p-4">
              <p className="font-black">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.category}</p>
            </div>
          </button>
        ))}
      </div>
      <Dialog.Root open={Boolean(active)} onOpenChange={(open) => !open && setActive(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-5xl -translate-y-1/2 rounded-lg bg-obsidian p-3 text-white shadow-2xl">
            <Dialog.Title className="sr-only">{active?.title}</Dialog.Title>
            <Dialog.Close className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-md bg-black/50" aria-label="Close image">
              <X aria-hidden="true" size={20} />
            </Dialog.Close>
            {active ? (
              <>
                <div className="relative aspect-[16/10] overflow-hidden rounded-md">
                  <Image alt={active.alt} className="object-cover" fill sizes="90vw" src={active.image} />
                </div>
                <div className="p-3">
                  <p className="font-black">{active.title}</p>
                  <p className="text-sm text-white/64">{active.category}</p>
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

