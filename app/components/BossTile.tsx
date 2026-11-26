import { difficultyBadge, displayName } from "../../lib/ui/difficulty";
import type { MockBoss } from "../../lib/ui/mock";
import { nextCount } from "../../lib/ui/summary";
import { IconTile } from "./IconTile";

// Controlled: the parent owns the count so summaries stay in sync (local state only, nothing persists).
export function BossTile({ boss, owner, count, onChange }: { boss: MockBoss; owner?: string; count: number; onChange: (n: number) => void }) {
  const target = boss.target ?? 1;
  const done = count >= target;
  const cumulative = target > 1;
  const badge = difficultyBadge(boss.title);
  const party = boss.party && boss.party > 1 ? boss.party : 0;
  const label = [owner, boss.title, `${boss.minutes}분`, party ? `${party}인` : "", cumulative ? `${count}/${target}` : done ? "완료" : ""]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      className="pd-tile"
      data-done={done}
      aria-pressed={done}
      aria-label={label}
      title={label}
      onClick={() => onChange(nextCount(target, count))}
    >
      <span className="pd-iconwrap">
        <IconTile label={boss.title} />
        {cumulative ? <span className="pd-mark">{count}/{target}</span> : done && <span className="pd-mark">✓</span>}
      </span>
      <span className="pd-meta">
        {badge && <span className="pd-badge" data-tone={badge.tone}>{badge.letter}</span>}
        {party ? <span className="pd-party">{party}</span> : null}
      </span>
      <span className="pd-name">{displayName(boss.title)}</span>
    </button>
  );
}
