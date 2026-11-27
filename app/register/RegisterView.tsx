"use client";
import { useState, type FormEvent } from "react";
import { addCharacterAction, addEntryAction, renameCharacterAction, reorderCharactersAction, reorderEntriesAction, saveEntryAction } from "./actions";
import { EntryForm, Err, PasteBox, Row, kindOf, useRun, type Fail } from "./ui";
import type { EntryKind, RegistrationCharacterGroup, RegistrationData, RegistrationEntry } from "./types";
import { IconTile } from "../components/IconTile";
import { Section } from "../components/Shell";

const GROUPS: [EntryKind, string][] = [["boss", "보스"], ["mission", "미션"]];
const pad = (n: number) => String(n).padStart(2, "0");

function Group({ kind, title, group, characterId, owner }: {
  kind: EntryKind;
  title: string;
  group: { entries: RegistrationEntry[] };
  characterId: string | null;
  owner: string;
}) {
  const run = useRun();
  const [adding, setAdding] = useState(false);
  const [fail, setFail] = useState<Fail | null>(null);
  const all = group.entries;
  const mine = all.filter((e) => kindOf(e) === kind);
  const rest = all.filter((e) => kindOf(e) !== kind);
  const nextOrder = all.reduce((m, e) => Math.max(m, e.sort_order + 1), 0);

  async function move(index: number, dir: -1 | 1) {
    const next = [...mine];
    [next[index], next[index + dir]] = [next[index + dir], next[index]];
    // The full order of this character's entries: the group moved, the other group kept as is.
    const ids = (kind === "boss" ? [...next, ...rest] : [...rest, ...next]).map((e) => e.root_id);
    const r = await run(reorderEntriesAction(ids));
    setFail(r.ok ? null : { field: r.field, message: r.message });
  }

  return (
    <div className="pd-group" data-kind={kind}>
      <div className="pd-grouphead">
        <span className="pd-dim">{title}</span>
        <button type="button" className="pd-sq" aria-label={`${title} 추가`} aria-expanded={adding} onClick={() => setAdding(!adding)}>+</button>
      </div>
      {adding && (
        <EntryForm kind={kind} characterId={characterId} sortOrder={nextOrder} submit={(input) => run(addEntryAction(input))} onDone={() => setAdding(false)} />
      )}
      <ul className="pd-rows">
        {mine.map((e, i) => (
          <Row
            key={e.root_id}
            entry={e}
            owner={owner}
            first={i === 0}
            last={i === mine.length - 1}
            onMove={(d) => move(i, d)}
            edit={(done) => (
              <EntryForm initial={e} kind={kind} characterId={characterId} sortOrder={e.sort_order} submit={(input) => run(saveEntryAction(e.root_id, e.version_id, input))} onDone={done} />
            )}
          />
        ))}
      </ul>
      <Err fail={fail} field={fail?.field} />
    </div>
  );
}

function CharacterCard({ no, owner, characterId, group, index, total, onMove }: {
  no: number;
  owner: string;
  characterId: string | null;
  group: { entries: RegistrationEntry[] };
  index?: number;
  total?: number;
  onMove?: (dir: -1 | 1) => void;
}) {
  const run = useRun();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(owner);
  const [fail, setFail] = useState<Fail | null>(null);

  async function rename(e: FormEvent) {
    e.preventDefault();
    const r = await run(renameCharacterAction(characterId!, name));
    if (r.ok) setRenaming(false);
    else setFail({ field: r.field, message: r.message });
  }

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
            <button type="button" className="pd-sq" aria-label="위로" disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
            <button type="button" className="pd-sq" aria-label="아래로" disabled={index === total! - 1} onClick={() => onMove(1)}>↓</button>
          </span>
        )}
      </div>
      <Err fail={fail} field={fail?.field} />
      {GROUPS.map(([kind, title]) => (
        <Group key={kind} kind={kind} title={title} group={group} characterId={characterId} owner={owner} />
      ))}
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
        <CharacterCard key={c.character.id} no={i + 2} owner={c.character.name} characterId={c.character.id} group={c} index={i} total={chars.length} onMove={(d) => moveCharacter(i, d)} />
      ))}
      {chars.length > 0 && <CharacterCard no={chars.length + 2} owner="계정" characterId={null} group={data.account} />}
    </>
  );
}
