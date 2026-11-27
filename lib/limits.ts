export const MAX_WEEKLY_BOSSES_PER_CHARACTER = 12;

export function entryKind(tags: string[]): "boss" | "mission" {
  return tags.includes("mission") && !tags.includes("boss") ? "mission" : "boss";
}
