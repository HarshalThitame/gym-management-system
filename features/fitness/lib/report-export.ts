import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getFitnessReportTable, type FitnessReportPayload, type FitnessReportTable } from "./csv";

export const fitnessReportFormats = ["csv", "excel", "pdf"] as const;
export type FitnessReportFormat = (typeof fitnessReportFormats)[number];

export function fitnessRowsToExcel(report: FitnessReportPayload) {
  const table = getFitnessReportTable(report);
  const rows = table.rows.length > 0 ? table.rows : [table.headers.map((_, index) => index === 0 ? "No records found" : "")];
  return [
    "<!doctype html><html><head><meta charset=\"utf-8\" />",
    "<style>body{font-family:Arial,sans-serif;color:#111315}h1{font-size:20px;margin:0 0 6px}p{font-size:12px;color:#5f646b}table{border-collapse:collapse;width:100%}th{background:#eef1ea;font-weight:700}th,td{border:1px solid #d8ddd2;padding:8px;text-align:left;font-size:12px;vertical-align:top}</style>",
    "</head><body>",
    `<h1>${escapeHtml(table.title)}</h1><p>Generated at ${escapeHtml(table.generatedAt)}</p>`,
    `<table><thead><tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>`,
    `<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
    "</body></html>"
  ].join("");
}

export async function fitnessRowsToPdf(report: FitnessReportPayload) {
  const table = getFitnessReportTable(report);
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const pageSize: [number, number] = [842, 595];
  const margin = 36;
  const rowHeight = 22;
  const headerHeight = 24;
  const contentWidth = pageSize[0] - margin * 2;
  const columnWidth = contentWidth / table.headers.length;
  let page = pdf.addPage(pageSize);
  let y = drawHeader(page, table, bold, regular, pageSize, margin);
  y = drawTableHeader(page, table, bold, columnWidth, margin, y, headerHeight);
  const rows = table.rows.length > 0 ? table.rows : [table.headers.map((_, index) => index === 0 ? "No records found" : "")];

  for (const row of rows) {
    if (y < margin + rowHeight) {
      page = pdf.addPage(pageSize);
      y = drawHeader(page, table, bold, regular, pageSize, margin);
      y = drawTableHeader(page, table, bold, columnWidth, margin, y, headerHeight);
    }
    row.forEach((cell, index) => {
      page.drawText(fitText(cell, regular, 7, columnWidth - 8), { x: margin + index * columnWidth + 4, y: y - 15, size: 7, font: regular, color: rgb(0.067, 0.071, 0.078) });
    });
    page.drawLine({ start: { x: margin, y: y - rowHeight + 4 }, end: { x: pageSize[0] - margin, y: y - rowHeight + 4 }, thickness: 0.4, color: rgb(0.86, 0.88, 0.84) });
    y -= rowHeight;
  }

  return pdf.save();
}

function drawHeader(page: PDFPage, table: FitnessReportTable, bold: PDFFont, regular: PDFFont, pageSize: [number, number], margin: number) {
  const y = pageSize[1] - 38;
  page.drawText("Apex Performance Club", { x: margin, y, size: 16, font: bold, color: rgb(0.067, 0.071, 0.078) });
  page.drawText(table.title, { x: margin, y: y - 22, size: 10, font: regular, color: rgb(0.37, 0.39, 0.43) });
  page.drawText("FITNESS REPORT", { x: pageSize[0] - margin - 142, y, size: 14, font: bold, color: rgb(0.067, 0.071, 0.078) });
  page.drawText(`Generated ${safePdfText(table.generatedAt)}`, { x: pageSize[0] - margin - 165, y: y - 20, size: 8, font: regular, color: rgb(0.37, 0.39, 0.43) });
  return y - 48;
}

function drawTableHeader(page: PDFPage, table: FitnessReportTable, bold: PDFFont, columnWidth: number, margin: number, y: number, height: number) {
  page.drawRectangle({ x: margin, y: y - height + 6, width: columnWidth * table.headers.length, height, color: rgb(0.94, 0.95, 0.92) });
  table.headers.forEach((header, index) => {
    page.drawText(fitText(header, bold, 7, columnWidth - 8), { x: margin + index * columnWidth + 4, y: y - 10, size: 7, font: bold, color: rgb(0.067, 0.071, 0.078) });
  });
  return y - height;
}

function fitText(value: string, font: PDFFont, size: number, maxWidth: number) {
  const safe = safePdfText(value).replace(/\s+/g, " ").trim();
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) {
    return safe;
  }
  let fitted = safe;
  while (fitted.length > 0 && font.widthOfTextAtSize(`${fitted}...`, size) > maxWidth) {
    fitted = fitted.slice(0, -1);
  }
  return fitted.length > 0 ? `${fitted}...` : "";
}

function safePdfText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, " ");
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
}
