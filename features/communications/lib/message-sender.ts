import { sendEmail as resendSendEmail } from "@/services/email/resend";

type SendResult = { ok: boolean; error?: string };

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
    from: params.from,
    replyTo: params.replyTo,
  });
  if (!r.sent) return { ok: false, error: r.reason ?? "Email failed" };
  return { ok: true };
}

export async function sendCampaignSms(_params: {
  to: string;
  message: string;
}): Promise<SendResult> {
  return { ok: false, error: "SMS provider not configured" };
}

export async function sendCampaignWhatsApp(_params: {
  to: string;
  message: string;
}): Promise<SendResult> {
  return { ok: false, error: "WhatsApp provider not configured" };
}

export async function sendViaChannel(
  channel: string,
  recipient: string,
  subject: string,
  body: string,
  emailFrom?: string,
  emailReplyTo?: string,
): Promise<SendResult> {
  switch (channel) {
    case "email":
      return sendCampaignEmail({ to: recipient, subject, body, from: emailFrom, replyTo: emailReplyTo });
    case "sms":
      return sendCampaignSms({ to: recipient, message: body });
    case "whatsapp":
      return sendCampaignWhatsApp({ to: recipient, message: body });
    default:
      return { ok: false, error: `Unknown channel: ${channel}` };
  }
}
