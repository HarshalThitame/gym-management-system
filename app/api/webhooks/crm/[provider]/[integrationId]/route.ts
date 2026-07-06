import { NextResponse } from "next/server";
import { processCrmWebhookRequest, type CrmProviderId } from "@/features/integrations/services/crm-webhook-service";

function parseProvider(value: string): CrmProviderId | null {
  return value === "hubspot" || value === "zoho_crm" ? value : null;
}

export async function POST(request: Request, context: { params: Promise<{ provider: string; integrationId: string }> }) {
  try {
    const params = await context.params;
    const provider = parseProvider(params.provider);
    if (!provider) {
      return NextResponse.json({ error: "Unsupported CRM provider" }, { status: 404 });
    }

    const rawBody = await request.text();
    const result = await processCrmWebhookRequest({
      provider,
      integrationId: params.integrationId,
      request,
      rawBody,
    });

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      integrationId: result.integrationId,
      totalEvents: result.totalEvents,
      processed: result.processed,
      ignored: result.ignored,
      duplicates: result.duplicates,
      failed: result.failed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CRM webhook processing failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
