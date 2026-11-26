import { readFile } from "node:fs/promises";
import { NeonDbError, neon } from "@neondatabase/serverless";

/** @param {{ test?: boolean }} [options] */
export function connectSchemaDatabase({ test = false } = {}) {
  // Only use the branch URLs supplied in this worktree's file.
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.TEST_DATABASE_URL_UNPOOLED;
  process.loadEnvFile(".env.local");

  const devUrl = process.env.DATABASE_URL_UNPOOLED;
  const devHost = directHost(devUrl);
  if (!devUrl || !devHost) {
    throw new Error("DATABASE_URL_UNPOOLED must be a direct Postgres URL.");
  }
  if (!test) return neon(devUrl);

  const testUrl = process.env.TEST_DATABASE_URL_UNPOOLED;
  const testHost = directHost(testUrl);
  if (!testUrl || !testHost || testHost === devHost) {
    throw new Error("TEST_DATABASE_URL_UNPOOLED must be a direct Postgres URL on a different host from dev.");
  }
  return neon(testUrl);
}

/** @param {string | undefined} value */
function directHost(value) {
  const url = value && URL.parse(value);
  if (!url || !["postgres:", "postgresql:"].includes(url.protocol)) return;

  const host = URL.parse(`https://${url.host}`)?.hostname.replace(/\.$/, "");
  if (!host || host.split(".")[0].endsWith("-pooler")) return;
  return host;
}

/** @param {import("@neondatabase/serverless").NeonQueryFunction<false, false>} sql */
export async function applySchema(sql) {
  const source = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  // Each statement ends with a semicolon at the end of a line.
  const statements = source.split(/;[ \t]*$/m).map((statement) => statement.trim()).filter(Boolean);
  try {
    await sql.transaction(statements.map((statement) => sql.query(statement)));
  } catch (error) {
    const code = error instanceof NeonDbError && error.code;
    const position = error instanceof NeonDbError && error.position;
    if (code && /^[0-9A-Z]{5}$/.test(code)) {
      const location = position && /^\d+$/.test(position) ? ` at statement character ${position}` : "";
      throw new Error(`Schema transaction failed (SQLSTATE ${code}${location}).`);
    }
    throw new Error("Schema transaction failed to reach PostgreSQL.");
  }
}
