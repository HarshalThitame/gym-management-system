import { formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import {
  getOrganizationDetailData,
  getOrganizationManagementData,
  normalizeAuditFilters,
  normalizeOrganizationFilters,
  type OrganizationSortOption,
  type OrganizationAuditTimelineItem
} from "@/features/super-admin/services/organization-management-service";
import { writeAuditLog } from "@/lib/audit";
import { requireApiRole } from "@/lib/auth/api-guards";

export async function GET(request: Request) {
  const auth = await requireApiRole(["super_admin"]);
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const scope = url.searchParams.get("scope") === "audit" ? "audit" : "registry";

  if (scope === "audit") {
    const organizationId = url.searchParams.get("organizationId");
    if (!organizationId) {
      return Response.json({ error: "organizationId is required for audit export." }, { status: 400 });
    }

    const data = await getOrganizationDetailData(organizationId, normalizeAuditFilters({
      query: url.searchParams.get("auditQ") ?? "",
      severity: url.searchParams.get("severity") ?? "all",
      source: url.searchParams.get("source") ?? "all"
    }));

    if (!data) {
      return Response.json({ error: "Organization not found." }, { status: 404 });
    }

    const rows = auditRows(data.auditTimeline);
    await writeAuditLog({
      actorId: auth.context.userId,
      gymId: auth.context.profile?.gym_id ?? null,
      action: "organization.audit_exported",
      entityType: "organization",
      entityId: organizationId,
      metadata: { format, rows: rows.length }
    });

    if (format === "pdf") {
      return pdfResponse(await buildPdf(`Organization Audit - ${data.record.organization.name}`, rows), `organization-audit-${data.record.organization.slug}.pdf`);
    }

    return csvResponse(rows, `organization-audit-${data.record.organization.slug}.csv`);
  }

  const baseFilters = normalizeOrganizationFilters({
    query: url.searchParams.get("q") ?? "",
    status: url.searchParams.get("status") ?? "all",
    sort: url.searchParams.get("sort") as OrganizationSortOption,
    page: 1,
    pageSize: 5000
  }, 5000);
  const records = await getAllRegistryRecordsForExport(baseFilters);
  const rows = registryRows(records);

  await writeAuditLog({
    actorId: auth.context.userId,
    gymId: auth.context.profile?.gym_id ?? null,
    action: "organization.registry_exported",
    entityType: "organization",
    entityId: null,
    metadata: { format, filters: baseFilters, rows: rows.length }
  });

  if (format === "pdf") {
    return pdfResponse(await buildPdf("Organization Registry", rows), "organization-registry.pdf");
  }

  return csvResponse(rows, "organization-registry.csv");
}

function registryRows(records: Awaited<ReturnType<typeof getOrganizationManagementData>>["records"]) {
  return [
    ["Organization", "Slug", "Status", "Owner", "Package", "Subscription", "Health", "Gyms", "Branches", "Active Members", "Revenue", "Domains"],
    ...records.map((record) => [
      record.organization.name,
      record.organization.slug,
      formatEnterpriseLabel(record.organization.status),
      record.owner?.fullName ?? "Unassigned",
      record.subscription.packageName ?? "Unassigned",
      record.subscription.status ? formatEnterpriseLabel(record.subscription.status) : "Unassigned",
      `${record.health.score}/100 ${record.health.label}`,
      String(record.usage.gyms),
      String(record.usage.branches),
      String(record.usage.activeMembers),
      formatCurrency(record.usage.revenue),
      String(record.usage.domains)
    ])
  ];
}

function auditRows(events: OrganizationAuditTimelineItem[]) {
  return [
    ["Date", "Severity", "Source", "Action", "Actor", "Actor Email", "IP Address", "User Agent", "Entity", "Metadata"],
    ...events.map((event) => [
      event.createdAt,
      event.severity,
      event.source,
      event.action,
      event.actorName ?? event.actorId ?? "System",
      event.actorEmail ?? "",
      event.ipAddress ?? "",
      event.userAgent ?? "",
      `${event.entityType}:${event.entityId ?? ""}`,
      JSON.stringify(event.metadata)
    ])
  ];
}

async function getAllRegistryRecordsForExport(filters: ReturnType<typeof normalizeOrganizationFilters>) {
  const records: Awaited<ReturnType<typeof getOrganizationManagementData>>["records"] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const data = await getOrganizationManagementData(undefined, {
      ...filters,
      page,
      pageSize: filters.pageSize
    });
    records.push(...data.records);
    totalPages = data.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);

  return records;
}

function csvResponse(rows: string[][], filename: string) {
  return new Response(rows.map((row) => row.map(csvEscape).join(",")).join("\n"), {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8"
    }
  });
}

function pdfResponse(bytes: Uint8Array, filename: string) {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/pdf"
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
  y -= 32;

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

function csvEscape(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function pdfSafeText(value: string) {
  return value
    .replaceAll("₹", "INR ")
    .replace(/[^\x20-\x7E]/g, " ");
}
