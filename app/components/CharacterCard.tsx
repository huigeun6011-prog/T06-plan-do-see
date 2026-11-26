"use client";
import { useState } from "react";
import type { MockCharacter } from "../../lib/ui/mock";
import { summarize } from "../../lib/ui/summary";
import { BossTile } from "./BossTile";
import { IconTile } from "./IconTile";

export function CharacterCard({ character }: { character: MockCharacter }) {
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(character.bosses.map((b) => [b.id, b.done ?? 0])));
  const total = character.bosses.length;
  const { done, minutes } = summarize(character.bosses, counts);
  return (
    <article className="pd-char" aria-label={character.job}>
      <div className="pd-portrait">
        <IconTile label={character.job} round size={72} />
        <span className="pd-job" title={character.job}>{character.job}</span>
      </div>
      <div className="pd-right">
        <div className="pd-tiles">
          {character.bosses.map((b) => (
            <BossTile key={b.id} boss={b} owner={character.job} count={counts[b.id]} onChange={(n) => setCounts({ ...counts, [b.id]: n })} />
          ))}
        </div>
        <p className="pd-sum">
          <span className="pd-sr">{`완료 ${done}/${total}, 남은 ${minutes}분`}</span>
          <span aria-hidden="true">☑ {done}/{total}</span>
          <span aria-hidden="true">⏱ {minutes}</span>
        </p>
      </div>
    </article>
  );
}
