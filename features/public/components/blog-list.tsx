"use client";

import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BlogPost } from "@/types/content";

type BlogListProps = {
  posts: BlogPost[];
};

export function BlogList({ posts }: BlogListProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const categories = ["All", ...Array.from(new Set(posts.map((post) => post.category)))];
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      posts.filter((post) => {
        const matchesCategory = category === "All" || post.category === category;
        const matchesQuery =
          !normalizedQuery ||
          post.title.toLowerCase().includes(normalizedQuery) ||
          post.excerpt.toLowerCase().includes(normalizedQuery) ||
          post.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
        return matchesCategory && matchesQuery;
      }),
    [category, normalizedQuery, posts]
  );

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:flex-row md:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search blog posts</span>
          <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <Input className="pl-10" placeholder="Search fitness, nutrition, recovery, or lifestyle" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              className={`rounded-full border px-3 py-2 text-sm font-bold transition ${category === item ? "border-ink bg-ink text-white" : "border-border bg-surface-muted text-foreground hover:border-border-strong"}`}
              key={item}
              onClick={() => setCategory(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((post) => (
          <Card className="overflow-hidden" key={post.slug}>
            <div className="relative aspect-[16/10]">
              <Image alt={post.title} className="object-cover" fill sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" src={post.image} />
            </div>
            <div className="p-5">
              <Badge variant="info">{post.category}</Badge>
              <h2 className="mt-4 text-xl font-black leading-tight">
                <Link className="hover:underline" href={`/blog/${post.slug}`}>
                  {post.title}
                </Link>
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{post.excerpt}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span className="rounded-full bg-surface-muted px-2 py-1 text-xs font-semibold text-muted-foreground" key={tag}>
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {filtered.length === 0 ? <p className="mt-8 rounded-lg border border-border bg-surface p-6 text-center font-semibold text-muted-foreground">No articles match that search.</p> : null}
    </div>
  );
}

