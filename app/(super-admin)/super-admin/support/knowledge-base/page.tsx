import { Suspense } from "react";
import { requireRole } from "@/lib/auth/guards";
import { listKbArticles } from "@/features/support/services/support-knowledge-base-service";
import type { KbArticleWithCategory } from "@/features/support/services/support-knowledge-base-service";
import type { SupportTicketCategoryRow } from "@/types/enterprise";
import { KnowledgeBaseClient } from "./knowledge-base-client";

async function KnowledgeBaseContent() {
  await requireRole(["super_admin"], "/super-admin");
  const { articles, total } = await listKbArticles({ pageSize: 200 });

  const seen = new Map<string, SupportTicketCategoryRow>();
  for (const a of articles) {
    const cat = (a as unknown as KbArticleWithCategory).category;
    if (cat && !seen.has(cat.id)) seen.set(cat.id, cat);
  }
  const categories = Array.from(seen.values());

  return (
    <KnowledgeBaseClient
      articles={articles as unknown as KbArticleWithCategory[]}
      total={total}
      categories={categories}
    />
  );
}

export default function KnowledgeBasePage() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted rounded-lg animate-pulse" />}>
      <KnowledgeBaseContent />
    </Suspense>
  );
}
