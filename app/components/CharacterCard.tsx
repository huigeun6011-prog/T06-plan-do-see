"use client";
import { useState } from "react";
import type { MockCharacter } from "../../lib/ui/mock";
import { BossTile } from "./BossTile";
import { IconTile } from "./IconTile";

export function CharacterCard({ character }: { character: MockCharacter }) {
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(character.bosses.map((b) => [b.id, b.done ?? 0])));
  const total = character.bosses.length;
  const doneN = character.bosses.filter((b) => counts[b.id] >= (b.target ?? 1)).length;
  const minutes = character.bosses.reduce((s, b) => s + b.minutes * Math.max(0, (b.target ?? 1) - counts[b.id]), 0);
  return (
    <article className="pd-char" aria-label={character.job}>
      <div className="pd-portrait">
        <IconTile label={character.job} round />
        <button type="button" className="pd-job" title={character.job}>{character.job}</button>
      </div>
      <div className="pd-right">
        <div className="pd-tiles">
          {character.bosses.map((b) => (
            <BossTile key={b.id} boss={b} owner={character.job} count={counts[b.id]} onChange={(n) => setCounts({ ...counts, [b.id]: n })} />
          ))}
        </div>
        <p className="pd-sum" aria-label={`완료 ${doneN}/${total}, 남은 ${minutes}분`}>
          <span aria-hidden="true">☑ {doneN}/{total}</span>
          <span aria-hidden="true">⏱ {minutes}</span>
        </p>
      </div>
    </article>
  );
}
