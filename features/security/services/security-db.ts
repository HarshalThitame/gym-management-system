/* eslint-disable @typescript-eslint/no-explicit-any */

export type SecurityDbResult = { data: any; error: any; count?: number };

export type SecuritySelectQuery = {
  eq(column: string, value: unknown): SecuritySelectQuery;
  neq(column: string, value: unknown): SecuritySelectQuery;
  in(column: string, values: unknown[]): SecuritySelectQuery;
  or(filters: string): SecuritySelectQuery;
  ilike(column: string, pattern: string): SecuritySelectQuery;
  gte(column: string, value: string): SecuritySelectQuery;
  lte(column: string, value: string): SecuritySelectQuery;
  is(column: string, value: unknown): SecuritySelectQuery;
  not(column: string, value: unknown): SecuritySelectQuery;
  order(column: string, opts?: { ascending?: boolean }): SecuritySelectQuery;
  range(from: number, to: number): SecuritySelectQuery;
  limit(count: number): SecuritySelectQuery;
  single(): Promise<SecurityDbResult>;
  maybeSingle(): Promise<SecurityDbResult>;
  then(resolve: (value: SecurityDbResult) => void): Promise<SecurityDbResult>;
};

export type SecurityInsertQuery = {
  select(columns?: string): { single(): Promise<SecurityDbResult> };
  then(resolve: (value: SecurityDbResult) => void): Promise<SecurityDbResult>;
};

export type SecurityUpdateQuery = {
  eq(column: string, value: unknown): SecurityUpdateEqQuery;
};

export type SecurityUpdateEqQuery = {
  select(): { single(): Promise<SecurityDbResult> };
  eq(column: string, value: unknown): SecurityUpdateEqQuery;
  then(resolve: (value: SecurityDbResult) => void): Promise<SecurityDbResult>;
};

export type SecurityDb = {
  from(table: string): {
    select(columns: string, opts?: { count?: "exact"; head?: boolean }): SecuritySelectQuery;
    insert(values: Record<string, unknown>): SecurityInsertQuery;
    update(values: Record<string, unknown>): SecurityUpdateQuery;
    delete(): { eq(column: string, value: unknown): Promise<SecurityDbResult> };
    upsert(values: Record<string, unknown>, opts?: { onConflict?: string }): Promise<SecurityDbResult>;
  };
  rpc(name: string, params?: Record<string, unknown>): Promise<SecurityDbResult>;
};

export function sdb(supabase: unknown): SecurityDb {
  return supabase as SecurityDb;
}
