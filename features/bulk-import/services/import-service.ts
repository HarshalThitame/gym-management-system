import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ImportConfig = {
  entityType: string;
  data: Record<string, any>[];
  organizationId?: string;
  gymId?: string;
  createdBy: string;
  upsert?: boolean;
  conflictKeys?: string[];
};

export type ImportResult = {
  success: boolean;
  total: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
};

// Parse CSV content
export function parseCsv(csvContent: string): Record<string, any>[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  // Handle BOM for Excel files
  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const headers = parseCsvLine(headerLine);
  
  const data: Record<string, any>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCsvLine(line);
    const row: Record<string, any> = {};
    
    headers.forEach((header, index) => {
      const value = values[index];
      row[header] = value === "" ? null : value;
    });
    
    data.push(row);
  }
  
  return data;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Import data
export async function importData(config: ImportConfig): Promise<ImportResult> {
  const supabase = getSupabaseAdminClient();
  
  const result: ImportResult = {
    success: true,
    total: config.data.length,
    imported: 0,
    failed: 0,
    errors: []
  };
  
  // Add organization and gym IDs if provided
  const dataToImport = config.data.map(row => ({
    ...row,
    organization_id: config.organizationId || row.organization_id,
    gym_id: config.gymId || row.gym_id,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
  
  // Batch import in chunks of 100
  const batchSize = 100;
  for (let i = 0; i < dataToImport.length; i += batchSize) {
    const batch = dataToImport.slice(i, i + batchSize);
    
    if (config.upsert && config.conflictKeys) {
      const { error } = await supabase
        .from(config.entityType)
        .upsert(batch, { onConflict: config.conflictKeys.join(",") });
      
      if (error) {
        result.success = false;
        result.failed += batch.length;
        result.errors.push({
          row: i + 1,
          message: error.message
        });
      } else {
        result.imported += batch.length;
      }
    } else {
      const { error } = await supabase
        .from(config.entityType)
        .insert(batch);
      
      if (error) {
        result.success = false;
        result.failed += batch.length;
        result.errors.push({
          row: i + 1,
          message: error.message
        });
      } else {
        result.imported += batch.length;
      }
    }
  }
  
  return result;
}

// Import members from CSV
export async function importMembers(csvContent: string, organizationId: string, gymId: string, createdBy: string): Promise<ImportResult> {
  const data = parseCsv(csvContent);
  
  // Transform data for members table
  const membersData = data.map(row => ({
    full_name: row.full_name || row.name,
    email: row.email,
    phone: row.phone,
    date_of_birth: row.date_of_birth || row.dob,
    gender: row.gender,
    address: row.address,
    emergency_contact_name: row.emergency_contact_name,
    emergency_contact_phone: row.emergency_contact_phone,
    membership_status: row.membership_status || "active",
    join_date: row.join_date || new Date().toISOString()
  }));
  
  return importData({
    entityType: "members",
    data: membersData,
    organizationId,
    gymId,
    createdBy
  });
}

// Import leads from CSV
export async function importLeads(csvContent: string, organizationId: string, gymId: string, createdBy: string): Promise<ImportResult> {
  const data = parseCsv(csvContent);
  
  const leadsData = data.map(row => ({
    full_name: row.full_name || row.name,
    email: row.email,
    phone: row.phone,
    source: row.source || "website",
    status: row.status || "new",
    notes: row.notes,
    interested_in: row.interested_in
  }));
  
  return importData({
    entityType: "crm_leads",
    data: leadsData,
    organizationId,
    gymId,
    createdBy
  });
}

// Import equipment from CSV
export async function importEquipment(csvContent: string, organizationId: string, gymId: string, createdBy: string): Promise<ImportResult> {
  const data = parseCsv(csvContent);
  
  const equipmentData = data.map(row => ({
    name: row.name,
    category: row.category,
    model: row.model,
    serial_number: row.serial_number,
    purchase_date: row.purchase_date,
    purchase_cost: row.purchase_cost ? parseFloat(row.purchase_cost) : null,
    warranty_expiry: row.warranty_expiry,
    status: row.status || "active"
  }));
  
  return importData({
    entityType: "equipment",
    data: equipmentData,
    organizationId,
    gymId,
    createdBy
  });
}

// Validate CSV structure
export function validateCsvStructure(csvContent: string, requiredFields: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const data = parseCsv(csvContent);
  
  if (data.length === 0) {
    errors.push("CSV file is empty or has no data rows");
    return { valid: false, errors };
  }
  
  const headers = Object.keys(data[0]);
  
  // Check required fields
  for (const field of requiredFields) {
    if (!headers.includes(field)) {
      errors.push(`Missing required column: ${field}`);
    }
  }
  
  // Check for empty required values
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    for (const field of requiredFields) {
      if (!data[i][field]) {
        errors.push(`Row ${i + 1}: Missing value for required field '${field}'`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
