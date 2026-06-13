import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "./support-db";
import { evaluateAutomationRules } from "./support-automation-service";

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  billing: ["billing", "charge", "payment", "invoice", "receipt", "price", "cost", "fee", "subscription", "plan", "upgrade", "downgrade"],
  membership: ["membership", "plan", "join", "renewal", "expir", "cancel", "pause", "freeze", "upgrade", "downgrade"],
  payment_failure: ["payment failed", "declined", "card", "transaction failed", "insufficient", "payment error"],
  refund: ["refund", "money back", "return", "reversal", "credit"],
  trainer: ["trainer", "coach", "instructor", "personal training", "pt session", "training session"],
  equipment: ["equipment", "machine", "treadmill", "dumbbell", "weight", "bench", "cable", "broken", "not working"],
  facility: ["branch", "facility", "clean", "locker", "shower", "parking", "ac", "temperature"],
  access: ["access", "entry", "gate", "turnstile", "qr code", "biometric", "fingerprint", "rfid"],
  mobile_app: ["app", "mobile", "android", "ios", "login issue", "crash", "bug", "notification"],
  technical: ["technical", "error", "not working", "issue", "problem", "help", "support"],
};

const POSITIVE_WORDS = ["good", "great", "excellent", "amazing", "happy", "satisfied", "perfect", "love", "thank", "awesome", "wonderful", "fantastic", "best"];
const NEGATIVE_WORDS = ["bad", "terrible", "awful", "horrible", "angry", "frustrated", "disappointed", "worst", "poor", "hate", "useless", "dreadful", "pathetic", "unacceptable"];

export function autoCategorize(subject: string, description: string): string {
  const text = `${subject} ${description}`.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[category] = keywords.reduce((score, kw) => {
      const regex = new RegExp(kw.replace(/\s+/g, "\\s*"), "gi");
      const matches = (text.match(regex) ?? []).length;
      return score + matches;
    }, 0);
  }

  let bestCategory = "general_inquiry";
  let bestScore = 0;
  for (const [category, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

export function analyzeSentiment(text: string): { score: number; label: "positive" | "neutral" | "negative" } {
  const lower = text.toLowerCase();
  let score = 0;

  for (const word of POSITIVE_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    const matches = (lower.match(regex) ?? []).length;
    score += matches;
  }

  for (const word of NEGATIVE_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    const matches = (lower.match(regex) ?? []).length;
    score -= matches;
  }

  const exclamationCount = (text.match(/!/g) ?? []).length;
  const questionCount = (text.match(/\?/g) ?? []).length;
  score += exclamationCount * 0.5;
  score -= questionCount * 0.3;

  if (score > 0) return { score, label: "positive" };
  if (score < 0) return { score, label: "negative" };
  return { score, label: "neutral" };
}

export async function detectDuplicates(subject: string, description: string, organizationId: string): Promise<Array<{ id: string; ticketNumber: string; subject: string; score: number }>> {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const { data: openTickets } = await sdb
    .from("support_tickets")
    .select("id, ticket_number, subject, description")
    .eq("organization_id", organizationId)
    .in("status", ["open", "in_review", "in_progress", "waiting_on_customer"])
    .limit(20);

  if (!openTickets) return [];

  const currentText = `${subject} ${description}`.toLowerCase();
  const results: Array<{ id: string; ticketNumber: string; subject: string; score: number }> = [];

  for (const ticket of (openTickets as Array<Record<string, unknown>>)) {
    const ticketText = `${ticket.subject as string} ${ticket.description as string}`.toLowerCase();
    const words1 = new Set(currentText.split(/\s+/).filter((w) => w.length > 3));
    const words2 = new Set(ticketText.split(/\s+/).filter((w) => w.length > 3));

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    const score = union.size > 0 ? Math.round((intersection.size / union.size) * 100) : 0;

    if (score > 30) {
      results.push({
        id: ticket.id as string,
        ticketNumber: ticket.ticket_number as string,
        subject: ticket.subject as string,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 5);
}

export async function suggestResponse(subject: string, description: string, organizationId: string): Promise<string | null> {
  const category = autoCategorize(subject, description);
  const sentiment = analyzeSentiment(`${subject} ${description}`);

  if (category === "billing" || category === "payment_failure") {
    return "Thank you for reaching out about the billing issue. I'd be happy to help resolve this. Could you please provide the invoice or transaction ID so I can investigate further?";
  }

  if (category === "trainer") {
    return "I understand your concern about the trainer session. Let me look into this and get back to you with available options. Could you share the trainer's name and the date of the session?";
  }

  if (category === "equipment" || category === "facility") {
    return "Thank you for reporting this issue. We take facility and equipment maintenance seriously. I've logged this with our operations team and will follow up once resolved.";
  }

  if (category === "access" || category === "mobile_app") {
    return "I'm sorry you're having trouble with access. Let me check your account settings and member status to help resolve this. Could you confirm your member ID or registered phone number?";
  }

  if (category === "membership") {
    return "Thank you for your inquiry about your membership. I can help with plan changes, renewals, and other membership-related requests. What specific changes are you looking to make?";
  }

  if (sentiment.label === "negative") {
    return "I understand this is frustrating, and I apologize for the inconvenience. Let me personally take ownership of this issue and ensure it gets resolved promptly.";
  }

  return "Thank you for contacting support. I've reviewed your request and will work on getting this resolved. Let me start by looking into the details you've provided.";
}

export function generateSummary(ticket: Record<string, unknown>, messages: Array<Record<string, unknown>>): string {
  const subject = ticket.subject as string;
  const status = ticket.status as string;
  const priority = ticket.priority as string;
  const category = autoCategorize(subject, ticket.description as string);

  let sentiment = "neutral";
  let lastMessage = "";
  if (messages.length > 0) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg) lastMessage = lastMsg.body as string;
    const analysis = analyzeSentiment(lastMessage);
    sentiment = analysis.label;
  }

  const parts: string[] = [
    `Ticket #${ticket.ticket_number as string}: "${subject}"`,
    `Category: ${category} | Priority: ${priority} | Status: ${status}`,
    `Last message sentiment: ${sentiment}`,
  ];

  if (lastMessage) {
    parts.push(`Last message: "${lastMessage.slice(0, 120)}${lastMessage.length > 120 ? "..." : ""}"`);
  }

  return parts.join(" | ");
}

export async function getTrendingIssues(organizationId?: string) {
  const supabase = await createSupabaseServerClient();
  const sdb = db(supabase as unknown);

  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  let query = sdb.from("support_tickets").select("id, subject, description, created_at, category_id").gte("created_at", cutoff);

  if (organizationId) query = query.eq("organization_id", organizationId);

  const { data: tickets } = await query.limit(200);
  if (!tickets) return [];

  const categoryMap = new Map<string, { subjects: string[]; count: number }>();

  for (const ticket of (tickets as Array<Record<string, unknown>>)) {
    const category = autoCategorize(ticket.subject as string, ticket.description as string);
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { subjects: [], count: 0 });
    }
    const entry = categoryMap.get(category)!;
    entry.count++;
    if (entry.subjects.length < 5) {
      entry.subjects.push(ticket.subject as string);
    }
  }

  return [...categoryMap.entries()]
    .map(([category, data]) => ({ category, count: data.count, examples: data.subjects }))
    .sort((a, b) => b.count - a.count);
}
