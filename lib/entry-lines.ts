import { type EntryInput, type PeriodKind, validateEntry, validateId, validatePeriodKind, ValidationError } from "./validate";

export type EntryKind = "boss" | "mission";
export type EntryLineDefaults = { period_kind: PeriodKind; kind: EntryKind; character_id: string | null };
export type EntryLine = { line: number; input: EntryInput };
export type EntryLineError = { line: number; field: string; message: string };
export type EntryLinePreview = { rows: EntryLine[]; errors: EntryLineError[] };
export const MAX_ENTRY_LINES = 200;
const MAX_PASTE_LENGTH = 20_000;

function parseNumber(value: string, field: string): number {
  if (!/^\d+$/.test(value)) throw new ValidationError(field, "Use a whole number.");
  return Number(value);
}

export function parseEntryLines(text: string, defaults: EntryLineDefaults): EntryLinePreview {
  const rows: EntryLine[] = [];
  const errors: EntryLineError[] = [];
  if (typeof text !== "string" || text.length > MAX_PASTE_LENGTH * 2 || Array.from(text).length > MAX_PASTE_LENGTH) {
    return { rows, errors: [{ line: 0, field: "text", message: "Paste text up to 20,000 characters." }] };
  }
  const lines = text.split(/\r\n?|\n/);
  if (lines.at(-1) === "") lines.pop();
  if (lines.length > MAX_ENTRY_LINES) {
    return { rows, errors: [{ line: 0, field: "text", message: "Paste at most 200 lines." }] };
  }

  let cleanDefaults: EntryLineDefaults;
  try {
    if (!defaults || typeof defaults !== "object") throw new ValidationError("defaults", "Choose paste defaults.");
    const { period_kind, kind, character_id } = defaults;
    if (kind !== "boss" && kind !== "mission") throw new ValidationError("kind", "Choose boss or mission.");
    cleanDefaults = {
      kind,
      period_kind: validatePeriodKind(period_kind),
      character_id: character_id === null ? null : validateId(character_id, "character_id"),
    };
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    return { rows, errors: [{ line: 0, field: error.field, message: error.message }] };
  }

  const titles = new Set<string>();
  for (const [index, raw] of lines.entries()) {
    const line = index + 1;
    if (!raw.trim() || raw.trimStart().startsWith("#")) continue;
    const separator = raw.includes("\t") ? "\t" : "/";
    const [titleField, minutes = "", party = "", ...memo] = raw.split(separator);
    const title = titleField.trim();
    try {
      if (!title) throw new ValidationError("title", "Enter a title.");
      if (titles.has(title)) throw new ValidationError("title", "This title appears on an earlier line.");
      titles.add(title);
      const { sort_order: _defaultOrder, ...input } = validateEntry({
        title,
        clear_minutes: parseNumber(minutes.trim().replace(/\s*분$/, ""), "clear_minutes"),
        party_size: party.trim() ? parseNumber(party.trim(), "party_size") : 1,
        memo: memo.join(separator).trim(),
        period_kind: cleanDefaults.period_kind,
        character_id: cleanDefaults.character_id,
        reward_meso: 0,
        tags: [cleanDefaults.kind],
      });
      rows.push({ line, input });
    } catch (error) {
      if (!(error instanceof ValidationError)) throw error;
      errors.push({ line, field: error.field, message: error.message });
    }
  }
  return { rows, errors };
}
