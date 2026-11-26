export type Tone = "gray" | "teal" | "pink" | "dark" | "red";

// Looks only: difficulty is not a data field, it is read from the leading word of the title.
const LEVELS: Record<string, { letter: string; tone: Tone }> = {
  이지: { letter: "E", tone: "gray" },
  노말: { letter: "N", tone: "teal" },
  하드: { letter: "H", tone: "pink" },
  카오스: { letter: "C", tone: "dark" },
  익스트림: { letter: "X", tone: "red" },
};

export function difficultyBadge(title: string): { letter: string; tone: Tone } | null {
  return LEVELS[title.trim().split(/\s+/)[0]] ?? null;
}
