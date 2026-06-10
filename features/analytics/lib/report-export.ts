import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { AnalyticsReportPayload } from "@/types/analytics";
import { toCsv, toExcelHtml } from "./business-rules";

export function analyticsRowsToCsv(report: AnalyticsReportPayload) {
  return toCsv(report.headers, report.rows);
}

export function analyticsRowsToExcel(report: AnalyticsReportPayload) {
  return toExcelHtml({
    title: report.title,
    generatedAt: report.generatedAt,
    headers: report.headers,
    rows: report.rows
  });
}

export async function analyticsRowsToPdf(report: AnalyticsReportPayload) {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const pageSize: [number, number] = [842, 595];
  const margin = 36;
  const rowHeight = 22;
  const headerHeight = 24;
  const contentWidth = pageSize[0] - margin * 2;
  const columnWidth = contentWidth / Math.max(report.headers.length, 1);
  let page = pdf.addPage(pageSize);
  let y = drawHeader(page, report, bold, regular, pageSize, margin);
  y = drawTableHeader(page, report.headers, bold, columnWidth, margin, y, headerHeight);
  const rows = report.rows.length > 0 ? report.rows : [Object.fromEntries(report.headers.map((header, index) => [header, index === 0 ? "No records found" : ""]))];

  for (const row of rows) {
    if (y < margin + rowHeight) {
      page = pdf.addPage(pageSize);
      y = drawHeader(page, report, bold, regular, pageSize, margin);
      y = drawTableHeader(page, report.headers, bold, columnWidth, margin, y, headerHeight);
    }

    report.headers.forEach((header, index) => {
      const value = String(row[header] ?? "");
      page.drawText(fitText(value, regular, 7, columnWidth - 8), { x: margin + index * columnWidth + 4, y: y - 15, size: 7, font: regular, color: rgb(0.067, 0.071, 0.078) });
    });
    page.drawLine({ start: { x: margin, y: y - rowHeight + 4 }, end: { x: pageSize[0] - margin, y: y - rowHeight + 4 }, thickness: 0.4, color: rgb(0.86, 0.88, 0.84) });
    y -= rowHeight;
  }

  return pdf.save();
}

function drawHeader(page: PDFPage, report: AnalyticsReportPayload, bold: PDFFont, regular: PDFFont, pageSize: [number, number], margin: number) {
  const y = pageSize[1] - 38;
  page.drawText("Apex Performance Club", { x: margin, y, size: 16, font: bold, color: rgb(0.067, 0.071, 0.078) });
  page.drawText(report.title, { x: margin, y: y - 22, size: 10, font: regular, color: rgb(0.37, 0.39, 0.43) });
  page.drawText("ANALYTICS REPORT", { x: pageSize[0] - margin - 160, y, size: 14, font: bold, color: rgb(0.067, 0.071, 0.078) });
  page.drawText(`Generated ${safePdfText(report.generatedAt)}`, { x: pageSize[0] - margin - 165, y: y - 20, size: 8, font: regular, color: rgb(0.37, 0.39, 0.43) });
  return y - 48;
}

function drawTableHeader(page: PDFPage, headers: string[], bold: PDFFont, columnWidth: number, margin: number, y: number, height: number) {
  page.drawRectangle({ x: margin, y: y - height + 6, width: columnWidth * headers.length, height, color: rgb(0.94, 0.95, 0.92) });
  headers.forEach((header, index) => {
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
