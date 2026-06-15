import { create } from "zustand";
import type { TenantContext } from "@/tenant/service";

const defaultTenant: TenantContext = {
  organizationId: null,
  organizationName: null,
  gymId: null,
  gymName: null,
  branchId: null,
  branchName: null,
  planTier: null,
  brand: {
    name: "Apex Performance Club",
    shortName: "Apex",
    initial: "A",
    logoUrl: null,
    faviconUrl: null,
    primaryColor: null,
    secondaryColor: null,
    accentColor: null,
  },
  resolved: false,
};

interface TenantStoreState {
  tenant: TenantContext;
  setTenant: (tenant: TenantContext) => void;
  resetTenant: () => void;
}

export const useTenantStore = create<TenantStoreState>((set) => ({
  tenant: defaultTenant,

  setTenant: (tenant) => set({ tenant }),

  resetTenant: () => set({ tenant: defaultTenant }),
}));
