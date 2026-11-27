"use client";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { difficultyBadge, displayName } from "../../lib/ui/difficulty";
import { formatMeso, parseMeso } from "../../lib/ui/meso";
import { koMessage } from "../../lib/ui/messages";
import { IconTile } from "../components/IconTile";
import { commitEntryLinesAction, previewEntryLinesAction, removeEntryAction } from "./actions";
import type { EntryInput, EntryKind, EntryLineError, EntryLinePreview, PeriodKind, RegistrationActionResult, RegistrationEntry } from "./types";

export type Fail = { field?: string; message: string };

// Runs a server action; on success (or a conflict) refreshes the server data. router.refresh keeps the scroll position.
export function useRun() {
  const router = useRouter();
  const [, start] = useTransition();
  return async function run<T extends object>(promise: Promise<RegistrationActionResult<T>>) {
    const result = await promise;
    if (result.ok || /먼저 수정/.test(result.message)) start(() => router.refresh());
    return result;
  };
}

export const kindOf = (e: { tags: string[] }): EntryKind => (e.tags.includes("mission") ? "mission" : "boss");

export function Err({ fail, field }: { fail: Fail | null; field?: string }) {
  if (!fail || fail.field !== field) return null;
  return <small className="pd-err" role="alert">{koMessage(fail.field, fail.message)}</small>;
}

const FIELDS = ["title", "clear_minutes", "party_size", "reward_meso", "doping", "memo", "target_count"];

export function EntryForm({ initial, kind, characterId, sortOrder, submit, onDone }: {
  initial?: RegistrationEntry;
  kind: EntryKind;
  characterId: string | null;
  sortOrder: number;
  submit: (input: EntryInput) => Promise<RegistrationActionResult<object>>;
  onDone: () => void;
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
    const tags = [...(initial?.tags ?? []).filter((t) => t !== "boss" && t !== "mission"), kind];
    const result = await submit({
      title: v.title,
      period_kind: period,
      clear_minutes: Number(v.minutes),
      reward_meso: meso,
      party_size: Number(v.party),
      doping: v.doping.trim() || undefined,
      memo: v.memo,
      target_count: Number(v.target),
      tags,
      sort_order: initial?.sort_order ?? sortOrder,
      character_id: characterId,
    });
    setBusy(false);
    if (result.ok) onDone();
    else setFail({ field: result.field, message: result.message });
  }

  const inv = (f: string) => fail?.field === f;
  return (
    <form className="pd-form" onSubmit={onSubmit}>
      <input aria-label="제목" placeholder={kind === "boss" ? "노말 진힐라" : "지하수로"} value={v.title} onChange={set("title")} aria-invalid={inv("title")} maxLength={100} />
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

export function Switch<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: [T, string][]; onChange: (v: T) => void;
}) {
  return (
    <div className="pd-switch" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button key={key} type="button" className="pd-pill" aria-pressed={value === key} onClick={() => onChange(key)}>{text}</button>
      ))}
    </div>
  );
}

export function Row({ entry, owner, first, last, onMove, edit }: {
  entry: RegistrationEntry;
  owner: string;
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => void;
  edit: (done: () => void) => React.ReactNode;
}) {
  const run = useRun();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [fail, setFail] = useState<Fail | null>(null);
  const mission = kindOf(entry) === "mission";
  const badge = mission ? null : difficultyBadge(entry.title);
  const reward = formatMeso(entry.reward_meso);
  const label = [owner, entry.title, `${entry.clear_minutes}분`, entry.party_size > 1 ? `${entry.party_size}인` : "", entry.period_kind === "weekly" ? "주간" : "월간", reward !== "0" ? `${reward} 메소` : "", entry.memo]
    .filter(Boolean)
    .join(", ");

  if (open) return <li className="pd-row" data-open="true">{edit(() => setOpen(false))}</li>;
  return (
    <li className="pd-row" data-kind={mission ? "mission" : "boss"}>
      <button type="button" className="pd-rowmain" aria-label={`${label} (수정)`} title={label} onClick={() => setOpen(true)}>
        <IconTile label={entry.title} />
        {badge ? <span className="pd-badge" data-tone={badge.tone}>{badge.letter}</span> : <span className="pd-badge pd-nobadge" aria-hidden="true" />}
        <span className="pd-rowname">{mission ? entry.title : displayName(entry.title)}</span>
        <span className="pd-rowmeta">
          <span>{entry.clear_minutes}</span>
          {entry.party_size > 1 && <span>{entry.party_size}인</span>}
          <span className="pd-chip">{entry.period_kind === "weekly" ? "주" : "월"}</span>
          {reward !== "0" && <span>{reward}</span>}
        </span>
        {entry.memo && <span className="pd-memo">{entry.memo}</span>}
      </button>
      <span className="pd-acts">
        <button type="button" className="pd-sq" aria-label="위로" disabled={first} onClick={() => onMove(-1)}>↑</button>
        <button type="button" className="pd-sq" aria-label="아래로" disabled={last} onClick={() => onMove(1)}>↓</button>
        {confirm ? (
          <>
            <button
              type="button"
              className="pd-sq pd-danger"
              aria-label="삭제 확인"
              onClick={async () => {
                const r = await run(removeEntryAction(entry.root_id));
                if (!r.ok) setFail({ field: r.field, message: r.message });
                setConfirm(false);
              }}
            >
              ✓
            </button>
            <button type="button" className="pd-sq" aria-label="취소" onClick={() => setConfirm(false)}>↩</button>
          </>
        ) : (
          <button type="button" className="pd-sq" aria-label="삭제" onClick={() => setConfirm(true)}>✕</button>
        )}
      </span>
      {fail && <Err fail={fail} field={fail.field} />}
    </li>
  );
}

const rowText = (r: EntryLinePreview["rows"][number]) => `${r.input.title} · ${r.input.clear_minutes}분${r.input.party_size > 1 ? ` · ${r.input.party_size}인` : ""}`;
const errText = (e: EntryLineError) => `${e.line ? `${e.line}줄 ` : ""}${koMessage(e.field, e.message)}`;

export function PasteBox({ characterId }: { characterId: string | null }) {
  const run = useRun();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<EntryKind>("boss");
  const [period, setPeriod] = useState<PeriodKind>("weekly");
  const [preview, setPreview] = useState<EntryLinePreview | null>(null);
  const [problem, setProblem] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!text.trim()) return setPreview(null);
    let stale = false;
    const timer = setTimeout(async () => {
      const r = await previewEntryLinesAction(text, { kind, period_kind: period, character_id: characterId });
      if (stale) return;
      setPreview(r.ok ? { rows: r.rows, errors: r.errors } : { rows: [], errors: [{ line: 0, field: r.field ?? "text", message: r.message }] });
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [text, kind, period, characterId]);

  async function commit() {
    if (busy) return;
    setBusy(true);
    const r = await run(commitEntryLinesAction(text, { kind, period_kind: period, character_id: characterId }));
    setBusy(false);
    if (r.ok) {
      setText("");
      setProblem([]);
    } else if (r.conflictingLines?.length) {
      setProblem(r.conflictingLines.map((l) => `${l}줄 ${koMessage("title", "already exists")}`));
    } else {
      setProblem(r.errors?.length ? r.errors.map(errText) : [koMessage(r.field, r.message)]);
    }
  }

  const ok = !!preview && preview.rows.length > 0 && preview.errors.length === 0;
  return (
    <div className="pd-paste">
      <textarea aria-label="붙여넣기" placeholder="이름 / 분 / 인원 / 메모" rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-invalid={!!preview?.errors.length} />
      <div className="pd-formrow">
        <Switch label="종류" value={kind} options={[["boss", "보스"], ["mission", "미션"]]} onChange={setKind} />
        <Switch label="주기" value={period} options={[["weekly", "주"], ["monthly", "월"]]} onChange={setPeriod} />
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
      <button type="button" className="pd-pill" disabled={!ok || busy} onClick={commit}>등록</button>
    </div>
  );
}
