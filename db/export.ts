import type { SqlClient } from "./client";
import { RETRO_TOTALS_SQL, type RetroTotals } from "./retro";
import { todaySeoul } from "../lib/time";

type ExportTable = "game_character" | "entry" | "plan" | "todo" | "run_record";
type ExportRetro = RetroTotals & { derived: true; plan_root_id: string };

export type ExportSnapshot = {
  schema: "pds-schema-v2";
  timezone: "Asia/Seoul";
  exported_at: string;
  tables: Record<ExportTable, Record<string, unknown>[]>;
  retro: ExportRetro[];
};

export async function buildExport(sql: SqlClient, now: Date): Promise<ExportSnapshot> {
  // Cast bigint identifiers and rewards before JSON parsing, which otherwise rounds them.
  const [row] = await sql.query(
    `WITH retro_totals AS (
       SELECT p.id, p.root_id, ${RETRO_TOTALS_SQL}
       FROM plan p
       CROSS JOIN (SELECT $1::text::timestamptz AS as_of) AS clock
       LEFT JOIN todo_state t ON t.plan_id = p.root_id
       WHERE p.use_yn = 'Y'
       GROUP BY p.id
     )
     SELECT jsonb_build_object(
       'schema', 'pds-schema-v2',
       'timezone', 'Asia/Seoul',
       'exported_at', $1::text,
       'tables', jsonb_build_object(
         'game_character', (
           SELECT COALESCE(jsonb_agg(to_jsonb(c) || jsonb_build_object(
             'id', c.id::text
           ) ORDER BY c.id), '[]'::jsonb) FROM game_character c
         ),
         'entry', (
           SELECT COALESCE(jsonb_agg(to_jsonb(e) || jsonb_build_object(
             'id', e.id::text, 'root_id', e.root_id::text,
             'character_id', e.character_id::text, 'reward_meso', e.reward_meso::text
           ) ORDER BY e.id), '[]'::jsonb) FROM entry e
         ),
         'plan', (
           SELECT COALESCE(jsonb_agg(to_jsonb(p) || jsonb_build_object(
             'id', p.id::text, 'root_id', p.root_id::text
           ) ORDER BY p.id), '[]'::jsonb) FROM plan p
         ),
         'todo', (
           SELECT COALESCE(jsonb_agg(to_jsonb(t) || jsonb_build_object(
             'id', t.id::text, 'plan_id', t.plan_id::text, 'entry_id', t.entry_id::text,
             'source_plan_id', t.source_plan_id::text, 'character_id', t.character_id::text
           ) ORDER BY t.id), '[]'::jsonb) FROM todo t
         ),
         'run_record', (
           SELECT COALESCE(jsonb_agg(to_jsonb(r) || jsonb_build_object(
             'id', r.id::text, 'todo_id', r.todo_id::text, 'run_date', to_char(r.run_date, 'YYYY-MM-DD')
           ) ORDER BY r.id), '[]'::jsonb) FROM run_record r
         )
       ),
       'retro', (
         SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'derived', true, 'plan_root_id', r.root_id::text, 'plan_count', r.plan_count,
           'done_count', r.done_count, 'late_count', r.late_count, 'blocked_count', r.blocked_count,
           'expected_minutes', r.todo_expected_minutes, 'actual_minutes', r.actual_minutes,
           'diff_minutes', r.diff_minutes
         ) ORDER BY r.id), '[]'::jsonb) FROM retro_totals r
       )
     ) AS snapshot`,
    [now.toISOString()],
  ) as { snapshot: ExportSnapshot }[];
  for (const retro of row.snapshot.retro) {
    if (![retro.expected_minutes, retro.actual_minutes, retro.diff_minutes].every(Number.isSafeInteger)) {
      throw new RangeError("Minute total exceeds the supported integer range.");
    }
  }
  return row.snapshot;
}

export function exportErrorResponse(): Response {
  return new Response("Could not export the diary.", {
    status: 500,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}

export async function buildResponse(sql: SqlClient, now: Date): Promise<Response> {
  try {
    const snapshot = await buildExport(sql, now);
    const body = JSON.stringify(snapshot).replace(/</g, "\\u003c");
    return new Response(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="pds-export-${todaySeoul(now)}.json"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return exportErrorResponse();
  }
}
