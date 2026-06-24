export type ImplementationStatus =
  | "FULLY_IMPLEMENTED"
  | "PARTIAL"
  | "CONFIGURED_ONLY"
  | "NOT_IMPLEMENTED"
  | "SERVICE_OR_INFRA";

export type GapSeverity = "P0" | "P1" | "P2" | "N/A";

export type FeatureAuditRow = {
  featureCode: string;
  category: string;
  planValue: string;
  inFeatureKeys: boolean;
  hasModuleMap: string | null;
  hasSidebar: string | null;
  hasRoute: boolean;
  hasActions: boolean;
  hasUI: boolean;
  status: ImplementationStatus;
  gapSeverity: GapSeverity;
};

export type PlanAudit = {
  packageId: string;
  packageName: string;
  packageSlug: string;
  features: FeatureAuditRow[];
  summary: {
    totalFeatures: number;
    fullyImplemented: number;
    partial: number;
    configuredOnly: number;
    notImplemented: number;
    serviceInfra: number;
    implementationRate: number;
  };
};

export type FeatureAuditReport = {
  plans: PlanAudit[];
  summary: {
    totalFeatures: number;
    implemented: number;
    partial: number;
    configured: number;
    notImplemented: number;
    serviceInfra: number;
    implementationRate: number;
  };
};
