"use client";

import { useState, useCallback } from "react";

export function useBulkSelection() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectAll, setIsSelectAll] = useState(false);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    setIsSelectAll(true);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    setIsSelectAll(false);
  }, []);

  const isSelected = useCallback((id: string) => {
    return selectedIds.includes(id);
  }, [selectedIds]);

  const selectRange = useCallback((ids: string[], startId: string, endId: string) => {
    const startIndex = ids.indexOf(startId);
    const endIndex = ids.indexOf(endId);
    
    if (startIndex === -1 || endIndex === -1) return;

    const [from, to] = startIndex < endIndex 
      ? [startIndex, endIndex] 
      : [endIndex, startIndex];

    const rangeIds = ids.slice(from, to + 1);
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      rangeIds.forEach(id => newSet.add(id));
      return Array.from(newSet);
    });
  }, []);

  return {
    selectedIds,
    isSelectAll,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    selectRange,
    hasSelection: selectedIds.length > 0,
    selectionCount: selectedIds.length
  };
}
