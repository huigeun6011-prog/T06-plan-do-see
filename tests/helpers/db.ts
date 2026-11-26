import { NeonDbError } from "@neondatabase/serverless";
import { afterAll, beforeAll, beforeEach } from "vitest";
import type { SqlClient } from "../../db/client";
import { applySchema, connectSchemaDatabase } from "../../scripts/schema.mjs";

export function useTestDatabase() {
  const sql = connectSchemaDatabase({ test: true });

  async function reset() {
    try {
      await sql`
        TRUNCATE game_character, entry, plan, todo, run_record RESTART IDENTITY
      `;
    } catch {
      throw new Error("Could not reset the test schema.");
    }
  }

  beforeAll(() => applySchema(sql), 30_000);
  beforeEach(reset, 30_000);
  afterAll(reset, 30_000);
  async function safeQuery<T>(query: Promise<T>): Promise<T> {
    try {
      return await query;
    } catch (error) {
      if (error instanceof NeonDbError && error.code) {
        throw Object.assign(new Error("Test query rejected by PostgreSQL."), {
          code: error.code,
          constraint: error.constraint,
        });
      }
      throw new Error("Test query could not reach PostgreSQL.");
    }
  }
  return Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => safeQuery(sql(strings, ...values)),
    {
      query: (text: string, params: unknown[]) => safeQuery(sql.query(text, params)),
      transaction: (...args: Parameters<SqlClient["transaction"]>) => safeQuery(sql.transaction(...args)),
    },
  );
}
