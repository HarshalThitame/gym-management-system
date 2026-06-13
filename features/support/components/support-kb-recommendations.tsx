"use client";

import { useEffect, useState } from "react";
import { BookOpen, ExternalLink } from "lucide-react";

type KbArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
};

export function SupportKbRecommendations({
  text,
  organizationId,
}: {
  text: string;
  organizationId?: string | null;
}) {
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!text || text.length < 10) {
      setArticles([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const keywords = text.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 10);
        const res = await fetch("/api/support/kb/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords, organizationId }),
        });
        const data = await res.json();
        if (data.ok) setArticles(data.data.slice(0, 3));
      } catch {} finally {
        setIsLoading(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [text, organizationId]);

  if (articles.length === 0) return null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2 space-y-1">
      <div className="flex items-center gap-1 text-[10px] font-semibold text-blue-700 mb-1">
        <BookOpen className="h-3 w-3" /> Suggested Articles
      </div>
      {articles.map((article) => (
        <a
          key={article.id}
          href={`/super-admin/support/knowledge-base/${article.slug}`}
          className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 hover:underline"
        >
          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{article.title}</span>
        </a>
      ))}
    </div>
  );
}
