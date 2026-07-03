import "server-only";

import { sendEmail as resendSendEmail } from "@/services/email/resend";
import {
  getIntegrationByProvider,
  type IntegrationProviderId,
} from "@/features/integrations/services/integrations-service";
import {
  sendMsg91Sms,
  sendMsg91WhatsAppTemplate,
} from "@/features/integrations/services/msg91-service";
import type { Json } from "@/types/database";

type SendResult = { ok: boolean; error?: string };

function coerceObject(value: Json | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stripMarkup(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getConnectedIntegration(
  organizationId: string,
  provider: IntegrationProviderId,
) {
  const integration = await getIntegrationByProvider(organizationId, provider);
  if (!integration || integration.status !== "connected") {
    return null;
  }
  return integration;
}

export async function sendCampaignEmail(params: {
  to: string;
  subject: string;
  body: string;
  from?: string;
  replyTo?: string;
}): Promise<SendResult> {
  const r = await resendSendEmail({
    to: params.to,
    subject: params.subject,
    html: params.body,
    ...(params.from ? { from: params.from } : {}),
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
  });
  if (!r.sent) return { ok: false, error: r.reason ?? "Email failed" };
  return { ok: true };
}

export async function sendCampaignSms(params: {
  organizationId: string;
  to: string;
  message: string;
}): Promise<SendResult> {
  const integration = await getConnectedIntegration(params.organizationId, "msg91_sms");
  if (!integration) {
    return { ok: false, error: "MSG91 SMS is not connected for this organization." };
  }

  const credentials = coerceObject(integration.credentials);
  const config = coerceObject(integration.config);
  const authKey = typeof credentials.authKey === "string" ? credentials.authKey : "";
  const flowId = typeof config.flowId === "string" ? config.flowId : "";
  const senderId = typeof config.senderId === "string" ? config.senderId : undefined;

  if (!authKey || !flowId) {
    return { ok: false, error: "MSG91 SMS configuration is incomplete." };
  }

  const result = await sendMsg91Sms({
    authKey,
    flowId,
    senderId,
    mobile: params.to,
    variables: {
      VAR1: stripMarkup(params.message),
    },
  });

  return result.ok ? { ok: true } : { ok: false, error: result.message };
}

export async function sendCampaignWhatsApp(params: {
  organizationId: string;
  to: string;
  message: string;
}): Promise<SendResult> {
  const integration = await getConnectedIntegration(params.organizationId, "msg91_whatsapp");
  if (!integration) {
    return { ok: false, error: "MSG91 WhatsApp is not connected for this organization." };
  }

  const credentials = coerceObject(integration.credentials);
  const config = coerceObject(integration.config);
  const authKey = typeof credentials.authKey === "string" ? credentials.authKey : "";
  const integratedNumber = typeof config.integratedNumber === "string" ? config.integratedNumber : "";
  const namespace = typeof config.namespace === "string" ? config.namespace : "";
  const templateName = typeof config.templateName === "string" ? config.templateName : "";
  const languageCode = typeof config.languageCode === "string" ? config.languageCode : "en";

  if (!authKey || !integratedNumber || !namespace || !templateName) {
    return { ok: false, error: "MSG91 WhatsApp configuration is incomplete." };
  }

  const result = await sendMsg91WhatsAppTemplate({
    authKey,
    integratedNumber,
    recipientNumber: params.to,
    namespace,
    templateName,
    languageCode,
    bodyVariables: {
      body_1: stripMarkup(params.message),
    },
  });

  return result.ok ? { ok: true } : { ok: false, error: result.message };
}

export async function sendViaChannel(
  organizationId: string,
  channel: string,
  recipient: string,
  subject: string,
  body: string,
  emailFrom?: string,
  emailReplyTo?: string,
): Promise<SendResult> {
  switch (channel) {
    case "email":
      return sendCampaignEmail({ to: recipient, subject, body, ...(emailFrom ? { from: emailFrom } : {}), ...(emailReplyTo ? { replyTo: emailReplyTo } : {}) });
    case "sms":
      return sendCampaignSms({ organizationId, to: recipient, message: body });
    case "whatsapp":
      return sendCampaignWhatsApp({ organizationId, to: recipient, message: body });
    default:
      return { ok: false, error: `Unknown channel: ${channel}` };
  }
}
