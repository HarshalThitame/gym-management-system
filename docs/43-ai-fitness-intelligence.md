# Phase 17 - AI Fitness Intelligence and AI Operations

## Scope

The platform now includes an AI layer for supervised smart coaching, member recommendations, predictive analytics, retention intelligence, forecast summaries, content drafting, RAG-ready knowledge storage, AI observability, and safety controls.

## Implemented Surface

- Database migration: `supabase/migrations/20260610120000_create_ai_intelligence_layer.sql`
- AI types: `types/ai.ts`
- Rule engine: `features/ai/lib/business-rules.ts`
- Safety layer: `features/ai/lib/safety.ts`
- Prompt layer: `features/ai/lib/prompt-layer.ts`
- OpenAI adapter: `features/ai/services/openai-service.ts`
- AI orchestration service: `features/ai/services/ai-service.ts`
- Server actions: `features/ai/actions/ai-actions.ts`
- API routes:
  - `POST /api/ai/chat`
  - `POST /api/ai/recommendations`
- Portal pages:
  - `/admin/ai`
  - `/member/ai-coach`
  - `/trainer/ai`

## AI Architecture

The AI layer is modular:

- Fitness profile engine computes engagement, churn risk, inferred level, and context summary from membership, attendance, class, workout, measurement, and nutrition data.
- Recommendation engine produces explainable workout, nutrition, class, and retention recommendations.
- Prediction engine uses deterministic scoring and forecast baselines for reliable fallback behavior.
- Prompt layer centralizes AI behavior and safety instructions.
- Knowledge base tables support policies, workouts, nutrition, trainer content, FAQs, and report chunks.
- Vector-ready chunks use pgvector for future semantic retrieval.
- OpenAI adapter calls the Responses API for text generation and embeddings API for vector preparation.

## Model Configuration

Environment variables:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_EMBEDDING_MODEL`

Defaults:

- Text: `gpt-5.4-mini`
- Embeddings: `text-embedding-3-small`

If no OpenAI key is configured, AI features return deterministic, safe fallback responses and record fallback observability when Supabase is configured.

## Safety and Compliance

Controls include:

- Prompt injection detection
- Sensitive data redaction
- Medical diagnosis and prescription blocking
- Guaranteed-result claim detection
- Human review required for workout plans, nutrition guidance, content drafts, and operational automation
- AI observability logs for feature, model, latency, token counts, status, and safety flags

The AI layer does not process card data and does not apply recommendations automatically.

## RAG Strategy

Knowledge documents are stored in `ai_knowledge_documents`. Chunks are stored in `ai_knowledge_chunks` with optional `extensions.vector(1536)` embeddings.

Current retrieval performs safe keyword fallback. Embedding generation is available through the OpenAI adapter for future background indexing once jobs are connected.

## Human Supervision

Statuses use explicit review flows:

- Recommendations: `draft`, `pending_review`, `approved`, `rejected`, `applied`, `archived`
- Program drafts: `pending_review`, `approved`, `rejected`, `converted`
- Content drafts: `pending_review`, `approved`, `rejected`, `published`
- Automation suggestions: `pending_review`, `approved`, `rejected`, `implemented`

## Testing

Unit tests cover:

- Engagement scoring
- Churn prediction
- Retention recommendations
- Forecast bounds
- Trainer matching
- Prompt safety
- Output validation

E2E tests cover protected AI route redirects and AI chat API authentication.

## Deployment Checklist

- Apply Phase 17 Supabase migration after the correct DB password is configured.
- Set `OPENAI_API_KEY` in Vercel production and preview environments.
- Keep `OPENAI_MODEL` and `OPENAI_EMBEDDING_MODEL` explicit for cost control.
- Run production build and route smoke tests after deployment.
- Add background indexing jobs before enabling semantic vector search at scale.
