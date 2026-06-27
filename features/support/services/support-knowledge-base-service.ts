import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "./support-db";
import type { SupportKnowledgeBaseArticleRow, SupportTicketCategoryRow } from "@/types/enterprise";

export type KbArticleWithCategory = SupportKnowledgeBaseArticleRow & {
  category?: SupportTicketCategoryRow | null;
};

export type KbListOptions = {
  organizationId?: string;
  articleType?: string;
  status?: string;
  categoryId?: string;
  search?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
};

export async function listKbArticles(options: KbListOptions = {}) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const page = options.page ?? 1;
  const pageSize = Math.min(options.pageSize ?? 25, 100);
  const offset = (page - 1) * pageSize;

  let q = sdb.from("support_knowledge_base_articles").select("*, category:support_ticket_categories(*)", { count: "exact" });
  if (options.organizationId) q = q.eq("organization_id", options.organizationId);
  if (options.articleType) q = q.eq("article_type", options.articleType);
  if (options.status) q = q.eq("status", options.status);
  if (options.categoryId) q = q.eq("category_id", options.categoryId);
  if (options.search) {
    q = q.or(`title.ilike.%${options.search}%,body.ilike.%${options.search}%`);
  }
  if (options.tags && options.tags.length > 0) {
    q = q.contains("tags", options.tags);
  }

  const { data, error, count } = await q.order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);
  if (error) throw new Error(error.message);
  return { articles: (data as unknown as KbArticleWithCategory[]), total: count ?? 0, page, pageSize };
}

export async function getKbArticle(slug: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const { data, error } = await sdb.from("support_knowledge_base_articles").select("*").eq("slug", slug).single();
  if (error) throw new Error(error.message);

  await sdb.from("support_knowledge_base_articles").update({ view_count: (data as Record<string, unknown>).view_count as number + 1 }).eq("id", (data as Record<string, unknown>).id);
  return data as unknown as SupportKnowledgeBaseArticleRow;
}

export async function createKbArticle(input: {
  organizationId?: string;
  categoryId?: string;
  title: string;
  body: string;
  articleType?: string;
  audience?: string[];
  tags?: string[];
  status?: string;
  authorId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { data, error } = await sdb.from("support_knowledge_base_articles").insert({
    organization_id: input.organizationId ?? null,
    category_id: input.categoryId ?? null,
    title: input.title,
    slug,
    body: input.body,
    article_type: input.articleType ?? "internal",
    audience: input.audience ?? [],
    tags: input.tags ?? [],
    status: input.status ?? "draft",
    author_id: input.authorId,
    published_at: input.status === "published" ? new Date().toISOString() : null,
  }).select("*").single();
  if (error) throw new Error(error.message);
  return data as unknown as SupportKnowledgeBaseArticleRow;
}

export async function updateKbHelpfulness(articleId: string, helpful: boolean) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);
  const field = helpful ? "helpful_count" : "not_helpful_count";
  const { data: article } = await sdb.from("support_knowledge_base_articles").select(field).eq("id", articleId).single();
  if (!article) return;
  await sdb.from("support_knowledge_base_articles").update({
    [field]: ((article as Record<string, unknown>)[field] as number) + 1,
  }).eq("id", articleId);
}
