import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type CustomReport = {
  id: string;
  organization_id: string | null;
  gym_id: string | null;
  name: string;
  description: string | null;
  entity_type: string;
  columns: string[];
  filters: Record<string, any>;
  sort_by: string | null;
  sort_order: "asc" | "desc";
  limit_count: number | null;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ReportTemplate = {
  id: string;
  name: string;
  description: string | null;
  entity_type: string;
  default_columns: string[];
  default_filters: Record<string, any>;
  category: string;
  is_system: boolean;
  created_at: string;
};

export type ReportQueryResult = {
  data: Record<string, any>[];
  total: number;
  columns: string[];
};

export async function getCustomReports(organizationId?: string, gymId?: string, createdBy?: string): Promise<CustomReport[]> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase
    .from("custom_reports")
    .select()
    .order("created_at", { ascending: false });

  if (organizationId) query = query.eq("organization_id", organizationId);
  if (gymId) query = query.eq("gym_id", gymId);
  if (createdBy) query = query.eq("created_by", createdBy);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getCustomReport(reportId: string): Promise<CustomReport | null> {
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("custom_reports")
    .select()
    .eq("id", reportId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function createCustomReport(params: {
  organizationId?: string;
  gymId?: string;
  name: string;
  description?: string;
  entityType: string;
  columns: string[];
  filters?: Record<string, any>;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  limitCount?: number;
  isPublic?: boolean;
  createdBy: string;
}): Promise<CustomReport> {
  const supabase = getSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from("custom_reports")
    .insert({
      organization_id: params.organizationId,
      gym_id: params.gymId,
      name: params.name,
      description: params.description,
      entity_type: params.entityType,
      columns: params.columns,
      filters: params.filters ?? {},
      sort_by: params.sortBy,
      sort_order: params.sortOrder ?? "asc",
      limit_count: params.limitCount,
      is_public: params.isPublic ?? false,
      created_by: params.createdBy
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCustomReport(reportId: string, updates: Partial<CustomReport>): Promise<void> {
  const supabase = getSupabaseAdminClient();
  
  const { error } = await supabase
    .from("custom_reports")
    .update(updates)
    .eq("id", reportId);

  if (error) throw error;
}

export async function deleteCustomReport(reportId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  
  const { error } = await supabase
    .from("custom_reports")
    .delete()
    .eq("id", reportId);

  if (error) throw error;
}

export async function executeCustomReport(reportId: string): Promise<ReportQueryResult> {
  const supabase = await createSupabaseServerClient();
  
  const report = await getCustomReport(reportId);
  if (!report) throw new Error("Report not found");

  let query = supabase.from(report.entity_type).select(report.columns.join(","), { count: "exact" });

  // Apply filters
  if (report.filters) {
    Object.entries(report.filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        if (typeof value === "object" && value.operator) {
          switch (value.operator) {
            case "eq": query = query.eq(key, value.value); break;
            case "neq": query = query.neq(key, value.value); break;
            case "gt": query = query.gt(key, value.value); break;
            case "gte": query = query.gte(key, value.value); break;
            case "lt": query = query.lt(key, value.value); break;
            case "lte": query = query.lte(key, value.value); break;
            case "like": query = query.like(key, `%${value.value}%`); break;
            case "in": query = query.in(key, value.value); break;
          }
        } else {
          query = query.eq(key, value);
        }
      }
    });
  }

  // Apply sorting
  if (report.sort_by) {
    query = query.order(report.sort_by, { ascending: report.sort_order === "asc" });
  }

  // Apply limit
  if (report.limit_count) {
    query = query.limit(report.limit_count);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    data: data ?? [],
    total: count ?? 0,
    columns: report.columns
  };
}

export async function getReportTemplates(category?: string): Promise<ReportTemplate[]> {
  const supabase = await createSupabaseServerClient();
  
  let query = supabase
    .from("report_templates")
    .select()
    .order("name");

  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getEntityColumns(entityType: string): Promise<string[]> {
  const supabase = await createSupabaseServerClient();
  
  // Get a single row to determine columns
  const { data, error } = await supabase
    .from(entityType)
    .select("*")
    .limit(1);

  if (error || !data || data.length === 0) {
    // Return common columns as fallback
    return ["id", "created_at", "updated_at"];
  }

  return Object.keys(data[0]);
}

export async function createReportFromTemplate(templateId: string, params: {
  organizationId?: string;
  gymId?: string;
  name?: string;
  createdBy: string;
}): Promise<CustomReport> {
  const supabase = await createSupabaseServerClient();
  
  const { data: template, error } = await supabase
    .from("report_templates")
    .select()
    .eq("id", templateId)
    .single();

  if (error || !template) throw new Error("Template not found");

  return createCustomReport({
    organizationId: params.organizationId,
    gymId: params.gymId,
    name: params.name || template.name,
    description: template.description,
    entityType: template.entity_type,
    columns: template.default_columns,
    filters: template.default_filters,
    createdBy: params.createdBy
  });
}
