const EOK = 100000000;
const MAN = 10000;

// 6200000000 -> "62억", 120000000 -> "1억 2000만", 0 -> "0".
export function formatMeso(value: number | string): string {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) return "0";
  const parts = [Math.floor(n / EOK), Math.floor((n % EOK) / MAN), n % MAN].map((v, i) => (v ? `${v}${["억", "만", ""][i]}` : ""));
  return parts.filter(Boolean).join(" ");
}

// Commas only as proper groups inside a digit run (3,500 or 62,0000,0000); one optional space around a unit; no space between digit groups.
const DIGITS = String.raw`(?:\d+|\d{1,3}(?:,\d{3})+|\d+(?:,\d{4})+)`;
const PATTERN = new RegExp(`^(?:(${DIGITS}) ?억)?(?: ?(${DIGITS}) ?만)?(?: ?(${DIGITS}))?$`);

// "62억 5000만", "3,500만", "6200000000" -> integer; anything else (or above MAX_SAFE_INTEGER) -> null.
export function parseMeso(text: string): number | null {
  const t = text.trim();
  if (!t || t.length > 40) return null;
  const m = t.match(PATTERN);
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) return null;
  const num = (g: string | undefined) => BigInt((g ?? "0").replace(/,/g, ""));
  // A bare number after a unit is only allowed as the remainder below 1만.
  if ((m[1] !== undefined || m[2] !== undefined) && m[3] !== undefined && num(m[3]) >= BigInt(MAN)) return null;
  const total = num(m[1]) * BigInt(EOK) + num(m[2]) * BigInt(MAN) + num(m[3]);
  return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null;
}
