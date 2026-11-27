"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { reorderGroup } from "../../lib/ui/register-logic";
import { addCharacterAction, renameCharacterAction, reorderCharactersAction, reorderEntriesAction } from "./actions";
import { Err, GroupAdd, PasteBox, Row, kindOf, useRun, type Fail } from "./ui";
import type { EntryKind, RegistrationCharacterGroup, RegistrationData, RegistrationEntry } from "./types";
import { IconTile } from "../components/IconTile";
import { Section } from "../components/Shell";

const GROUPS: [EntryKind, string][] = [["boss", "보스"], ["mission", "미션"]];
const pad = (n: number) => String(n).padStart(2, "0");

function CharacterCard({ no, owner, characterId, entries, index, total, onMove }: {
  no: number;
  owner: string;
  characterId: string | null;
  entries: RegistrationEntry[];
  index?: number;
  total?: number;
  onMove?: (dir: -1 | 1) => void;
}) {
  const run = useRun();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(owner);
  const [fail, setFail] = useState<Fail | null>(null);
  const [moveFail, setMoveFail] = useState<Fail | null>(null);

  // Local order (root ids) so rapid moves build on the latest state; requests are queued so a later one never undoes an earlier one.
  const serverIds = entries.map((e) => e.root_id);
  const serverKey = serverIds.join(",");
  const [order, setOrder] = useState<string[] | null>(null);
  const latest = useRef(serverIds);
  const pending = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (pending.current === 0) {
      setOrder(null);
      latest.current = serverIds;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey]);

  const byId = new Map(entries.map((e) => [e.root_id, e]));
  const shown = (order ?? serverIds).map((id) => byId.get(id)).filter((e): e is RegistrationEntry => !!e);

  function move(id: string, delta: -1 | 1) {
    const items = latest.current.flatMap((i) => (byId.has(i) ? [{ id: i, kind: kindOf(byId.get(i)!) }] : []));
    const next = reorderGroup(items, id, delta);
    if (next.join(",") === items.map((x) => x.id).join(",")) return;
    latest.current = next;
    setOrder(next);
    pending.current++;
    queue.current = queue.current.then(async () => {
      const r = await run(reorderEntriesAction(next));
      pending.current--;
      setMoveFail(r.ok ? null : { field: r.field, message: r.message });
      if (!r.ok && pending.current === 0) {
        setOrder(null);
        latest.current = serverIds;
      }
    });
  }

  async function rename(e: FormEvent) {
    e.preventDefault();
    const r = await run(renameCharacterAction(characterId!, name));
    if (r.ok) setRenaming(false);
    else setFail({ field: r.field, message: r.message });
  }

  const nextOrder = entries.reduce((m, e) => Math.max(m, e.sort_order + 1), 0);
  return (
    <section className="pd-card" aria-label={owner}>
      <div className="pd-reghead">
        <span className="pd-no pd-h">{pad(no)}</span>
        {characterId === null ? (
          <span className="pd-job pd-h">{owner}</span>
        ) : renaming ? (
          <form className="pd-renameform" onSubmit={rename}>
            <input aria-label="직업명" placeholder="직업명" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fail} maxLength={30} autoFocus />
            <button type="submit" className="pd-sq" aria-label="저장">✓</button>
            <button type="button" className="pd-sq" aria-label="취소" onClick={() => { setRenaming(false); setName(owner); setFail(null); }}>↩</button>
          </form>
        ) : (
          <button type="button" className="pd-job pd-h" aria-label={`${owner} 이름 수정`} title={owner} onClick={() => setRenaming(true)}>{owner}</button>
        )}
        {onMove && (
          <span className="pd-acts">
            <button type="button" className="pd-sq" aria-label={`${owner} 위로`} disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
            <button type="button" className="pd-sq" aria-label={`${owner} 아래로`} disabled={index === total! - 1} onClick={() => onMove(1)}>↓</button>
          </span>
        )}
      </div>
      <Err fail={fail} field={fail?.field} />
      {GROUPS.map(([kind, title]) => {
        const mine = shown.filter((e) => kindOf(e) === kind);
        return (
          <div key={kind} className="pd-group" data-kind={kind}>
            <div className="pd-grouphead">
              <span className="pd-dim">{title}</span>
              <GroupAdd kind={kind} characterId={characterId} sortOrder={nextOrder} />
            </div>
            <ul className="pd-rows">
              {mine.map((e, i) => (
                <Row key={e.root_id} entry={e} owner={owner} characterId={characterId} first={i === 0} last={i === mine.length - 1} onMove={(d) => move(e.root_id, d)} />
              ))}
            </ul>
          </div>
        );
      })}
      <Err fail={moveFail} field={moveFail?.field} />
      <PasteBox characterId={characterId} />
    </section>
  );
}

export function RegisterView({ data }: { data: RegistrationData }) {
  const run = useRun();
  const [name, setName] = useState("");
  const [fail, setFail] = useState<Fail | null>(null);
  const [busy, setBusy] = useState(false);
  const chars = data.characters;

  async function add(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await run(addCharacterAction(name));
    setBusy(false);
    if (r.ok) {
      setName("");
      setFail(null);
    } else setFail({ field: r.field, message: r.message });
  }

  async function moveCharacter(i: number, dir: -1 | 1) {
    const ids = chars.map((c) => c.character.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    const r = await run(reorderCharactersAction(ids));
    setFail(r.ok ? null : { field: r.field, message: r.message });
  }

  return (
    <>
      <Section no="01" title="캐릭터">
        <form className="pd-addrow" onSubmit={add}>
          <IconTile label="직업" round size={44} />
          <input aria-label="직업명" placeholder="직업명" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!fail} maxLength={30} />
          <button type="submit" className="pd-pill" disabled={busy}>추가</button>
        </form>
        <Err fail={fail} field={fail?.field} />
      </Section>
      {chars.map((c: RegistrationCharacterGroup, i) => (
        <CharacterCard key={c.character.id} no={i + 2} owner={c.character.name} characterId={c.character.id} entries={c.entries} index={i} total={chars.length} onMove={(d) => moveCharacter(i, d)} />
      ))}
      {(chars.length > 0 || data.account.entries.length > 0) && (
        <CharacterCard no={chars.length + 2} owner="계정" characterId={null} entries={data.account.entries} />
      )}
    </>
  );
}
