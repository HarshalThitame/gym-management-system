import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Database } from "@/types/database";

export type ExportFormat = "csv" | "json" | "excel" | "pdf";

export type ExportConfig = {
  entityType: string;
  format: ExportFormat;
  filters?: Record<string, any>;
  columns?: string[];
  organizationId?: string;
  gymId?: string;
};

export type ExportResult = {
  data: string | Uint8Array;
  filename: string;
  mimeType: string;
};

// CSV Export
export async function exportToCsv(config: ExportConfig): Promise<ExportResult> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase.from(config.entityType).select("*");
  
  if (config.organizationId) {
    query = query.eq("organization_id", config.organizationId);
  }
  if (config.gymId) {
    query = query.eq("gym_id", config.gymId);
  }
  
  // Apply filters
  if (config.filters) {
    Object.entries(config.filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        query = query.eq(key, value);
      }
    });
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  if (!data || data.length === 0) {
    return {
      data: "No data to export",
      filename: `${config.entityType}-empty.csv`,
      mimeType: "text/csv"
    };
  }
  
  // Determine columns
  const columns = config.columns || Object.keys(data[0]);
  
  // Build CSV
  const header = columns.join(",");
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col];
      if (value === null || value === undefined) return "";
      if (typeof value === "string" && (value.includes(",") || value.includes('"') || value.includes("\n"))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    }).join(",")
  );
  
  const csv = [header, ...rows].join("\n");
  
  return {
    data: csv,
    filename: `${config.entityType}-${new Date().toISOString().split("T")[0]}.csv`,
    mimeType: "text/csv"
  };
}

// JSON Export
export async function exportToJson(config: ExportConfig): Promise<ExportResult> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase.from(config.entityType).select("*");
  
  if (config.organizationId) {
    query = query.eq("organization_id", config.organizationId);
  }
  if (config.gymId) {
    query = query.eq("gym_id", config.gymId);
  }
  
  if (config.filters) {
    Object.entries(config.filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        query = query.eq(key, value);
      }
    });
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  const json = JSON.stringify(data || [], null, 2);
  
  return {
    data: json,
    filename: `${config.entityType}-${new Date().toISOString().split("T")[0]}.json`,
    mimeType: "application/json"
  };
}

// Excel Export (using CSV with Excel-friendly formatting)
export async function exportToExcel(config: ExportConfig): Promise<ExportResult> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase.from(config.entityType).select("*");
  
  if (config.organizationId) {
    query = query.eq("organization_id", config.organizationId);
  }
  if (config.gymId) {
    query = query.eq("gym_id", config.gymId);
  }
  
  if (config.filters) {
    Object.entries(config.filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        query = query.eq(key, value);
      }
    });
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  if (!data || data.length === 0) {
    return {
      data: "No data to export",
      filename: `${config.entityType}-empty.csv`,
      mimeType: "text/csv"
    };
  }
  
  const columns = config.columns || Object.keys(data[0]);
  
  // Excel-friendly CSV with UTF-8 BOM
  const BOM = "\uFEFF";
  const header = columns.join(",");
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col];
      if (value === null || value === undefined) return "";
      if (typeof value === "string") {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    }).join(",")
  );
  
  const excel = BOM + [header, ...rows].join("\n");
  
  return {
    data: excel,
    filename: `${config.entityType}-${new Date().toISOString().split("T")[0]}.csv`,
    mimeType: "text/csv"
  };
}

// PDF Export
export async function exportToPdf(config: ExportConfig): Promise<ExportResult> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase.from(config.entityType).select("*");
  
  if (config.organizationId) {
    query = query.eq("organization_id", config.organizationId);
  }
  if (config.gymId) {
    query = query.eq("gym_id", config.gymId);
  }
  
  if (config.filters) {
    Object.entries(config.filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        query = query.eq(key, value);
      }
    });
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const { height } = page.getSize();
  let y = height - 50;
  
  // Title
  page.drawText(`${config.entityType.charAt(0).toUpperCase() + config.entityType.slice(1)} Export`, {
    x: 50,
    y,
    size: 20,
    font: boldFont,
    color: rgb(0, 0, 0)
  });
  
  y -= 20;
  page.drawText(`Generated: ${new Date().toLocaleString()}`, {
    x: 50,
    y,
    size: 10,
    font,
    color: rgb(0.5, 0.5, 0.5)
  });
  
  y -= 30;
  
  if (!data || data.length === 0) {
    page.drawText("No data to export", {
      x: 50,
      y,
      size: 12,
      font,
      color: rgb(0.5, 0.5, 0.5)
    });
  } else {
    const columns = config.columns || Object.keys(data[0]).slice(0, 6); // Limit columns for PDF
    const colWidth = 80;
    
    // Header
    columns.forEach((col, i) => {
      page.drawText(col.charAt(0).toUpperCase() + col.slice(1), {
        x: 50 + i * colWidth,
        y,
        size: 9,
        font: boldFont,
        color: rgb(0, 0, 0)
      });
    });
    
    y -= 15;
    
    // Draw line
    page.drawLine({
      start: { x: 50, y: y + 5 },
      end: { x: 540, y: y + 5 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8)
    });
    
    // Data rows
    for (const row of data.slice(0, 30)) { // Limit to 30 rows
      if (y < 50) {
        // New page
        const newPage = pdfDoc.addPage([595, 842]);
        y = 842 - 50;
      }
      
      columns.forEach((col, i) => {
        const value = row[col];
        const text = value === null || value === undefined ? "" : String(value).substring(0, 15);
        newPage.drawText(text, {
          x: 50 + i * colWidth,
          y,
          size: 8,
          font,
          color: rgb(0.2, 0.2, 0.2)
        });
      });
      
      y -= 12;
    }
    
    if (data.length > 30) {
      page.drawText(`... and ${data.length - 30} more rows`, {
        x: 50,
        y: y - 10,
        size: 9,
        font,
        color: rgb(0.5, 0.5, 0.5)
      });
    }
  }
  
  const pdfBytes = await pdfDoc.save();
  
  return {
    data: pdfBytes,
    filename: `${config.entityType}-${new Date().toISOString().split("T")[0]}.pdf`,
    mimeType: "application/pdf"
  };
}

// Main export function
export async function exportData(config: ExportConfig): Promise<ExportResult> {
  switch (config.format) {
    case "csv":
      return exportToCsv(config);
    case "json":
      return exportToJson(config);
    case "excel":
      return exportToExcel(config);
    case "pdf":
      return exportToPdf(config);
    default:
      throw new Error(`Unsupported export format: ${config.format}`);
  }
}
