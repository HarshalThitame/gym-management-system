type CommunicationEmailInput = {
  title: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

export function communicationEmail({ title, bodyHtml, ctaLabel, ctaUrl }: CommunicationEmailInput) {
  const action = ctaLabel && ctaUrl
    ? `<p style="margin:28px 0"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#111315;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:700">${escapeHtml(ctaLabel)}</a></p>`
    : "";

  return [
    "<!doctype html>",
    "<html>",
    "<body style=\"margin:0;background:#f5f6f2;font-family:Arial,sans-serif;color:#111315\">",
    "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#f5f6f2;padding:28px 12px\">",
    "<tr><td align=\"center\">",
    "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:640px;background:#ffffff;border:1px solid #d8ddd2;border-radius:12px;overflow:hidden\">",
    "<tr><td style=\"padding:28px 28px 12px\">",
    "<p style=\"margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#5f646b;font-weight:800\">Apex Performance Club</p>",
    `<h1 style="margin:0;font-size:28px;line-height:1.15;color:#111315">${escapeHtml(title)}</h1>`,
    "</td></tr>",
    `<tr><td style="padding:12px 28px 4px;font-size:15px;line-height:1.7;color:#30343a">${bodyHtml}</td></tr>`,
    `<tr><td style="padding:0 28px 28px">${action}<p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#747980">You are receiving this message because your gym account has communication preferences enabled.</p></td></tr>`,
    "</table>",
    "</td></tr>",
    "</table>",
    "</body>",
    "</html>"
  ].join("");
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
}
