"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  type Table as TableInstance,
  type VisibilityState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { Pagination } from "./pagination";
import { Skeleton } from "./skeleton";

type DataTableColumn<TData> = {
  id: string;
  header: string;
  accessorKey?: string;
  cell?: (props: { row: TData }) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
};

type DataTableProps<TData extends Record<string, unknown>> = {
  columns: DataTableColumn<TData>[];
  data: TData[];
  pageCount: number;
  pageIndex: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onSortChange?: (sortBy: string, sortDir: "asc" | "desc") => void;
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  selectedRows?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  getRowId?: (row: TData) => string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  emptyDescription?: string;
  totalItems?: number;
  className?: string;
  renderSubComponent?: (props: { row: TData }) => React.ReactNode;
  getRowCanExpand?: (row: TData) => boolean;
};

export function DataTable<TData extends Record<string, unknown>>({
  columns,
  data,
  pageCount,
  pageIndex,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sortBy,
  sortDir,
  onSortChange,
  globalFilter: externalGlobalFilter,
  onGlobalFilterChange,
  selectedRows: externalSelectedRows,
  onSelectionChange,
  getRowId,
  isLoading,
  error,
  onRetry,
  emptyMessage,
  emptyDescription,
  totalItems,
  className,
  renderSubComponent,
  getRowCanExpand,
}: DataTableProps<TData>) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>(() =>
    sortBy ? [{ id: sortBy, desc: sortDir === "desc" }] : [],
  );
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState(externalGlobalFilter ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setGlobalFilter(externalGlobalFilter ?? "");
  }, [externalGlobalFilter]);

  const handleGlobalFilterChange = useCallback(
    (value: string) => {
      setGlobalFilter(value);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onGlobalFilterChange?.(value);
      }, 300);
    },
    [onGlobalFilterChange],
  );

  useEffect(() => {
    if (!externalSelectedRows) return;
    const selection: RowSelectionState = {};
    if (getRowId) {
      data.forEach((row) => {
        const id = getRowId(row);
        if (externalSelectedRows.includes(id)) {
          selection[id] = true;
        }
      });
    }
    setRowSelection(selection);
  }, [externalSelectedRows, data, getRowId]);

  useEffect(() => {
    if (!onSelectionChange || !getRowId) return;
    const selected = Object.keys(rowSelection);
    const ids = data.filter((_, i) => rowSelection[i]).map((row) => getRowId(row));
    onSelectionChange(ids);
  }, [rowSelection, onSelectionChange, getRowId, data]);

  useEffect(() => {
    if (!onSortChange) return;
    if (sorting.length > 0) {
      const s = sorting[0]!;
      onSortChange(s.id, s.desc ? "desc" : "asc");
    } else {
      onSortChange("", "asc");
    }
  }, [sorting, onSortChange]);

  const tableColumns = useMemo<ColumnDef<TData>[]>(
    () => [
      ...(onSelectionChange && getRowId
        ? [
            {
              id: "select",
              header: ({ table }: { table: TableInstance<TData> }) => (
                <input
                  type="checkbox"
                  checked={table.getIsAllRowsSelected()}
                  onChange={table.getToggleAllRowsSelectedHandler()}
                  className="size-4 rounded border-border accent-primary"
                  aria-label="Select all rows"
                />
              ),
              cell: ({ row }: { row: { id: string; getIsSelected: () => boolean; getToggleSelectedHandler: () => (e: React.ChangeEvent<HTMLInputElement>) => void } }) => (
                <input
                  type="checkbox"
                  checked={row.getIsSelected()}
                  onChange={row.getToggleSelectedHandler()}
                  className="size-4 rounded border-border accent-primary"
                  aria-label="Select row"
                />
              ),
              enableSorting: false,
              enableColumnFilter: false,
              size: 50,
            } as unknown as ColumnDef<TData>,
          ]
        : []),
      ...columns.map(
        (col) =>
          ({
            id: col.id,
            accessorKey: col.accessorKey,
            header: ({ column }: { column: { getIsSorted: () => false | "asc" | "desc"; getToggleSortingHandler: () => (() => void) | undefined } }) => (
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground",
                  col.sortable && "cursor-pointer hover:text-foreground",
                )}
                onClick={col.sortable ? column.getToggleSortingHandler() : undefined}
              >
                {col.header}
                {col.sortable && (
                  <>
                    {column.getIsSorted() === "asc" && <ChevronUp className="size-3.5" />}
                    {column.getIsSorted() === "desc" && <ChevronDown className="size-3.5" />}
                    {column.getIsSorted() !== "asc" && column.getIsSorted() !== "desc" && (
                      <ChevronsUpDown className="size-3.5 opacity-30" />
                    )}
                  </>
                )}
              </button>
            ),
            cell: col.cell
              ? (info: { row: { original: TData } }) => col.cell!({ row: info.row.original })
              : undefined,
            accessorFn: col.accessorKey ? (row: TData) => row[col.accessorKey as keyof TData] : undefined,
            enableSorting: col.sortable ?? false,
            enableColumnFilter: col.filterable ?? false,
            size: col.width ? parseInt(col.width) : undefined,
          }) as unknown as ColumnDef<TData>,
      ),
    ],
    [columns, onSelectionChange, getRowId],
  );

  const table = useReactTable<TData>({
    data,
    columns: tableColumns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualSorting: !!onSortChange,
    manualFiltering: !!onGlobalFilterChange,
    manualPagination: true,
    pageCount,
    enableRowSelection: !!onSelectionChange && !!getRowId,
    ...(getRowId ? { getRowId: (row: TData) => getRowId(row) } : {}),
    ...(getRowCanExpand ? { getRowCanExpand: (row: { original: TData }) => getRowCanExpand(row.original) as boolean } : {}),
    debugTable: false,
  });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-semibold text-red-700">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-red-100 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-200 transition-colors"
            type="button"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex gap-4 border-b border-border pb-3">
          {[...Array(columns.length + (onSelectionChange && getRowId ? 1 : 0))].map((_, i) => (
            <Skeleton key={i} className="h-8 flex-1" />
          ))}
        </div>
        {[...Array(Math.min(pageSize, 8))].map((_, r) => (
          <div key={r} className="flex gap-4">
            {[...Array(columns.length + (onSelectionChange && getRowId ? 1 : 0))].map((_, c) => (
              <Skeleton key={c} className="h-6 flex-1" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        type={globalFilter ? "no_results" : "no_data"}
        {...(emptyMessage ? { title: emptyMessage } : {})}
        {...(emptyDescription ? { description: emptyDescription } : {})}
        compact
      />
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border bg-surface-muted/50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      "whitespace-nowrap px-4 py-3",
                      header.column.getCanSort() && "select-none",
                    )}
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.map((row, idx) => (
              <>
                <tr
                  key={row.id}
                  className={cn(
                    "reveal-up transition-colors hover:bg-accent/5",
                    row.getIsSelected() && "bg-accent/5",
                  )}
                  style={{ animationDelay: `${idx * 30}ms` } as React.CSSProperties}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && renderSubComponent && (
                  <tr key={`${row.id}-expanded`} className="reveal-up">
                    <td colSpan={row.getVisibleCells().length} className="px-4 py-3 bg-surface-muted/30">
                      {renderSubComponent({ row: row.original })}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={pageIndex + 1}
        totalPages={Math.max(1, pageCount)}
        baseHref="#"
        onPageChange={onPageChange}
        pageSize={pageSize}
        {...(onPageSizeChange ? { onPageSizeChange } : {})}
        totalItems={totalItems ?? data.length}
      />
    </div>
  );
}
