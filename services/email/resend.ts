import { Resend } from "resend";

type EmailAttachment = {
  filename: string;
  content: string;
};

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  from?: string | undefined;
  replyTo?: string | undefined;
  cc?: string[];
  attachments?: EmailAttachment[];
};

let resendClient: Resend | null = null;

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return null;
  }

  resendClient ??= new Resend(apiKey);
  return resendClient;
}

export async function sendEmail({ to, subject, html, from, replyTo, cc }: SendEmailInput) {
  const resend = getResendClient();
  const fromAddress = from || process.env.RESEND_FROM_EMAIL;

  if (!resend) {
    return { sent: false, reason: "Resend is not configured." };
  }

  if (!fromAddress) {
    return { sent: false, reason: "No from address configured. Set RESEND_FROM_EMAIL env var or pass a `from` address." };
  }

  const payload: Record<string, unknown> = {
    from: fromAddress,
    to,
    subject,
    html,
  };

  if (replyTo) {
    payload.reply_to = replyTo;
  }

  if (cc && cc.length > 0) {
    payload.cc = cc;
  }

  if (input.attachments && input.attachments.length > 0) {
    payload.attachments = input.attachments;
  }

  const { error } = await resend.emails.send(payload as never);

  if (error) {
    return { sent: false, reason: error.message };
  }

  return { sent: true, reason: null };
}
