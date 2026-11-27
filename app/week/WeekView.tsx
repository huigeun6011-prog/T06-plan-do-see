"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { difficultyBadge, displayName } from "../../lib/ui/difficulty";
import { koMessage } from "../../lib/ui/messages";
import { boxStates, formatMinutes, groupHasVisible, hasAnyTodos, nextTodayCount, parseMinutesInput, visibleTodos } from "../../lib/ui/week-ui";
import { IconTile } from "../components/IconTile";
import { Section } from "../components/Shell";
import { setCountAction, setDoneAction, setMinutesAction } from "./actions";
import type { WeekData, WeekGroup, WeekPeriod, WeekTodo } from "./types";

type Report = (message: string | null) => void;

function useRefresh() {
  const router = useRouter();
  const [, start] = useTransition();
  return () => start(() => router.refresh());
}

const failText = (r: { field?: string; message: string }) => koMessage(r.field, r.message);

function MinutesChip({ todo, runDate, report }: { todo: WeekTodo; runDate: string; report: Report }) {
  const refresh = useRefresh();
  const current = todo.last_run_date === runDate ? todo.last_run_minutes : null;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    const parsed = parseMinutesInput(text);
    if (!parsed.ok) return setBad(true);
    setBusy(true);
    const r = await setMinutesAction(todo.id, runDate, parsed.value);
    setBusy(false);
    if (r.ok) {
      report(null);
      setOpen(false);
      refresh();
    } else report(failText(r));
  }

  if (!open) {
    return (
      <button type="button" className="pd-chipbtn" aria-label={`${todo.title} 걸린 시간`} onClick={() => { setText(current === null ? "" : String(current)); setBad(false); setOpen(true); }}>
        {current === null ? "분" : current}
      </button>
    );
  }
  return (
    <form className="pd-minform" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <input aria-label="분" inputMode="numeric" value={text} onChange={(e) => { setText(e.target.value); setBad(false); }} aria-invalid={bad} autoFocus />
      <button type="submit" className="pd-sq" aria-label="저장" disabled={busy}>✓</button>
      <button type="button" className="pd-sq" aria-label="취소" onClick={() => setOpen(false)}>↩</button>
    </form>
  );
}

function WeekTile({ todo, owner, today, open, onOpen, report }: {
  todo: WeekTodo; owner: string; today: string; open: boolean; onOpen: () => void; report: Report;
}) {
  const refresh = useRefresh();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (optimistic !== null && todo.is_done === optimistic) setOptimistic(null);
  }, [todo.is_done, optimistic]);

  const cumulative = todo.target_count > 1;
  const done = cumulative ? todo.is_done : (optimistic ?? todo.is_done);
  const badge = todo.kind === "boss" ? difficultyBadge(todo.title) : null;
  const party = todo.party_size && todo.party_size > 1 ? todo.party_size : 0;
  const state = cumulative ? `${todo.done_n}/${todo.target_count}` : done ? "완료" : "";
  const label = [owner, todo.title, todo.expected_minutes ? `${todo.expected_minutes}분` : "", party ? `${party}인` : "", state].filter(Boolean).join(", ");
  const runDate = cumulative ? (todo.today_done ? today : null) : done && todo.last_run_date ? todo.last_run_date : null;

  async function click() {
    if (cumulative) return onOpen();
    if (busy) return;
    const next = !done;
    setOptimistic(next);
    setBusy(true);
    report(null);
    const r = await setDoneAction(todo.id, next);
    setBusy(false);
    if (r.ok) refresh();
    else {
      setOptimistic(null);
      report(failText(r));
    }
  }

  return (
    <div className="pd-wtile">
      <button
        type="button"
        className="pd-tile"
        data-done={done}
        aria-pressed={cumulative ? undefined : done}
        aria-expanded={cumulative ? open : undefined}
        aria-label={label}
        title={label}
        disabled={busy}
        onClick={click}
      >
        <span className="pd-iconwrap">
          <IconTile label={todo.title} />
          {cumulative ? <span className="pd-mark">{todo.done_n}/{todo.target_count}</span> : done && <span className="pd-mark">✓</span>}
        </span>
        <span className="pd-meta">
          {badge && <span className="pd-badge" data-tone={badge.tone}>{badge.letter}</span>}
          {party ? <span className="pd-party">{party}</span> : null}
        </span>
        <span className="pd-name">{todo.kind === "boss" ? displayName(todo.title) : todo.title}</span>
      </button>
      {runDate && <MinutesChip todo={todo} runDate={runDate} report={report} />}
    </div>
  );
}

function BoxEditor({ todo, onClose, report }: { todo: WeekTodo; onClose: () => void; report: Report }) {
  const refresh = useRefresh();
  const [draft, setDraft] = useState(todo.today_units);
  const [busy, setBusy] = useState(false);
  const locked = todo.other_days_units;
  const boxes = boxStates(todo.target_count, locked, draft);
  const total = boxes.filter((b) => b !== "empty").length;

  async function confirm() {
    setBusy(true);
    const r = await setCountAction(todo.id, boxes.filter((b) => b === "filled").length);
    setBusy(false);
    if (r.ok) {
      report(null);
      onClose();
      refresh();
    } else report(failText(r));
  }

  return (
    <div className="pd-boxes" role="group" aria-label={`${todo.title} ${total}/${todo.target_count}`}>
      <span className="pd-boxlist">
        {boxes.map((b, i) =>
          b === "locked" ? (
            <button key={i} type="button" className="pd-box" data-state="locked" aria-disabled="true" aria-label={`${i + 1} 잠김`} />
          ) : (
            <button key={i} type="button" className="pd-box" data-state={b} aria-pressed={b === "filled"} aria-label={`${i + 1}`} disabled={busy} onClick={() => setDraft(nextTodayCount(draft, i, locked, todo.target_count))} />
          ),
        )}
      </span>
      <span className="pd-dim">{total}/{todo.target_count}</span>
      <button type="button" className="pd-pill" disabled={busy} onClick={confirm}>확정</button>
      <button type="button" className="pd-pill" disabled={busy} onClick={onClose}>취소</button>
    </div>
  );
}

function TileRow({ todos, owner, today, only }: { todos: WeekTodo[]; owner: string; today: string; only: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const shown = visibleTodos(todos, only);
  if (!shown.length) return null;
  const editor = shown.find((t) => t.id === editing && t.target_count > 1);
  return (
    <div className="pd-wrowbox">
      <div className="pd-wrow">
        {shown.map((t) => (
          <WeekTile key={t.id} todo={t} owner={owner} today={today} open={editing === t.id} onOpen={() => setEditing(editing === t.id ? null : t.id)} report={setMessage} />
        ))}
      </div>
      {editor && <BoxEditor key={editor.id} todo={editor} onClose={() => setEditing(null)} report={setMessage} />}
      {message && <p className="pd-err" role="status">{message}</p>}
    </div>
  );
}

function GroupCard({ group, today, only }: { group: WeekGroup; today: string; only: boolean }) {
  const owner = group.character?.name ?? "계정";
  const t = group.totals;
  return (
    <article className="pd-char" aria-label={owner}>
      <div className="pd-portrait">
        <IconTile label={owner} round size={72} />
        <span className="pd-job" title={owner}>{owner}</span>
      </div>
      <div className="pd-right">
        <p className="pd-sum">
          <span className="pd-sr">{`완료 ${t.done_todos}/${t.total_todos}, 남은 ${formatMinutes(t.remaining_minutes)}`}</span>
          <span aria-hidden="true">☑ {t.done_todos}/{t.total_todos}</span>
          <span aria-hidden="true">⏱ {formatMinutes(t.remaining_minutes)}</span>
        </p>
        <TileRow todos={group.bosses} owner={owner} today={today} only={only} />
        <TileRow todos={group.missions} owner={owner} today={today} only={only} />
        <TileRow todos={group.others} owner={owner} today={today} only={only} />
      </div>
    </article>
  );
}

function Period({ no, title, period, today, only }: { no: string; title: string; period: WeekPeriod; today: string; only: boolean }) {
  const groups = period.groups.filter((g) => groupHasVisible(g, only));
  if (!groups.length) return null;
  return (
    <Section no={no} title={title}>
      {groups.map((g) => (
        <GroupCard key={g.character?.id ?? "account"} group={g} today={today} only={only} />
      ))}
    </Section>
  );
}

export function WeekView({ data }: { data: WeekData }) {
  const [only, setOnly] = useState(false);
  const periods = [data.weekly, data.monthly];

  if (!hasAnyTodos(periods)) {
    return (
      <Section no="01" title="주간">
        <p>
          <Link href="/register">등록</Link>
          <span className="pd-dim"> 항목이 없습니다</span>
        </p>
      </Section>
    );
  }
  const left = data.totals.remaining_todos;
  return (
    <>
      <div className="pd-strip">
        <span>남은 {left}개 · {formatMinutes(data.totals.remaining_minutes)}</span>
        <button type="button" className="pd-pill" aria-pressed={only} onClick={() => setOnly(!only)}>남은 것만</button>
      </div>
      {only && left === 0 && <p className="pd-dim">모두 완료</p>}
      <Period no="01" title="주간" period={data.weekly} today={data.today} only={only} />
      <Period no="02" title="월간" period={data.monthly} today={data.today} only={only} />
    </>
  );
}
