export class ValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export type PeriodKind = "weekly" | "monthly";
export type PlanKind = PeriodKind | "event";

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

function validateTags(value: unknown, unique = false): string[] {
  if (!Array.isArray(value) || value.length > 10) {
    throw new ValidationError("tags", "Use up to 10 tags.");
  }
  const tags = Array.from(value, (tag) => text(tag, "tags", 1, 30));
  if (unique && new Set(tags).size !== tags.length) {
    throw new ValidationError("tags", "Use each tag once.");
  }
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
    tags: validateTags(tags, true),
    sort_order: validateSortOrder(sort_order),
    character_id: character_id === null ? null : validateId(character_id, "character_id"),
  };
}

export type PlanFields = {
  title: string;
  priority: number;
  success_criteria: string;
  expected_minutes: number;
};

export interface EventPlanInput extends PlanFields {
  starts_at: Date;
  ends_at: Date;
}

export interface PlanEditInput extends PlanFields {
  starts_at?: Date;
  ends_at?: Date;
}

export interface TodoInput {
  title: string;
  note?: string;
  character_id?: string | null;
  due_at?: Date;
  priority?: number;
  tags?: string[];
  expected_minutes: number;
  target_count?: number;
}

export type TodoPatch = Partial<TodoInput>;

export function validateTodoPriority(value: unknown): number {
  return integer(value, "priority", 1, 3);
}

export function validateTodoTag(value: unknown): string {
  return text(value, "tag", 1, 30);
}

export function validateTodoPage(limit: unknown, offset: unknown) {
  return {
    limit: integer(limit, "limit", 1, 1000),
    offset: integer(offset, "offset", 0, Number.MAX_SAFE_INTEGER),
  };
}

const todoFields = {
  title: (value: unknown) => text(value, "title", 1, 200),
  note: (value: unknown) => text(value, "note", 0, 1000, false),
  character_id: (value: unknown) => value === null ? null : validateId(value, "character_id"),
  due_at: (value: unknown) => validateDate(value, "due_at"),
  priority: validateTodoPriority,
  tags: (value: unknown) => validateTags(value),
  expected_minutes: (value: unknown) => integer(value, "expected_minutes", 0, 2147483647),
  target_count: (value: unknown) => integer(value, "target_count", 1, 1000),
};

export function validateTodoPatch(patch: TodoPatch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new ValidationError("patch", "Choose a field to update.");
  }
  const entries = Object.entries(patch);
  if (!entries.length) throw new ValidationError("patch", "Choose a field to update.");
  return entries.map(([field, value]) => {
    if (!Object.hasOwn(todoFields, field)) throw new ValidationError(field, "This field cannot be updated.");
    const key = field as keyof typeof todoFields;
    return [key, todoFields[key](value)] as const;
  });
}

export function validatePlanKind(value: unknown): PlanKind {
  return value === "event" ? value : validatePeriodKind(value);
}

export function validateDate(value: unknown, field: string): Date {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  throw new ValidationError(field, "Use a valid date.");
}

export function validatePlanDates(startsAt: unknown, endsAt: unknown) {
  const starts_at = validateDate(startsAt, "starts_at");
  const ends_at = validateDate(endsAt, "ends_at");
  if (ends_at <= starts_at) throw new ValidationError("ends_at", "End must be after start.");
  return { starts_at, ends_at };
}

export function validatePlanFields(input: PlanFields): PlanFields {
  return {
    title: text(input.title, "title", 1, 100),
    priority: integer(input.priority, "priority", 1, 3),
    success_criteria: text(input.success_criteria, "success_criteria", 1, 500),
    expected_minutes: integer(input.expected_minutes, "expected_minutes", 0, 2147483647),
  };
}

export function validateTodo({
  title,
  note = "",
  character_id = null,
  due_at,
  priority = 2,
  tags = [],
  expected_minutes,
  target_count = 1,
}: TodoInput) {
  return {
    title: todoFields.title(title),
    note: todoFields.note(note),
    character_id: todoFields.character_id(character_id),
    due_at: due_at === undefined ? null : todoFields.due_at(due_at),
    priority: todoFields.priority(priority),
    tags: todoFields.tags(tags),
    expected_minutes: todoFields.expected_minutes(expected_minutes),
    target_count: todoFields.target_count(target_count),
  };
}

export type RunDetails = {
  actual_minutes: number | null;
  started_at: Date | null;
  ended_at: Date | null;
};

export type CompleteTodoInput = Partial<RunDetails> & { units?: number };

export function validateRunDetails(input: RunDetails): RunDetails {
  const actual_minutes = input.actual_minutes === null
    ? null : integer(input.actual_minutes, "actual_minutes", 0, 10000);
  const started_at = input.started_at === null ? null : validateDate(input.started_at, "started_at");
  const ended_at = input.ended_at === null ? null : validateDate(input.ended_at, "ended_at");
  if (started_at && ended_at && ended_at < started_at) {
    throw new ValidationError("ended_at", "End must be at or after start.");
  }
  return { actual_minutes, started_at, ended_at };
}

export function validateCompletion({
  units, actual_minutes = null, started_at = null, ended_at = null,
}: CompleteTodoInput = {}) {
  return {
    units: units === undefined ? null : integer(units, "units", 1, 1000),
    ...validateRunDetails({ actual_minutes, started_at, ended_at }),
  };
}

export function validateRunDate(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith("0000")) {
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value) return value;
  }
  throw new ValidationError("run_date", "Use a valid date in YYYY-MM-DD.");
}

export function validateMissReason(reason: unknown): string | null {
  return reason === null ? null : text(reason, "miss_reason", 0, 200) || null;
}
