import { neon } from "@neondatabase/serverless";

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  return neon(url);
}

export async function listNotes() {
  const sql = connect();
  return (await sql`
    SELECT id, note
    FROM ping
    ORDER BY created_at DESC, id DESC
    LIMIT 10
  `) as { id: string; note: string }[];
}

export async function insertNote(note: string) {
  const sql = connect();
  await sql`INSERT INTO ping (note) VALUES (${note})`;
}
