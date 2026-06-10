type BrandedEmailInput = {
  title: string;
  preview: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export function renderBrandedEmail({ title, preview, body, ctaLabel, ctaUrl }: BrandedEmailInput) {
  const safeTitle = escapeHtml(title);
  const safePreview = escapeHtml(preview);
  const cta = ctaLabel && ctaUrl
    ? `<p style="margin:28px 0 0"><a href="${escapeAttribute(ctaUrl)}" style="display:inline-block;background:#111214;color:#ffffff;text-decoration:none;padding:13px 18px;border-radius:6px;font-weight:700">${escapeHtml(ctaLabel)}</a></p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;background:#f8f7f2;color:#111214;font-family:Inter,Arial,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden">${safePreview}</div>
    <main style="max-width:640px;margin:0 auto;padding:32px 18px">
      <section style="background:#ffffff;border:1px solid #d7dbd0;border-radius:8px;padding:32px">
        <p style="margin:0 0 18px;color:#737780;font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase">Apex Performance Club</p>
        <h1 style="margin:0;font-size:30px;line-height:1.15">${safeTitle}</h1>
        <div style="margin-top:18px;color:#34363a;font-size:16px;line-height:1.7">${body}</div>
        ${cta}
      </section>
      <p style="margin:18px 4px 0;color:#737780;font-size:12px;line-height:1.6">You are receiving this email because an Apex Performance Club account action was requested.</p>
    </main>
  </body>
</html>`;
}

export function welcomeEmail(fullName: string) {
  const displayName = escapeHtml(fullName || "there");
  return renderBrandedEmail({
    title: "Welcome to Apex Performance Club",
    preview: "Your member portal account has been created.",
    body: `<p>Hi ${displayName}, your member portal account is ready. Verify your email from the Supabase confirmation message, then sign in to manage your profile, membership, attendance, and class bookings.</p>`,
    ctaLabel: "Open Member Portal",
    ctaUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"}/login`
  });
}

export function passwordChangedEmail(fullName: string) {
  const displayName = escapeHtml(fullName || "there");
  return renderBrandedEmail({
    title: "Your password was changed",
    preview: "Security notice for your Apex account.",
    body: `<p>Hi ${displayName}, the password for your Apex account was changed. If you did not make this change, contact the gym team immediately.</p>`
  });
}

export function accountCreatedEmail(fullName: string, loginUrl: string) {
  const displayName = escapeHtml(fullName || "there");
  return renderBrandedEmail({
    title: "Your Apex account is ready",
    preview: "A team account has been created for you.",
    body: `<p>Hi ${displayName}, an Apex account has been created for you. Use the secure login page to complete access setup and verify your email before using staff tools.</p>`,
    ctaLabel: "Complete Account Setup",
    ctaUrl: loginUrl
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "#";
    }
    return escapeHtml(url.toString());
  } catch {
    return "#";
  }
}
