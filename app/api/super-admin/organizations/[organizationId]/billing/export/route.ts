import { buildOrganizationBillingExportRows, csvEscape } from "@/features/super-admin/lib/org-billing-export";
import { getOrganizationDetailData } from "@/features/super-admin/services/organization-management-service";
import { writeAuditLog } from "@/lib/audit";
import { requireApiRole } from "@/lib/auth/api-guards";

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const auth = await requireApiRole(["super_admin"]);
  if (!auth.ok) {
    return auth.response;
  }

  const requestUrl = new URL(_request.url);
  const format = requestUrl.searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const { organizationId } = await context.params;
  const data = await getOrganizationDetailData(organizationId);

  if (!data) {
    return Response.json({ error: "Organization not found." }, { status: 404 });
  }

  const rows = buildOrganizationBillingExportRows(data);

  await writeAuditLog({
    actorId: auth.context.userId,
    gymId: auth.context.profile?.gym_id ?? null,
    action: "organization.billing_exported",
    entityType: "organization",
    entityId: organizationId,
    metadata: { rows: rows.length, format }
  });

  if (format === "pdf") {
    return pdfResponse(await buildPdf(`Organization Billing - ${data.record.organization.name}`, rows), `org-billing-${data.record.organization.slug}.pdf`);
  }

  return new Response(rows.map((row) => row.map(csvEscape).join(",")).join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="org-billing-${data.record.organization.slug}.csv"`
    }
  });
}

function pdfResponse(bytes: Uint8Array, filename: string) {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}

async function buildPdf(title: string, rows: string[][]) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([612, 792]);
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica);
  let y = 742;

  page.drawText(pdfSafeText(title), { x: 48, y, size: 18, font: titleFont, color: rgb(0.08, 0.08, 0.1) });
  y -= 28;

  for (const row of rows) {
    if (y < 64) {
      page = pdf.addPage([612, 792]);
      y = 742;
    }

    const line = row.map((item) => pdfSafeText(item)).join("  |  ").slice(0, 120);
    page.drawText(line, { x: 48, y, size: 8, font: bodyFont, color: rgb(0.22, 0.22, 0.25) });
    y -= 16;
  }

  return await pdf.save();
}

function pdfSafeText(value: string) {
  return value.replaceAll("₹", "INR ").replace(/[^\x20-\x7E]/g, " ");
}
