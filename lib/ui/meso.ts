const EOK = 100000000;
const MAN = 10000;

// 6200000000 -> "62억", 120000000 -> "1억 2000만", 0 -> "0".
export function formatMeso(value: number | string): string {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) return "0";
  const parts = [Math.floor(n / EOK), Math.floor((n % EOK) / MAN), n % MAN].map((v, i) => (v ? `${v}${["억", "만", ""][i]}` : ""));
  return parts.filter(Boolean).join(" ");
}

// "62억 5000만", "3,500만", "6200000000" -> integer; anything else (or above MAX_SAFE_INTEGER) -> null.
export function parseMeso(text: string): number | null {
  const t = text.replace(/[\s,]/g, "");
  if (!t) return null;
  const m = t.match(/^(?:(\d+)억)?(?:(\d+)만)?(\d+)?$/);
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) return null;
  // A bare number after a unit is only allowed as the remainder below 1만.
  if ((m[1] !== undefined || m[2] !== undefined) && m[3] !== undefined && m[3].length > 4) return null;
  const total = BigInt(m[1] ?? 0) * BigInt(EOK) + BigInt(m[2] ?? 0) * BigInt(MAN) + BigInt(m[3] ?? 0);
  return total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null;
}
