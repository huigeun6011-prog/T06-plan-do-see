export type Tone = "gray" | "teal" | "pink" | "dark" | "red";

// Looks only: difficulty is not a data field, it is read from the leading word of the title.
const LEVELS: Record<string, { letter: string; tone: Tone }> = {
  이지: { letter: "E", tone: "gray" },
  노말: { letter: "N", tone: "teal" },
  노멀: { letter: "N", tone: "teal" }, // spelling used by data/boss-catalog.csv
  하드: { letter: "H", tone: "pink" },
  카오스: { letter: "C", tone: "dark" },
  익스트림: { letter: "X", tone: "red" },
};

function words(title: string): string[] {
  return title.trim().split(/\s+/).filter(Boolean);
}

export function difficultyBadge(title: string): { letter: string; tone: Tone } | null {
  const word = words(title)[0] ?? "";
  return Object.hasOwn(LEVELS, word) ? LEVELS[word] : null;
}

// Title without its leading difficulty word; the full title when nothing else is left.
export function displayName(title: string): string {
  const w = words(title);
  const rest = difficultyBadge(title) ? w.slice(1) : w;
  return (rest.length ? rest : w).join(" ");
}
