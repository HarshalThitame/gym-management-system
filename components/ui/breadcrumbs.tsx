import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";

type BreadcrumbItem = { label: string; href?: string };

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  showHome?: boolean;
};

export function Breadcrumbs({ items, showHome = true }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {showHome && (
          <li>
            <Link href="/" className="flex items-center gap-1 rounded-md px-2 py-1 hover:text-foreground" aria-label="Home">
              <Home className="size-3.5" />
            </Link>
          </li>
        )}
        {showHome && items.length > 0 && <li aria-hidden="true"><ChevronRight className="size-3.5" /></li>}
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={item.label + i} className="flex items-center gap-1.5">
              {item.href && !isLast ? (
                <Link href={item.href} className="rounded-md px-2 py-1 hover:text-foreground">{item.label}</Link>
              ) : (
                <span className={`rounded-md px-2 py-1 ${isLast ? "font-semibold text-foreground" : ""}`} aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRight className="size-3.5" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
