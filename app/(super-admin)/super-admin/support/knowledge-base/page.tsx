import { Suspense } from "react";
import { requireRole } from "@/lib/auth/guards";
import { listKbArticles } from "@/features/support/services/support-knowledge-base-service";
import Link from "next/link";
import { FileText, ExternalLink } from "lucide-react";

async function KnowledgeBaseContent() {
  await requireRole(["super_admin"], "/super-admin");
  const { articles } = await listKbArticles({ pageSize: 100 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage internal SOPs, troubleshooting guides, and customer-facing articles.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {articles.length === 0 ? (
          <div className="col-span-full px-4 py-12 text-center text-sm text-muted-foreground">
            No articles yet. Create your first knowledge base article.
          </div>
        ) : (
          articles.map((article) => (
            <div key={article.id} className="rounded-lg border border-border bg-card p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{article.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{article.excerpt ?? article.body.slice(0, 120)}</p>
                  <div className="flex items-center gap-2 mt-2">
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
    </div>
  );
}

export default function KnowledgeBasePage() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted rounded-lg animate-pulse" />}>
      <KnowledgeBaseContent />
    </Suspense>
  );
}
