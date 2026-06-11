import { Resend } from "resend";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
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

export async function sendEmail({ to, subject, html }: SendEmailInput) {
  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL;

  if (!resend) {
    return { sent: false, reason: "Resend is not configured." };
  }

  if (!from) {
    return { sent: false, reason: "RESEND_FROM_EMAIL is not configured." };
  }

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html
  });

  if (error) {
    return { sent: false, reason: error.message };
  }

  return { sent: true, reason: null };
}
