"use client";
import { useState } from "react";
import type { MockBoss } from "../../lib/ui/mock";
import { BossTile } from "./BossTile";

// A plain row of tiles (monthly, events) with local state only.
export function TileGroup({ bosses }: { bosses: MockBoss[] }) {
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(bosses.map((b) => [b.id, b.done ?? 0])));
  return (
    <div className="pd-tiles">
      {bosses.map((b) => (
        <BossTile key={b.id} boss={b} count={counts[b.id]} onChange={(n) => setCounts({ ...counts, [b.id]: n })} />
      ))}
    </div>
  );
}
