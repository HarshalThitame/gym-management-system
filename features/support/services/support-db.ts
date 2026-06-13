/* eslint-disable @typescript-eslint/no-explicit-any */

export type SupportDbResult = { data: any; error: any; count?: number };

export type SupportSelectQuery = {
  eq(column: string, value: unknown): SupportSelectQuery;
  in(column: string, values: unknown[]): SupportSelectQuery;
  or(filters: string): SupportSelectQuery;
  gte(column: string, value: string): SupportSelectQuery;
  lte(column: string, value: string): SupportSelectQuery;
  order(column: string, opts?: { ascending?: boolean }): SupportSelectQuery;
  range(from: number, to: number): SupportSelectQuery;
  limit(count: number): SupportSelectQuery;
  contains(column: string, values: any[]): SupportSelectQuery;
  single(): Promise<SupportDbResult>;
  maybeSingle(): Promise<SupportDbResult>;
  then(resolve: (value: SupportDbResult) => void): Promise<SupportDbResult>;
};

export type SupportInsertQuery = {
  select(columns?: string): { single(): Promise<SupportDbResult> };
  then(resolve: (value: SupportDbResult) => void): Promise<SupportDbResult>;
};

export type SupportUpdateQuery = {
  eq(column: string, value: unknown): SupportUpdateEqQuery;
};

export type SupportUpdateEqQuery = {
  select(): { single(): Promise<SupportDbResult> };
  then(resolve: (value: SupportDbResult) => void): Promise<SupportDbResult>;
};

export type SupportDb = {
  from(table: string): {
    select(columns: string, opts?: { count?: "exact"; head?: boolean }): SupportSelectQuery;
    insert(values: Record<string, unknown>): SupportInsertQuery;
    update(values: Record<string, unknown>): SupportUpdateQuery;
    delete(): { eq(column: string, value: unknown): Promise<SupportDbResult> };
    upsert(values: Record<string, unknown>, opts?: { onConflict?: string }): Promise<SupportDbResult>;
  };
  rpc(name: string, params?: Record<string, unknown>): Promise<SupportDbResult>;
};

export function db(supabase: unknown): SupportDb {
  return supabase as SupportDb;
}
