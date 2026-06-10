import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getAttendanceReportTable, type AttendanceReportPayload, type AttendanceReportTable } from "./csv";

export const attendanceReportFormats = ["csv", "excel", "pdf"] as const;
export type AttendanceReportFormat = (typeof attendanceReportFormats)[number];

export function attendanceRowsToExcel(report: AttendanceReportPayload) {
  const table = getAttendanceReportTable(report);
  const emptyRow = table.headers.map((_, index) => index === 0 ? "No records found" : "");
  const rows = table.rows.length > 0 ? table.rows : [emptyRow];

  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<style>",
    "body{font-family:Arial,sans-serif;color:#111315}",
    "h1{font-size:20px;margin:0 0 6px}",
    "p{font-size:12px;color:#5f646b;margin:0 0 16px}",
    "table{border-collapse:collapse;width:100%}",
    "th{background:#eef1ea;font-weight:700}",
    "th,td{border:1px solid #d8ddd2;padding:8px;text-align:left;font-size:12px;vertical-align:top}",
    "</style>",
    "</head>",
    "<body>",
    `<h1>${escapeHtml(table.title)}</h1>`,
    `<p>Generated at ${escapeHtml(table.generatedAt)}</p>`,
    "<table>",
    `<thead><tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>`,
    `<tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`,
    "</table>",
    "</body>",
    "</html>"
  ].join("");
}

export async function attendanceRowsToPdf(report: AttendanceReportPayload) {
  const table = getAttendanceReportTable(report);
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const pageSize: [number, number] = [842, 595];
  const margin = 36;
  const rowHeight = 22;
  const headerHeight = 24;
  const contentWidth = pageSize[0] - margin * 2;
  const columnWidths = getColumnWidths(table, contentWidth);
  let page = pdf.addPage(pageSize);
  let y = drawReportHeader(page, table, bold, regular, pageSize, margin);

  y = drawTableHeader(page, table, bold, columnWidths, margin, y, headerHeight);
  const rows = table.rows.length > 0 ? table.rows : [table.headers.map((_, index) => index === 0 ? "No records found" : "")];

  for (const row of rows) {
    if (y < margin + rowHeight) {
      page = pdf.addPage(pageSize);
      y = drawReportHeader(page, table, bold, regular, pageSize, margin);
      y = drawTableHeader(page, table, bold, columnWidths, margin, y, headerHeight);
    }

    let x = margin;
    row.forEach((cell, index) => {
      const width = columnWidths[index] ?? 80;
      page.drawText(fitText(cell, regular, 7, width - 8), { x: x + 4, y: y - 15, size: 7, font: regular, color: rgb(0.067, 0.071, 0.078) });
      x += width;
    });
    page.drawLine({ start: { x: margin, y: y - rowHeight + 4 }, end: { x: pageSize[0] - margin, y: y - rowHeight + 4 }, thickness: 0.4, color: rgb(0.86, 0.88, 0.84) });
    y -= rowHeight;
  }

  return pdf.save();
}

function drawReportHeader(page: PDFPage, table: AttendanceReportTable, bold: PDFFont, regular: PDFFont, pageSize: [number, number], margin: number) {
  const dark = rgb(0.067, 0.071, 0.078);
  const muted = rgb(0.37, 0.39, 0.43);
  const y = pageSize[1] - 38;

  page.drawText("Apex Performance Club", { x: margin, y, size: 16, font: bold, color: dark });
  page.drawText(table.title, { x: margin, y: y - 22, size: 10, font: regular, color: muted });
  page.drawText("ATTENDANCE REPORT", { x: pageSize[0] - margin - 165, y, size: 14, font: bold, color: dark });
  page.drawText(`Generated ${toPdfText(table.generatedAt)}`, { x: pageSize[0] - margin - 165, y: y - 20, size: 8, font: regular, color: muted });

  return y - 48;
}

function drawTableHeader(page: PDFPage, table: AttendanceReportTable, bold: PDFFont, widths: number[], margin: number, y: number, height: number) {
  page.drawRectangle({ x: margin, y: y - height + 6, width: widths.reduce((total, width) => total + width, 0), height, color: rgb(0.94, 0.95, 0.92) });
  let x = margin;

  table.headers.forEach((header, index) => {
    const width = widths[index] ?? 80;
    page.drawText(fitText(header, bold, 7, width - 8), { x: x + 4, y: y - 10, size: 7, font: bold, color: rgb(0.067, 0.071, 0.078) });
    x += width;
  });

  return y - height;
}

function getColumnWidths(table: AttendanceReportTable, contentWidth: number) {
  const weights = table.headers.includes("session_id")
    ? [1.15, 1.15, 1.15, 0.8, 1.5, 1.5, 0.75, 1, 1]
    : [1.1, 1.1, 0.65, 0.75, 0.75, 1.1, 2.7, 1.25];
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let remaining = contentWidth;

  return table.headers.map((_, index) => {
    if (index === table.headers.length - 1) {
      return remaining;
    }
    const width = Math.floor(contentWidth * ((weights[index] ?? 1) / totalWeight));
    remaining -= width;
    return width;
  });
}

function fitText(value: string, font: PDFFont, size: number, maxWidth: number) {
  const safe = toPdfText(value).replace(/\s+/g, " ").trim();
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) {
    return safe;
  }

  let fitted = safe;
  while (fitted.length > 0 && font.widthOfTextAtSize(`${fitted}...`, size) > maxWidth) {
    fitted = fitted.slice(0, -1);
  }

  return fitted.length > 0 ? `${fitted}...` : "";
}

function toPdfText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, " ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
