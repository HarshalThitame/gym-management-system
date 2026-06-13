type DbSingle = Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
type DbArray = Promise<{ data: Array<Record<string, unknown>> | null; error: { message: string } | null }>;

type DbSelectable = {
  eq(c: string, v: unknown): DbFilterable;
  in(c: string, v: unknown[]): DbFilterable;
  not(c: string, op: string, v: unknown): DbFilterable;
  gte(c: string, v: string): DbFilterable;
  lte(c: string, v: string): DbFilterable;
  order(c: string, o: { ascending: boolean }): { limit(n: number): DbArray };
  single(): DbSingle;
  maybeSingle(): DbSingle;
  limit(n: number): DbArray;
};

type DbFilterable = DbSelectable & DbArray;

type UpdatePromise = Promise<{ error: { message: string } | null }>;
type UpdateChain = { eq(c: string, v: unknown): UpdateChain & UpdatePromise };
type UpdateResult = UpdateChain & UpdatePromise;

export type DbClient = {
  from(t: string): {
    select(c: string, o?: Record<string, unknown>): DbSelectable;
    insert(r: Record<string, unknown>): DbSingle;
    update(r: Record<string, unknown>): UpdateResult;
    delete(): UpdateChain & UpdatePromise;
  };
};

export { type DbSingle, type DbArray, type DbSelectable, type DbFilterable };
