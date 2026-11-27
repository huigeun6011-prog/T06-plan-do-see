import type { SqlClient } from "./client";
import { ensureCurrentPlans, type Plan } from "./plans";
import { todaySeoul } from "../lib/time";
import { classifyWeekTodo, weekTotals, type WeekProgress, type WeekTodoKind, type WeekTotals } from "../lib/week-logic";

type WeekTodoFields = WeekProgress & {
  id: string;
  entry_id: string | null;
  title: string;
  tags: string[];
  party_size: number | null;
  memo: string;
  actual_minutes: number;
};

type WeekTodoRow = WeekTodoFields & {
  plan_id: string;
  character_id: string | null;
  character_name: string | null;
  due_at: Date;
};

type WeekRunInfo = {
  today_units: number;
  today_done: boolean;
  other_days_units: number;
  last_run_date: string | null;
  last_run_minutes: number | null;
};

type WeekRunRow = { todo_id: string; run_date: string; units: number; done: boolean; actual_minutes: number | null };
export type WeekTodo = WeekTodoFields & WeekRunInfo & { kind: WeekTodoKind; due_at: string };
export type WeekCharacter = { id: string; name: string };
export type WeekGroup = {
  character: WeekCharacter | null;
  bosses: WeekTodo[];
  missions: WeekTodo[];
  others: WeekTodo[];
  totals: WeekTotals;
};
export type WeekPeriod = { plan: Plan; groups: WeekGroup[] };
export type WeekData = { today: string; weekly: WeekPeriod; monthly: WeekPeriod; totals: WeekTotals };

function emptyRunInfo(): WeekRunInfo {
  return { today_units: 0, today_done: false, other_days_units: 0, last_run_date: null, last_run_minutes: null };
}

function runInfo(rows: WeekRunRow[], today: string): Map<string, WeekRunInfo> {
  const byTodo = new Map<string, WeekRunInfo>();
  for (const row of rows) {
    let info = byTodo.get(row.todo_id);
    if (!info) {
      info = { ...emptyRunInfo(), last_run_date: row.run_date, last_run_minutes: row.actual_minutes };
      byTodo.set(row.todo_id, info);
    }
    if (row.run_date === today) {
      info.today_units = row.units;
      info.today_done = row.done;
    } else if (row.done) info.other_days_units += row.units;
  }
  return byTodo;
}

export async function loadWeek(sql: SqlClient, now: Date): Promise<WeekData> {
  const { weekly, monthly } = await ensureCurrentPlans(sql, now);
  const today = todaySeoul(now);
  const plans = [weekly.root_id, monthly.root_id];
  // Read todo_state and individual runs from the same snapshot.
  const [todoRows, runRows] = await sql.transaction((tx) => [
    tx`
      SELECT t.id, t.plan_id, t.entry_id, t.character_id, c.name AS character_name,
        t.title, t.tags, t.expected_minutes, t.target_count, t.done_n, t.is_done, t.due_at, t.actual_minutes,
        COALESCE(current_entry.party_size, original_entry.party_size) AS party_size,
        COALESCE(current_entry.memo, t.note) AS memo
      FROM todo_state t
      LEFT JOIN game_character c ON c.id = t.character_id
      LEFT JOIN entry current_entry ON current_entry.root_id = t.entry_id AND current_entry.use_yn = 'Y'
      LEFT JOIN entry original_entry ON original_entry.id = t.entry_id
      WHERE t.plan_id = ANY(${plans}::bigint[])
      ORDER BY c.sort_order ASC NULLS LAST, c.id ASC,
        COALESCE(current_entry.sort_order, original_entry.sort_order, 0) ASC, t.id ASC
    `,
    tx`
      SELECT r.todo_id, r.run_date::text, r.units, r.done, r.actual_minutes
      FROM run_record r JOIN todo t ON t.id = r.todo_id
      WHERE t.plan_id = ANY(${plans}::bigint[]) AND t.use_yn = 'Y' AND r.use_yn = 'Y'
      ORDER BY r.run_date DESC
    `,
  ], { isolationLevel: "RepeatableRead" });
  const rows = todoRows as WeekTodoRow[];
  const runs = runInfo(runRows as WeekRunRow[], today);

  function period(plan: Plan): WeekPeriod {
    const groups = new Map<string | null, Omit<WeekGroup, "totals">>();
    for (const row of rows) {
      if (row.plan_id !== plan.root_id) continue;
      const { plan_id, character_id, character_name, due_at, ...fields } = row;
      let group = groups.get(character_id);
      if (!group) {
        group = {
          character: character_id === null ? null : { id: character_id, name: character_name! },
          bosses: [], missions: [], others: [],
        };
        groups.set(character_id, group);
      }
      const kind = classifyWeekTodo(fields);
      const todo: WeekTodo = { ...fields, kind, due_at: due_at.toISOString(), ...(runs.get(row.id) ?? emptyRunInfo()) };
      if (kind === "boss") group.bosses.push(todo);
      else if (kind === "mission") group.missions.push(todo);
      else group.others.push(todo);
    }
    return {
      plan,
      groups: Array.from(groups.values(), (group) => ({
        ...group, totals: weekTotals([...group.bosses, ...group.missions, ...group.others]),
      })),
    };
  }

  return { today, weekly: period(weekly), monthly: period(monthly), totals: weekTotals(rows) };
}
