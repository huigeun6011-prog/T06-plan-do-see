import { describe, expect, it } from "vitest";
import contract from "../contracts/pds-schema-v2.json";
import { TODO_SCOPE_PREDICATES } from "../db/todos";
import { useTestDatabase } from "./helpers/db";

describe("pds-schema-v2 contract", () => {
  const sql = useTestDatabase();

  it("matches the core database relations and every column's type, nullability and default", async () => {
    // The temporary connectivity check is outside the diary's schema.
    const relations = await sql`
      SELECT table_name, table_type FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name <> 'ping'
    `;
    expect(Object.fromEntries(relations.map(({ table_name, table_type }) =>
      [table_name, table_type === "VIEW" ? "view" : "table"],
    ))).toEqual(Object.fromEntries(Object.entries(contract.tables).map(([name, table]) => [name, table.kind])));

    const columns = await sql`
      SELECT table_name, column_name, data_type, udt_name, is_nullable, character_maximum_length,
        column_default, identity_generation
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name <> 'ping'
    `;
    const expected = Object.entries(contract.tables).flatMap(([table, relation]) =>
      Object.entries(relation.columns).map(([column, definition]) => [`${table}.${column}`, definition]),
    );
    const actual = columns.map((column) => {
      let type = column.data_type;
      if (type === "ARRAY" && column.udt_name === "_text") type = "text[]";
      if (type === "character") type = `character(${column.character_maximum_length})`;
      const defaultValue = column.identity_generation
        ? `GENERATED ${column.identity_generation} AS IDENTITY`
        : column.column_default?.replace(/::(?:text(?:\[\])?|bpchar|bigint|integer|smallint)$/, "") ?? null;
      return [`${column.table_name}.${column.column_name}`, {
        type, nullable: column.is_nullable === "YES", default: defaultValue,
      }];
    });
    expect(Object.fromEntries(actual)).toEqual(Object.fromEntries(expected));
    expect(contract.aggregates.scopes).toEqual(TODO_SCOPE_PREDICATES);
  });

  it("documents the unique indexes and their partial predicates", async () => {
    const rows = await sql`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes WHERE schemaname = 'public' AND tablename <> 'ping'
    `;
    for (const [name, relation] of Object.entries(contract.tables)) {
      const indexes = rows.filter((row) =>
        row.tablename === name && row.indexdef.startsWith("CREATE UNIQUE INDEX") && row.indexname !== `${name}_pkey`,
      );
      expect(indexes.map((row) => row.indexname).sort())
        .toEqual(relation.unique_indexes.map(({ name }) => name).sort());
      for (const index of relation.unique_indexes) {
        const definition = indexes.find((row) => row.indexname === index.name)?.indexdef as string;
        const predicate = definition.split(" WHERE ")[1]?.replace(/::(?:bpchar|text)|[()]/g, "") ?? null;
        expect(predicate).toBe(index.where);
      }
    }
  });

  it("matches the period and activity enum checks and rejects invalid values in PostgreSQL", async () => {
    const rows = await sql`
      SELECT con.conname AS name, pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      WHERE ns.nspname = 'public' AND contype = 'c'
    `;
    const checkValues = (name: string) => {
      const definition = rows.find((row) => row.name === name)?.definition as string | undefined;
      return [...(definition ?? "").matchAll(/'([^']+)'/g)].map((match) => match[1]);
    };
    expect(checkValues("plan_period_kind_check")).toEqual(contract.enums.period_kind);
    expect(checkValues("entry_period_kind_check")).toEqual(contract.enums.period_kind.filter((kind) => kind !== "event"));
    for (const name of ["entry", "plan", "todo", "run_record"]) {
      expect(checkValues(`${name}_use_yn_check`)).toEqual(contract.enums.use_yn);
    }

    await expect(sql`
      WITH n AS (SELECT nextval(pg_get_serial_sequence('plan', 'id')) AS id)
      INSERT INTO plan (id, root_id, period_kind, starts_at, ends_at, success_criteria)
      SELECT id, id, ${"daily"}, ${"2026-12-01T00:00:00Z"}::timestamptz, ${"2026-12-02T00:00:00Z"}::timestamptz, ${"Ok"}
      FROM n
    `).rejects.toMatchObject({ code: "23514", constraint: "plan_period_kind_check" });
    await expect(sql`
      WITH n AS (SELECT nextval(pg_get_serial_sequence('entry', 'id')) AS id)
      INSERT INTO entry (id, root_id, period_kind, title, clear_minutes, use_yn)
      SELECT id, id, ${"weekly"}, ${"Test"}, ${1}, ${"X"} FROM n
    `).rejects.toMatchObject({ code: "23514", constraint: "entry_use_yn_check" });
  });
});
