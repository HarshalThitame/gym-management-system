"use client";

import { useCallback, useEffect, useState } from "react";

export type FilterPreset = {
  id: string;
  name: string;
  module: string;
  filters: Record<string, string>;
  createdAt: string;
};

const STORAGE_KEY = "org-owner-filter-presets";

function loadAll(): FilterPreset[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}

export function useSavedFilters(module: string) {
  const [presets, setPresets] = useState<FilterPreset[]>([]);

  useEffect(() => {
    setPresets(loadAll().filter((p) => p.module === module));
  }, [module]);

  const savePreset = useCallback((name: string, filters: Record<string, string>) => {
    const all = loadAll();
    const newPreset: FilterPreset = {
      id: `preset-${Date.now()}`,
      name,
      module,
      filters,
      createdAt: new Date().toISOString()
    };
    const updated = [...all, newPreset];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setPresets(updated.filter((p) => p.module === module));
    return newPreset;
  }, [module]);

  const deletePreset = useCallback((id: string) => {
    const all = loadAll().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    setPresets(all.filter((p) => p.module === module));
  }, [module]);

  const applyPreset = useCallback((preset: FilterPreset) => {
    const params = new URLSearchParams();
    Object.entries(preset.filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    window.location.href = `/organization/${module}?${params.toString()}`;
  }, [module]);

  return { presets, savePreset, deletePreset, applyPreset };
}
