import { formatCurrency, formatEnterpriseLabel } from "@/features/enterprise/lib/business-rules";
import {
  getGymBranchManagementData,
  normalizeGymBranchFilters,
  type GymBranchManagementData
} from "@/features/super-admin/services/gym-branch-management-service";
import { writeAuditLog } from "@/lib/audit";
import { requireApiRole } from "@/lib/auth/api-guards";

export async function GET(request: Request) {
  const auth = await requireApiRole(["super_admin"]);
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const filters = normalizeGymBranchFilters({
    query: url.searchParams.get("q") ?? "",
    organizationId: url.searchParams.get("organizationId") ?? "all",
    status: url.searchParams.get("status") ?? "all",
    page: 1,
    pageSize: 50
  });
  const data = await getAllGymBranchRecords(filters);
  const rows = registryRows(data);

  await writeAuditLog({
    actorId: auth.context.userId,
    gymId: auth.context.profile?.gym_id ?? null,
    action: "gym_branch.registry_exported",
    entityType: "gym_branch",
    entityId: null,
    metadata: { format, filters, rows: rows.length }
  });

  if (format === "pdf") {
    return pdfResponse(await buildPdf("Branch and Location Registry", rows), "branch-location-registry.pdf");
  }

  return csvResponse(rows, "branch-location-registry.csv");
}

async function getAllGymBranchRecords(filters: ReturnType<typeof normalizeGymBranchFilters>) {
  const gyms: GymBranchManagementData["gyms"] = [];
  const orphanBranches: GymBranchManagementData["orphanBranches"] = [];
  let approvalRequests: GymBranchManagementData["approvalRequests"] = [];
  let auditTimeline: GymBranchManagementData["auditTimeline"] = [];
  let page = 1;
  let totalPages = 1;
  let lastData: GymBranchManagementData | null = null;

  do {
    const data = await getGymBranchManagementData({ ...filters, page });
    gyms.push(...data.gyms);
    orphanBranches.push(...data.orphanBranches);
    approvalRequests = data.approvalRequests;
    auditTimeline = data.auditTimeline;
    totalPages = data.pagination.totalPages;
    lastData = data;
    page += 1;
  } while (page <= totalPages);

  return {
    gyms,
    orphanBranches,
    approvalRequests,
    auditTimeline,
    summary: lastData?.summary ?? null
  };
}

function registryRows(data: Awaited<ReturnType<typeof getAllGymBranchRecords>>) {
  const rows = [
    ["Type", "Organization", "Name", "Code/Slug", "Status", "Capacity", "Active Members", "Revenue", "Inside Now", "Warnings"]
  ];

  for (const node of data.gyms) {
    rows.push([
      "Location",
      node.organization?.name ?? "No organization",
      node.gym.name,
      node.gym.slug,
      formatEnterpriseLabel(node.gym.status),
      String(node.totalCapacity),
      String(node.metrics.activeMembers),
      formatCurrency(node.metrics.revenue),
      String(node.metrics.activeAttendanceSessions),
      node.warnings.map((warning) => `${warning.title}: ${warning.detail}`).join(" | ")
    ]);

    for (const branch of node.branches) {
      rows.push([
        "Branch",
        node.gym.name,
        branch.branch.name,
        branch.branch.branch_code,
        formatEnterpriseLabel(branch.branch.status),
        String(branch.branch.capacity),
        String(branch.metrics.activeMembers),
        formatCurrency(branch.metrics.revenue),
        String(branch.metrics.activeAttendanceSessions),
        branch.warnings.map((warning) => `${warning.title}: ${warning.detail}`).join(" | ")
      ]);
    }
  }

  for (const branch of data.orphanBranches) {
    rows.push([
      "Orphan Branch",
      branch.branch.organization_id,
      branch.branch.name,
      branch.branch.branch_code,
      formatEnterpriseLabel(branch.branch.status),
      String(branch.branch.capacity),
      String(branch.metrics.activeMembers),
      formatCurrency(branch.metrics.revenue),
      String(branch.metrics.activeAttendanceSessions),
      branch.warnings.map((warning) => `${warning.title}: ${warning.detail}`).join(" | ")
    ]);
  }

  rows.push([]);
  rows.push(["Pending Approval", "Organization", "Location", "Branch", "Action", "Requested By", "Reason", "Expires"]);
  for (const approval of data.approvalRequests) {
    rows.push([
      "Pending Approval",
      approval.organizationName ?? approval.organizationId,
      approval.gymName ?? approval.gymId ?? "",
      approval.branchName ?? approval.branchId ?? "",
      formatEnterpriseLabel(approval.action),
      approval.requestedByName ?? approval.requestedBy ?? "",
      approval.reason ?? "",
      approval.expiresAt
    ]);
  }

  rows.push([]);
  rows.push(["Audit", "Action", "Entity", "Actor", "Created At", "Metadata"]);
  for (const event of data.auditTimeline) {
    rows.push([
      "Audit",
      event.action,
      `${event.entityType}:${event.entityId ?? ""}`,
      event.actorName ?? event.actorEmail ?? event.actorId ?? "System",
      event.createdAt,
      JSON.stringify(event.metadata)
    ]);
  }

  return rows;
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
