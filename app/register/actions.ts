"use server";

import { revalidatePath } from "next/cache";
import { createCharacter, renameCharacter } from "../../db/characters";
import { connectDatabase } from "../../db/client";
import { createEntry, deleteEntry, editEntry } from "../../db/entries";
import { commitEntryLines, loadRegistration, reorderCharacters, reorderEntries } from "../../db/register";
import { parseEntryLines } from "../../lib/entry-lines";
import { entryEditActionResult, withRegistrationResult } from "./action-result";
import type {
  Character, Entry, EntryInput, EntryLineDefaults, EntryLinePreview, RegistrationActionResult, RegistrationData,
} from "./types";

export async function loadRegistrationAction(): Promise<RegistrationActionResult<{ data: RegistrationData }>> {
  return withRegistrationResult(async () => ({ ok: true, data: await loadRegistration(connectDatabase()) }));
}

export async function addCharacterAction(name: string): Promise<RegistrationActionResult<{ character: Character }>> {
  return withRegistrationResult(async () => {
    const character = await createCharacter(connectDatabase(), name);
    revalidatePath("/register");
    return { ok: true, character };
  });
}

export async function renameCharacterAction(id: string, name: string): Promise<RegistrationActionResult<{ character: Character | null }>> {
  return withRegistrationResult(async () => {
    const character = await renameCharacter(connectDatabase(), id, name);
    if (character) revalidatePath("/register");
    return { ok: true, character };
  });
}

export async function reorderCharactersAction(ids: string[]): Promise<RegistrationActionResult<{ changed: number }>> {
  return withRegistrationResult(async () => {
    const changed = await reorderCharacters(connectDatabase(), ids);
    if (changed) revalidatePath("/register");
    return { ok: true, changed };
  });
}

export async function addEntryAction(input: EntryInput): Promise<RegistrationActionResult<{ entry: Entry }>> {
  return withRegistrationResult(async () => {
    const entry = await createEntry(connectDatabase(), input);
    revalidatePath("/register");
    return { ok: true, entry };
  });
}

export async function saveEntryAction(
  rootId: string, expectedVersionId: string, input: EntryInput,
): Promise<RegistrationActionResult<{ id: string }>> {
  return withRegistrationResult(async () => {
    const result = entryEditActionResult(await editEntry(connectDatabase(), rootId, expectedVersionId, input));
    if (result.ok) revalidatePath("/register");
    return result;
  });
}

export async function removeEntryAction(rootId: string): Promise<RegistrationActionResult<{ removed: boolean }>> {
  return withRegistrationResult(async () => {
    const removed = await deleteEntry(connectDatabase(), rootId);
    if (removed) revalidatePath("/register");
    return { ok: true, removed };
  });
}

export async function reorderEntriesAction(ids: string[]): Promise<RegistrationActionResult<{ changed: number }>> {
  return withRegistrationResult(async () => {
    const changed = await reorderEntries(connectDatabase(), ids);
    if (changed) revalidatePath("/register");
    return { ok: true, changed };
  });
}

export async function previewEntryLinesAction(
  text: string, defaults: EntryLineDefaults,
): Promise<RegistrationActionResult<EntryLinePreview>> {
  return withRegistrationResult(() => ({ ok: true, ...parseEntryLines(text, defaults) }));
}

export async function commitEntryLinesAction(
  text: string, defaults: EntryLineDefaults,
): Promise<RegistrationActionResult<{ entries: Entry[] }>> {
  return withRegistrationResult<{ entries: Entry[] }>(async () => {
    const { rows, errors } = parseEntryLines(text, defaults);
    if (errors.length) return { ok: false, field: "text", message: errors[0].message, errors };
    if (!rows.length) return { ok: false, field: "text", message: "등록할 줄을 입력하세요." };
    const { entries, conflictingLines } = await commitEntryLines(connectDatabase(), rows, new Date());
    if (conflictingLines.length) {
      return { ok: false, field: "title", message: "이미 등록된 제목이 있습니다.", conflictingLines };
    }
    revalidatePath("/register");
    return { ok: true, entries };
  });
}
