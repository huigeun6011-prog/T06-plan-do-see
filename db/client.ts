import { neon, type NeonQueryFunctionInTransaction, type NeonQueryInTransaction } from "@neondatabase/serverless";

type Row = Record<string, unknown>;

export interface SqlClient {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]>;
  transaction(queries: (sql: NeonQueryFunctionInTransaction<false, false>) => NeonQueryInTransaction[]): Promise<Row[][]>;
}

export function connectDatabase(): SqlClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  return neon(url);
}

export function violatesConstraint(error: unknown, constraint: string): boolean {
  return error instanceof Error && "constraint" in error && error.constraint === constraint;
}
