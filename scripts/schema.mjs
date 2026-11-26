import { readFile } from "node:fs/promises";
import { NeonDbError, neon } from "@neondatabase/serverless";

export class SchemaConfigurationError extends Error {}

/** @typedef {{ test?: boolean, production?: boolean }} SchemaDatabaseOptions */

/**
 * @param {Record<string, string | undefined>} env
 * @param {SchemaDatabaseOptions} [options]
 */
export function selectSchemaDatabase(env, { test = false, production = false } = {}) {
  const mode = test ? "test" : production ? "production" : "dev";
  const marker = mode === "test" ? "TEST_NEON_BRANCH" : "NEON_BRANCH";
  if (!env[marker]) {
    throw new SchemaConfigurationError(`${marker} is missing from .env.local.`);
  }
  if (env[marker] !== mode) {
    throw new SchemaConfigurationError(`${marker} must be exactly "${mode}".`);
  }

  const primaryUrl = env.DATABASE_URL_UNPOOLED;
  const primaryHost = directHost(primaryUrl);
  if (!primaryUrl || !primaryHost) {
    throw new SchemaConfigurationError("DATABASE_URL_UNPOOLED must be a direct Postgres URL.");
  }
  if (mode !== "test") return { mode, url: primaryUrl };

  const testUrl = env.TEST_DATABASE_URL_UNPOOLED;
  const testHost = directHost(testUrl);
  if (!testUrl || !testHost || testHost === primaryHost) {
    throw new SchemaConfigurationError("TEST_DATABASE_URL_UNPOOLED must be a direct Postgres URL on a different host from DATABASE_URL_UNPOOLED.");
  }
  return { mode, url: testUrl };
}

/** @param {SchemaDatabaseOptions} [options] */
export function connectSchemaDatabase(options) {
  // Only use the branch markers and URLs supplied in this worktree's file.
  delete process.env.NEON_BRANCH;
  delete process.env.TEST_NEON_BRANCH;
  delete process.env.DATABASE_URL_UNPOOLED;
  delete process.env.TEST_DATABASE_URL_UNPOOLED;
  try {
    process.loadEnvFile(".env.local");
  } catch {
    throw new SchemaConfigurationError("Could not load .env.local.");
  }

  const { mode, url } = selectSchemaDatabase(process.env, options);
  if (mode === "production") console.log("Applying schema to production");
  return neon(url);
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
