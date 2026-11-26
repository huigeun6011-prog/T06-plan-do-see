import { applySchema, connectSchemaDatabase } from "./schema.mjs";

try {
  const sql = connectSchemaDatabase();
  await applySchema(sql);
  const relations = await sql`
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('game_character', 'entry', 'plan', 'todo', 'run_record', 'todo_state')
    ORDER BY table_type, table_name
  `;

  for (const relation of relations) {
    console.log(`${relation.table_type.padEnd(10)} ${relation.table_name}`);
  }
} catch (error) {
  // Neon connection failures may contain connection details.
  console.error("Could not apply or inspect the dev schema.");
  process.exitCode = 1;
}
