"use client";
import { useState, type FormEvent } from "react";
import { catalogTitle, rewardFor, type CatalogBoss, type CatalogRow } from "../../lib/catalog";
import { buildEntryInput } from "../../lib/ui/register-logic";
import { canAddBoss } from "../../lib/ui/register-logic";
import { IconTile } from "../components/IconTile";
import { addEntryAction } from "./actions";
import { Err, useRun, type Fail } from "./ui";
import type { RegistrationEntry } from "./types";

const LIMIT = "보스 한도에 도달했습니다";

// Pick a boss and a difficulty from the catalog. Minutes are required by the server and the catalog has none, so the tap asks for them.
export function BossPicker({ catalog, characterId, entries, sortOrder, onClose }: {
  catalog: CatalogBoss[];
  characterId: string | null;
  entries: RegistrationEntry[];
  sortOrder: number;
  onClose: () => void;
}) {
  const run = useRun();
  const [pick, setPick] = useState<CatalogRow | null>(null);
  const [minutes, setMinutes] = useState("");
  const [fail, setFail] = useState<Fail | null>(null);
  const [busy, setBusy] = useState(false);
  const have = new Set(entries.map((e) => e.title));
  const atLimit = !canAddBoss(entries);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!pick || busy) return;
    setBusy(true);
    const r = await run(
      addEntryAction(
        buildEntryInput({
          kind: "boss", characterId, sortOrder, reward: rewardFor(pick.price, 1),
          fields: { title: catalogTitle(pick), minutes, party: "", target: "", doping: "", memo: "", period: pick.cycle },
        }),
      ),
    );
    setBusy(false);
    if (r.ok) {
      setPick(null);
      setMinutes("");
      setFail(null);
    } else setFail({ field: r.field, message: r.message });
  }

  return (
    <div className="pd-picker">
      {atLimit && <small className="pd-dim">{LIMIT}</small>}
      {pick && (
        <form className="pd-formrow pd-pickform" onSubmit={add}>
          <span className="pd-pickname">{catalogTitle(pick)}</span>
          <input aria-label="분" placeholder="분" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-invalid={fail?.field === "clear_minutes"} autoFocus />
          <button type="submit" className="pd-pill" disabled={busy}>추가</button>
          <button type="button" className="pd-pill" onClick={() => { setPick(null); setFail(null); }}>취소</button>
          <Err fail={fail} field="clear_minutes" />
          <Err fail={fail} field="title" />
          {fail && fail.field !== "clear_minutes" && fail.field !== "title" && <Err fail={fail} field={fail.field} />}
        </form>
      )}
      <ul className="pd-pickrows">
        {catalog.map((b) => (
          <li key={b.boss} className="pd-pickrow">
            {/* shortcut: placeholder only, the catalog has no image column; pass an https image address as src here when it gets one */}
            <IconTile label={b.boss} />
            <span className="pd-pickname">{b.boss}</span>
            <span className="pd-chips">
              {b.rows.map((r) => {
                const added = have.has(catalogTitle(r));
                const blocked = r.cycle === "weekly" && atLimit;
                return (
                  <button
                    key={r.difficulty}
                    type="button"
                    className="pd-pickchip"
                    aria-pressed={added}
                    aria-label={`${catalogTitle(r)}${added ? " 추가됨" : ""}`}
                    title={blocked ? LIMIT : catalogTitle(r)}
                    disabled={added || blocked}
                    onClick={() => { setPick(r); setFail(null); }}
                  >
                    {r.difficulty}{added ? " ✓" : ""}
                  </button>
                );
              })}
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className="pd-pill" onClick={onClose}>닫기</button>
    </div>
  );
}
