import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth/api-guards";
import { sendEmail } from "@/services/email/resend";

export async function POST(request: Request) {
  const auth = await requireApiAuth({});
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { to, brandName, primaryColor, accentColor, logoUrl, fromName } = body;

    if (!to) return NextResponse.json({ error: "Recipient email (to) is required" }, { status: 400 });

    const html = `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: ${primaryColor ?? "#111315"}; padding: 24px; text-align: center;">
          ${logoUrl ? `<img src="${logoUrl}" alt="" style="height: 40px;" />` : `<div style="height: 40px; width: 40px; background: rgba(255,255,255,0.2); border-radius: 8px; margin: 0 auto;"></div>`}
        </div>
        <div style="padding: 32px 24px; background: #ffffff;">
          <p style="font-size: 18px; font-weight: 700; color: ${primaryColor ?? "#111315"}; margin: 0 0 16px;">${fromName ?? brandName ?? "Brand"}</p>
          <p style="font-size: 14px; color: #374151; margin: 0 0 16px; line-height: 1.6;">This is a <strong>test email</strong> from the White Label branding module. Your email branding configuration is working correctly.</p>
          <p style="font-size: 14px; color: #374151; margin: 0 0 24px; line-height: 1.6;">Primary color: <span style="font-family: monospace;">${primaryColor ?? "#111315"}</span> &middot; Accent: <span style="font-family: monospace;">${accentColor ?? "#d7ff3f"}</span></p>
          <div style="background-color: ${accentColor ?? "#d7ff3f"}; color: #1a1a1a; padding: 12px 24px; border-radius: 6px; display: inline-block; font-size: 13px; font-weight: 600;">Test Call to Action</div>
          <p style="font-size: 12px; color: #9ca3af; margin: 24px 0 0; text-align: center;">&copy; ${new Date().getFullYear()} ${brandName ?? "Brand"} &middot; This is a test email from the White Label module.</p>
        </div>
      </div>
    `;

    const result = await sendEmail({ to, subject: `[Branding Test] ${brandName ?? "Brand"} — Email Branding Preview`, html });

    return NextResponse.json({ ok: result.sent, message: result.sent ? "Test email sent" : "Failed to send" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to send test email" }, { status: 400 });
  }
}
