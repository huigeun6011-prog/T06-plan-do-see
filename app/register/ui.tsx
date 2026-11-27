"use client";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { difficultyBadge, displayName } from "../../lib/ui/difficulty";
import { formatMeso, parseMeso } from "../../lib/ui/meso";
import { koMessage } from "../../lib/ui/messages";
import { buildEntryInput, canRegister, isConflict, sameSnapshot, type Snapshot } from "../../lib/ui/register-logic";
import { IconTile } from "../components/IconTile";
import { addEntryAction, commitEntryLinesAction, previewEntryLinesAction, removeEntryAction, saveEntryAction } from "./actions";
import type { EntryInput, EntryKind, EntryLineError, EntryLinePreview, PeriodKind, RegistrationActionResult, RegistrationEntry } from "./types";

export type Fail = { field?: string; message: string };

// Runs a server action; on success (or a conflict) refreshes the server data. router.refresh keeps the scroll position.
export function useRun() {
  const router = useRouter();
  const [, start] = useTransition();
  return async function run<T extends object>(promise: Promise<RegistrationActionResult<T>>) {
    const result = await promise;
    if (result.ok || isConflict(result.message)) start(() => router.refresh());
    return result;
  };
}

export const kindOf = (e: { tags: string[] }): EntryKind => (e.tags.includes("mission") ? "mission" : "boss");

export function Err({ fail, field }: { fail: Fail | null; field?: string }) {
  if (!fail || fail.field !== field) return null;
  return <small className="pd-err" role="alert">{koMessage(fail.field, fail.message)}</small>;
}

const FIELDS = ["title", "clear_minutes", "party_size", "reward_meso", "doping", "memo", "target_count"];

// `initial` is the snapshot taken when editing started; its version id is the only one ever sent.
export function EntryForm({ initial, kind, characterId, sortOrder, submit, onDone, onConflict }: {
  initial?: RegistrationEntry;
  kind: EntryKind;
  characterId: string | null;
  sortOrder: number;
  submit: (input: EntryInput) => Promise<RegistrationActionResult<object>>;
  onDone: () => void;
  onConflict?: (message: string) => void;
}) {
  const [v, setV] = useState({
    title: initial?.title ?? "",
    minutes: initial ? String(initial.clear_minutes) : "",
    party: initial ? String(initial.party_size) : "1",
    reward: initial && initial.reward_meso !== "0" ? String(initial.reward_meso) : "",
    doping: initial && initial.doping !== "base" ? initial.doping : "",
    memo: initial?.memo ?? "",
    target: initial ? String(initial.target_count) : "1",
  });
  const [period, setPeriod] = useState<PeriodKind>(initial?.period_kind ?? "weekly");
  const [fail, setFail] = useState<Fail | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const meso = v.reward.trim() ? parseMeso(v.reward) : 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (meso === null) return setFail({ field: "reward_meso", message: "Invalid reward." });
    setBusy(true);
    const result = await submit(
      buildEntryInput({ original: initial, kind, characterId, sortOrder, reward: meso, fields: { ...v, period } }),
    );
    setBusy(false);
    if (result.ok) onDone();
    else if (isConflict(result.message) && onConflict) onConflict(result.message);
    else setFail({ field: result.field, message: result.message });
  }

  const inv = (f: string) => fail?.field === f;
  return (
    <form className="pd-form" onSubmit={onSubmit}>
      <input aria-label="제목" placeholder={kind === "boss" ? "노말 진힐라" : "지하수로"} value={v.title} onChange={set("title")} aria-invalid={inv("title")} maxLength={100} autoFocus={!!initial} />
      <Err fail={fail} field="title" />
      <div className="pd-formrow">
        <input aria-label="분" placeholder="분" inputMode="numeric" value={v.minutes} onChange={set("minutes")} aria-invalid={inv("clear_minutes")} />
        <input aria-label="인원" placeholder="인원" inputMode="numeric" value={v.party} onChange={set("party")} aria-invalid={inv("party_size")} />
        <input aria-label="횟수" placeholder="횟수" inputMode="numeric" value={v.target} onChange={set("target")} aria-invalid={inv("target_count")} />
      </div>
      <Err fail={fail} field="clear_minutes" />
      <Err fail={fail} field="party_size" />
      <Err fail={fail} field="target_count" />
      <input aria-label="보상 (메소)" placeholder="보상 62억" value={v.reward} onChange={set("reward")} aria-invalid={inv("reward_meso") || meso === null} />
      <small className="pd-dim" aria-live="polite">{meso === null ? "" : formatMeso(meso)}</small>
      <Err fail={fail} field="reward_meso" />
      <Switch label="주기" value={period} options={[["weekly", "주"], ["monthly", "월"]]} onChange={setPeriod} />
      <input aria-label="도핑" placeholder="도핑" value={v.doping} onChange={set("doping")} aria-invalid={inv("doping")} />
      <Err fail={fail} field="doping" />
      <input aria-label="메모" placeholder="메모" value={v.memo} onChange={set("memo")} aria-invalid={inv("memo")} />
      <Err fail={fail} field="memo" />
      {fail && !FIELDS.includes(fail.field ?? "") && <small className="pd-err" role="alert">{koMessage(fail.field, fail.message)}</small>}
      <div className="pd-formrow">
        <button type="submit" className="pd-pill" disabled={busy}>저장</button>
        <button type="button" className="pd-pill" onClick={onDone}>취소</button>
      </div>
    </form>
  );
}

export function Switch<T extends string>({ label, value, options, onChange, disabled }: {
  label: string; value: T; options: [T, string][]; onChange: (v: T) => void; disabled?: boolean;
}) {
  return (
    <div className="pd-switch" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button key={key} type="button" className="pd-pill" aria-pressed={value === key} disabled={disabled} onClick={() => onChange(key)}>{text}</button>
      ))}
    </div>
  );
}

export function Row({ entry, owner, characterId, first, last, onMove }: {
  entry: RegistrationEntry;
  owner: string;
  characterId: string | null;
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => void;
}) {
  const run = useRun();
  const [draft, setDraft] = useState<RegistrationEntry | null>(null); // entry as it was when editing started
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fail, setFail] = useState<Fail | null>(null);
  const mainRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const kind = kindOf(entry);

  useEffect(() => {
    if (!draft && wasEditing.current) mainRef.current?.focus();
    wasEditing.current = !!draft;
  }, [draft]);

  if (draft) {
    return (
      <li className="pd-row" data-open="true">
        <EntryForm
          initial={draft}
          kind={kind}
          characterId={characterId}
          sortOrder={draft.sort_order}
          submit={(input) => run(saveEntryAction(draft.root_id, draft.version_id, input))}
          onDone={() => setDraft(null)}
          onConflict={(message) => {
            setDraft(null);
            setFail({ message });
          }}
        />
      </li>
    );
  }

  const mission = kind === "mission";
  const badge = mission ? null : difficultyBadge(entry.title);
  const name = mission ? entry.title : displayName(entry.title);
  const reward = formatMeso(entry.reward_meso);
  const label = [owner, entry.title, `${entry.clear_minutes}분`, entry.party_size > 1 ? `${entry.party_size}인` : "", entry.period_kind === "weekly" ? "주간" : "월간", reward !== "0" ? `${reward} 메소` : "", entry.memo]
    .filter(Boolean)
    .join(", ");

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    const r = await run(removeEntryAction(entry.root_id));
    if (!r.ok) setFail({ field: r.field, message: r.message });
    setDeleting(false);
    setConfirm(false);
  }

  return (
    <li className="pd-row" data-kind={kind}>
      <button ref={mainRef} type="button" className="pd-rowmain" aria-label={`${label} (수정)`} title={label} onClick={() => { setFail(null); setDraft(entry); }}>
        <IconTile label={entry.title} />
        {badge ? <span className="pd-badge" data-tone={badge.tone}>{badge.letter}</span> : <span className="pd-badge pd-nobadge" aria-hidden="true" />}
        <span className="pd-rowname">{name}</span>
        <span className="pd-rowmeta">
          <span>{entry.clear_minutes}</span>
          {entry.party_size > 1 && <span>{entry.party_size}인</span>}
          <span className="pd-chip">{entry.period_kind === "weekly" ? "주" : "월"}</span>
          {reward !== "0" && <span>{reward}</span>}
        </span>
        {entry.memo && <span className="pd-memo">{entry.memo}</span>}
      </button>
      <span className="pd-acts">
        <button type="button" className="pd-sq" aria-label={`${name} 위로`} disabled={first} onClick={() => onMove(-1)}>↑</button>
        <button type="button" className="pd-sq" aria-label={`${name} 아래로`} disabled={last} onClick={() => onMove(1)}>↓</button>
        {confirm ? (
          <>
            <button type="button" className="pd-sq pd-danger" aria-label={`${name} 삭제 확인`} disabled={deleting} onClick={remove}>✓</button>
            <button type="button" className="pd-sq" aria-label={`${name} 삭제 취소`} disabled={deleting} onClick={() => setConfirm(false)}>↩</button>
          </>
        ) : (
          <button type="button" className="pd-sq" aria-label={`${name} 삭제`} onClick={() => setConfirm(true)}>✕</button>
        )}
      </span>
      {fail && <Err fail={fail} field={fail.field} />}
    </li>
  );
}

export function GroupAdd({ kind, characterId, sortOrder, children }: { kind: EntryKind; characterId: string | null; sortOrder: number; children?: ReactNode }) {
  const run = useRun();
  const [adding, setAdding] = useState(false);
  return (
    <>
      <button type="button" className="pd-sq" aria-label={`${kind === "boss" ? "보스" : "미션"} 추가`} aria-expanded={adding} onClick={() => setAdding(!adding)}>+</button>
      {adding && (
        <div className="pd-addform">
          <EntryForm kind={kind} characterId={characterId} sortOrder={sortOrder} submit={(input) => run(addEntryAction(input))} onDone={() => setAdding(false)} />
        </div>
      )}
      {children}
    </>
  );
}

const rowText = (r: EntryLinePreview["rows"][number]) =>
  [r.input.title, `${r.input.clear_minutes}분`, r.input.party_size > 1 ? `${r.input.party_size}인` : "", r.input.memo].filter(Boolean).join(" · ");
const errText = (e: EntryLineError) => `${e.line ? `${e.line}줄 ` : ""}${koMessage(e.field, e.message)}`;

export function PasteBox({ characterId }: { characterId: string | null }) {
  const run = useRun();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<EntryKind>("boss");
  const [period, setPeriod] = useState<PeriodKind>("weekly");
  const [preview, setPreview] = useState<{ snap: Snapshot; rows: EntryLinePreview["rows"]; errors: EntryLineError[] } | null>(null);
  const [problem, setProblem] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const current: Snapshot = { text, kind, period, characterId };
  const latest = useRef(current);
  latest.current = current;

  useEffect(() => {
    if (!text.trim()) return setPreview(null);
    const snap: Snapshot = { text, kind, period, characterId };
    const timer = setTimeout(async () => {
      const r = await previewEntryLinesAction(snap.text, { kind: snap.kind, period_kind: snap.period, character_id: snap.characterId });
      if (!sameSnapshot(snap, latest.current)) return; // out-of-order or stale response
      setPreview(
        r.ok ? { snap, rows: r.rows, errors: r.errors } : { snap, rows: [], errors: [{ line: 0, field: r.field ?? "text", message: r.message }] },
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [text, kind, period, characterId]);

  async function commit() {
    if (busy || !preview || !canRegister(current, { snap: preview.snap, rows: preview.rows.length, errors: preview.errors.length })) return;
    const snap = preview.snap;
    setBusy(true);
    setProblem([]);
    const r = await run(commitEntryLinesAction(snap.text, { kind: snap.kind, period_kind: snap.period, character_id: snap.characterId }));
    setBusy(false);
    if (r.ok) {
      if (sameSnapshot(latest.current, snap)) {
        setText("");
        setPreview(null);
      }
    } else if (r.conflictingLines?.length) {
      setProblem(r.conflictingLines.map((l) => `${l}줄 ${koMessage("title", "already exists")}`));
    } else {
      setProblem(r.errors?.length ? r.errors.map(errText) : [koMessage(r.field, r.message)]);
    }
  }

  const ready = !!preview && canRegister(current, { snap: preview.snap, rows: preview.rows.length, errors: preview.errors.length });
  return (
    <div className="pd-paste">
      <textarea aria-label="붙여넣기" placeholder="이름 / 분 / 인원 / 메모" rows={3} value={text} disabled={busy} onChange={(e) => setText(e.target.value)} aria-invalid={!!preview?.errors.length} />
      <div className="pd-formrow">
        <Switch label="종류" value={kind} options={[["boss", "보스"], ["mission", "미션"]]} onChange={setKind} disabled={busy} />
        <Switch label="주기" value={period} options={[["weekly", "주"], ["monthly", "월"]]} onChange={setPeriod} disabled={busy} />
      </div>
      {preview && (
        <ul className="pd-previewlist" aria-live="polite">
          {preview.rows.map((r) => <li key={r.line}>{rowText(r)}</li>)}
          {preview.errors.map((e, i) => <li key={`e${i}`} className="pd-err">{errText(e)}</li>)}
        </ul>
      )}
      {problem.length > 0 && (
        <ul className="pd-previewlist" role="alert">
          {problem.map((p, i) => <li key={i} className="pd-err">{p}</li>)}
        </ul>
      )}
      <button type="button" className="pd-pill" disabled={!ready || busy} onClick={commit}>등록</button>
    </div>
  );
}
