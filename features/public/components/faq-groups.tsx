"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { FaqItem } from "@/types/content";

type FaqGroupsProps = {
  faqs: FaqItem[];
};

export function FaqGroups({ faqs }: FaqGroupsProps) {
  const [category, setCategory] = useState<FaqItem["category"] | "All">("All");
  const categories = ["All", ...Array.from(new Set(faqs.map((faq) => faq.category)))] as Array<FaqItem["category"] | "All">;
  const filtered = category === "All" ? faqs : faqs.filter((faq) => faq.category === category);

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
      <Accordion.Root className="mt-8 grid gap-3" type="multiple">
        {filtered.map((faq) => (
          <Accordion.Item className="rounded-lg border border-border bg-surface" key={faq.question} value={faq.question}>
            <Accordion.Header>
              <Accordion.Trigger className="flex w-full items-center justify-between gap-4 p-5 text-left font-black">
                {faq.question}
                <ChevronDown aria-hidden="true" className="shrink-0 transition data-[state=open]:rotate-180" size={18} />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="px-5 pb-5 text-sm leading-6 text-muted-foreground">{faq.answer}</Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </div>
  );
}

