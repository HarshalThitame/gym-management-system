"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, Search, X } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import type { KbArticleWithCategory } from "@/features/support/services/support-knowledge-base-service";
import type { SupportTicketCategoryRow } from "@/types/enterprise";

const KB_TYPES = ["guide", "faq", "api", "troubleshooting", "internal", "customer"] as const;
const KB_STATUSES = ["published", "draft", "archived"] as const;
const PAGE_SIZE = 12;

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function KnowledgeBaseClient({
  articles,
  total: _total,
  categories,
}: {
  articles: KbArticleWithCategory[];
  total: number;
  categories: SupportTicketCategoryRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("category") ?? "");
  const [typeFilter, setTypeFilter] = useState(searchParams.get("type") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);

  const debouncedSearch = useDebounce(search, 300);

  const syncUrl = useCallback((params: Record<string, string>) => {
    const p = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v) p.set(k, v);
      else p.delete(k);
    });
    router.push(`/super-admin/support/knowledge-base?${p.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const filtered = useMemo(() => {
    let result = [...articles];
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((a) =>
        a.title.toLowerCase().includes(q) ||
        (a.excerpt ?? a.body).toLowerCase().includes(q)
      );
    }
    if (categoryFilter) {
      result = result.filter((a) => a.category_id === categoryFilter);
    }
    if (typeFilter) {
      result = result.filter((a) => a.article_type === typeFilter);
    }
    if (statusFilter) {
      result = result.filter((a) => a.status === statusFilter);
    }
    return result;
  }, [articles, debouncedSearch, categoryFilter, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
    syncUrl({ q: val, page: "" });
  }, [syncUrl]);

  const handleCategoryChange = useCallback((val: string) => {
    setCategoryFilter(val);
    setPage(1);
    syncUrl({ category: val, page: "" });
  }, [syncUrl]);

  const handleTypeChange = useCallback((val: string) => {
    setTypeFilter(val);
    setPage(1);
    syncUrl({ type: val, page: "" });
  }, [syncUrl]);

  const handleStatusChange = useCallback((val: string) => {
    setStatusFilter(val);
    setPage(1);
    syncUrl({ status: val, page: "" });
  }, [syncUrl]);

  const handlePageChange = useCallback((p: number) => {
    setPage(p);
    syncUrl({ page: String(p > 1 ? p : "") });
  }, [syncUrl]);

  const hasActiveFilters = debouncedSearch || categoryFilter || typeFilter || statusFilter;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage internal SOPs, troubleshooting guides, and customer-facing articles.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by title or content..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-8 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all"
          />
          {search && (
            <button onClick={() => handleSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {categories.length > 0 && (
          <select value={categoryFilter} onChange={(e) => handleCategoryChange(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs min-w-[130px] focus:outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <select value={typeFilter} onChange={(e) => handleTypeChange(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs min-w-[120px] focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">All Types</option>
          {KB_TYPES.map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => handleStatusChange(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs min-w-[120px] focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">All Statuses</option>
          {KB_STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {paginated.length === 0 ? (
          <div className="col-span-full px-4 py-12 text-center text-sm text-muted-foreground">
            {hasActiveFilters
              ? "No articles match your search or filters."
              : "No articles yet. Create your first knowledge base article."}
          </div>
        ) : (
          paginated.map((article, idx) => (
            <div
              key={article.id}
              className="rounded-lg border border-border bg-card p-4 hover:shadow-sm transition-shadow reveal-up"
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{article.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{article.excerpt ?? article.body.slice(0, 120)}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {article.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-muted text-muted-foreground">
                        {article.category.name}
                      </span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      article.article_type === "customer" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {article.article_type}
                    </span>
                    <span className="text-[10px] text-muted-foreground capitalize">{article.status}</span>
                    <span className="text-[10px] text-muted-foreground">{article.view_count} views</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          pageSize={PAGE_SIZE}
          totalItems={filtered.length}
        />
      )}
    </div>
  );
}
