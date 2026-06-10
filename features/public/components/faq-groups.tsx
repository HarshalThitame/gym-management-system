import type { FaqItem } from "@/types/content";

type FaqGroupsProps = {
  faqs: FaqItem[];
};

export function FaqGroups({ faqs }: FaqGroupsProps) {
  const groups = Array.from(
    faqs.reduce((itemsByCategory, faq) => {
      const items = itemsByCategory.get(faq.category) ?? [];
      items.push(faq);
      itemsByCategory.set(faq.category, items);
      return itemsByCategory;
    }, new Map<FaqItem["category"], FaqItem[]>())
  );

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap gap-2" aria-label="FAQ categories">
        {groups.map(([category]) => (
          <a className="rounded-full border border-border bg-surface px-3 py-2 text-sm font-bold text-foreground transition hover:border-border-strong" href={`#faq-${category.toLowerCase().replaceAll(" ", "-")}`} key={category}>
            {category}
          </a>
        ))}
      </div>
      {groups.map(([category, items]) => (
        <section id={`faq-${category.toLowerCase().replaceAll(" ", "-")}`} key={category}>
          <h2 className="text-2xl font-black">{category}</h2>
          <div className="mt-4 grid gap-3">
            {items.map((faq) => (
              <details className="group rounded-lg border border-border bg-surface p-5" key={faq.question}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-black [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <span aria-hidden="true" className="text-xl leading-none text-muted-foreground transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
