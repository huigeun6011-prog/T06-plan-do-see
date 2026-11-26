import { insertNote } from "../../db/ping";
import { parseNote } from "../note";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const note = parseNote(form?.get("note") ?? null);
  if (!note) {
    return new Response(null, { status: 303, headers: { Location: "/?error=note" } });
  }

  try {
    await insertNote(note);
  } catch {
    return new Response("Could not save the note.", { status: 503 });
  }

  return new Response(null, { status: 303, headers: { Location: "/" } });
}
