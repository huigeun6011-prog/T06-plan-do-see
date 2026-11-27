import type { EntryLineError } from "../../lib/entry-lines";

export type { Character } from "../../db/characters";
export type { Entry } from "../../db/entries";
export type { RegistrationCharacterGroup, RegistrationData, RegistrationEntry } from "../../db/register";
export type { EntryKind, EntryLine, EntryLineDefaults, EntryLineError, EntryLinePreview } from "../../lib/entry-lines";
export type { EntryInput, PeriodKind } from "../../lib/validate";

export type RegistrationActionFailure = {
  ok: false;
  field?: string;
  message: string;
  errors?: EntryLineError[];
  conflictingLines?: number[];
};

export type RegistrationActionResult<T extends object> = ({ ok: true } & T) | RegistrationActionFailure;
