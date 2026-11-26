import { listNotes } from "../db/ping";
import { MAX_NOTE_LENGTH } from "./note";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const notes = await listNotes().catch(() => {
    throw new Error("Could not read notes.");
  });

  return (
    <main>
      <h1>Database connection check</h1>
      <form action="/ping" method="post">
        <label htmlFor="note">Public test note</label>
        <input id="note" name="note" maxLength={MAX_NOTE_LENGTH} required />
        {error === "note" && (
          <p role="alert">Enter a note between 1 and {MAX_NOTE_LENGTH} characters.</p>
        )}
        <button type="submit">Save note</button>
      </form>
      <h2>Latest 10 notes</h2>
      {notes.length ? (
        <ol>
          {notes.map(({ id, note }) => <li key={id}>{note}</li>)}
        </ol>
      ) : (
        <p>No notes yet.</p>
      )}
    </main>
  );
}
