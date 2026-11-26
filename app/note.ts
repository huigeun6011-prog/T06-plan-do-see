export const MAX_NOTE_LENGTH = 200;

export function parseNote(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const note = value.trim();
  return note && note.length <= MAX_NOTE_LENGTH ? note : null;
}
