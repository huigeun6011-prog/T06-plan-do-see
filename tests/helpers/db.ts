import { NeonDbError } from "@neondatabase/serverless";
import { afterAll, beforeAll, beforeEach } from "vitest";
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
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    try {
      return await sql(strings, ...values);
    } catch (error) {
      if (error instanceof NeonDbError && error.code) {
        throw Object.assign(new Error("Test query rejected by PostgreSQL."), {
          code: error.code,
          constraint: error.constraint,
        });
      }
      throw new Error("Test query could not reach PostgreSQL.");
    }
  };
}
