"use client";

import { useState, useEffect, useMemo } from "react";
import { Sparkles, Brain, AlertTriangle, TrendingUp } from "lucide-react";

type SentimentResult = { score: number; label: "positive" | "neutral" | "negative" };
type DuplicateResult = { id: string; ticketNumber: string; subject: string; score: number };

export function SupportAiInsights({
  subject,
  description,
  organizationId,
  ticketId,
}: {
  subject: string;
  description: string;
  organizationId: string;
  ticketId: string;
}) {
  const [sentiment, setSentiment] = useState<SentimentResult | null>(null);
  const [category, setCategory] = useState<string>("");
  const [suggestedResponse, setSuggestedResponse] = useState<string>("");
  const [duplicates, setDuplicates] = useState<DuplicateResult[]>([]);
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function analyze() {
      try {
        const res = await fetch("/api/support/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, description, organizationId, ticketId }),
        });
        const data = await res.json();
        if (data.ok) {
          setSentiment(data.data.sentiment);
          setCategory(data.data.category);
          setSuggestedResponse(data.data.suggestedResponse);
          setDuplicates(data.data.duplicates);
          setSummary(data.data.summary);
        }
      } catch {} finally {
        setIsLoading(false);
      }
    }
    analyze();
  }, [subject, description, organizationId, ticketId]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-purple-500 animate-pulse" />
          <p className="text-xs font-semibold text-purple-600">AI Analyzing</p>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-purple-100 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-purple-100 rounded animate-pulse w-1/2" />
          <div className="h-3 bg-purple-100 rounded animate-pulse w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-purple-600" />
        <p className="text-xs font-semibold text-purple-700">AI Insights</p>
      </div>

      {category && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
            {category.replace(/_/g, " ")}
          </span>
          {sentiment && (
            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
              sentiment.label === "positive" ? "bg-green-100 text-green-700" :
              sentiment.label === "negative" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
            }`}>
              {sentiment.label}
            </span>
          )}
        </div>
      )}

      {sentiment && (
        <div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Sentiment Score</span>
            <span className={sentiment.score > 0 ? "text-green-600" : sentiment.score < 0 ? "text-red-600" : ""}>
              {sentiment.score > 0 ? "+" : ""}{sentiment.score.toFixed(1)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${
                sentiment.label === "positive" ? "bg-green-500" :
                sentiment.label === "negative" ? "bg-red-500" : "bg-gray-400"
              }`}
              style={{ width: `${Math.abs(sentiment.score) * 20 + 50}%` }}
            />
          </div>
        </div>
      )}

      {duplicates.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 mb-1">
            <AlertTriangle className="h-3 w-3" /> Possible Duplicates
          </div>
          {duplicates.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-[10px] py-0.5">
              <span className="truncate text-muted-foreground">{d.ticketNumber}: {d.subject.slice(0, 40)}</span>
              <span className="font-mono text-amber-600 shrink-0 ml-1">{d.score}%</span>
            </div>
          ))}
        </div>
      )}

      {suggestedResponse && (
        <div>
          <div className="flex items-center gap-1 text-[10px] font-semibold text-purple-700 mb-1">
            <Sparkles className="h-3 w-3" /> Suggested Response
          </div>
          <p className="text-[10px] text-muted-foreground bg-white rounded p-2 border border-purple-100">
            {suggestedResponse}
          </p>
          <button
            onClick={() => {/* Copy to clipboard or insert into reply */}}
            className="text-[10px] text-purple-600 hover:text-purple-700 font-medium mt-1"
          >
            Use this response
          </button>
        </div>
      )}
    </div>
  );
}
