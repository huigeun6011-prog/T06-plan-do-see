export class ValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export type PeriodKind = "weekly" | "monthly";

export interface EntryInput {
  title: string;
  period_kind: PeriodKind;
  clear_minutes: number;
  reward_meso: number | string;
  party_size: number;
  doping?: string;
  memo?: string;
  target_count?: number;
  tags?: string[];
  sort_order?: number;
  character_id?: string | null;
}

function text(value: unknown, field: string, min: number, max: number, trim = true): string {
  if (typeof value === "string" && !value.includes("\0")) {
    const clean = trim ? value.trim() : value;
    const length = Array.from(clean).length;
    if (length >= min && length <= max) return clean;
  }
  throw new ValidationError(field, min === 0 ? `Use at most ${max} characters.` : `Use ${min}–${max} characters.`);
}

function integer(value: unknown, field: string, min: number, max: number): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max) {
    return value;
  }
  throw new ValidationError(field, `Use an integer from ${min} to ${max}.`);
}

export function validateName(value: unknown): string {
  return text(value, "name", 1, 30);
}

export function validateSortOrder(value: unknown): number {
  return integer(value, "sort_order", -2147483648, 2147483647);
}

export function validateId(value: unknown, field: string): string {
  if (typeof value === "string" && /^[1-9]\d{0,18}$/.test(value)
      && (value.length < 19 || value <= "9223372036854775807")) {
    return value;
  }
  throw new ValidationError(field, "Use a valid ID.");
}

export function validatePeriodKind(value: unknown): PeriodKind {
  if (value === "weekly" || value === "monthly") return value;
  throw new ValidationError("period_kind", "Choose weekly or monthly.");
}

function validateReward(value: unknown): string {
  const amount = typeof value === "string" && /^\d{1,16}$/.test(value) ? Number(value) : value;
  return String(integer(amount, "reward_meso", 0, Number.MAX_SAFE_INTEGER));
}

function validateTags(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 10) {
    throw new ValidationError("tags", "Use up to 10 tags.");
  }
  const tags = Array.from(value, (tag) => text(tag, "tags", 1, 30));
  if (new Set(tags).size !== tags.length) throw new ValidationError("tags", "Use each tag once.");
  return tags;
}

export function validateEntry({
  title,
  period_kind,
  clear_minutes,
  reward_meso,
  party_size,
  doping = "base",
  memo = "",
  target_count = 1,
  tags = [],
  sort_order = 0,
  character_id = null,
}: EntryInput) {
  return {
    title: text(title, "title", 1, 100),
    period_kind: validatePeriodKind(period_kind),
    clear_minutes: integer(clear_minutes, "clear_minutes", 1, 10000),
    reward_meso: validateReward(reward_meso),
    party_size: integer(party_size, "party_size", 1, 99),
    doping: text(doping, "doping", 1, 100),
    memo: text(memo, "memo", 0, 500, false),
    target_count: integer(target_count, "target_count", 1, 1000),
    tags: validateTags(tags),
    sort_order: validateSortOrder(sort_order),
    character_id: character_id === null ? null : validateId(character_id, "character_id"),
  };
}
