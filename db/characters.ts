import { type SqlClient, violatesConstraint } from "./client";
import { validateId, validateName, validateSortOrder, ValidationError } from "../lib/validate";

type CharacterRow = { id: string; name: string; sort_order: number; created_at: Date };
export type Character = Omit<CharacterRow, "created_at"> & { created_at: string };

function serialize(row: CharacterRow): Character {
  return { ...row, created_at: row.created_at.toISOString() };
}

export async function createCharacter(sql: SqlClient, name: string): Promise<Character> {
  const cleanName = validateName(name);
  try {
    const [row] = await sql`
      INSERT INTO game_character (name) VALUES (${cleanName})
      RETURNING id, name, sort_order, created_at
    ` as CharacterRow[];
    return serialize(row);
  } catch (error) {
    if (violatesConstraint(error, "game_character_name_key")) {
      throw new ValidationError("name", "This name already exists.");
    }
    throw error;
  }
}

export async function listCharacters(sql: SqlClient): Promise<Character[]> {
  const rows = await sql`
    SELECT id, name, sort_order, created_at FROM game_character ORDER BY sort_order, id
  ` as CharacterRow[];
  return rows.map(serialize);
}

export async function renameCharacter(sql: SqlClient, id: string, name: string): Promise<Character | null> {
  const characterId = validateId(id, "id");
  const cleanName = validateName(name);
  try {
    const [row] = await sql`
      UPDATE game_character SET name = ${cleanName} WHERE id = ${characterId}
      RETURNING id, name, sort_order, created_at
    ` as CharacterRow[];
    return row ? serialize(row) : null;
  } catch (error) {
    if (violatesConstraint(error, "game_character_name_key")) {
      throw new ValidationError("name", "This name already exists.");
    }
    throw error;
  }
}

export async function setCharacterOrder(sql: SqlClient, id: string, order: number): Promise<Character | null> {
  const characterId = validateId(id, "id");
  const sortOrder = validateSortOrder(order);
  const [row] = await sql`
    UPDATE game_character SET sort_order = ${sortOrder} WHERE id = ${characterId}
    RETURNING id, name, sort_order, created_at
  ` as CharacterRow[];
  return row ? serialize(row) : null;
}
