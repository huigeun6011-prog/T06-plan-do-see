import { describe, expect, it } from "vitest";
import { createCharacter } from "../db/characters";
import { createEntry, deleteEntry, editEntry } from "../db/entries";
import {
  createEventPlan, editPlan, ensureCurrentPlans, ensurePeriodPlan, generateTodos,
  getPlan, getPlanHistory, listPlans, type PeriodTarget,
} from "../db/plans";
import { createTodo } from "../db/todos";
import type { EventPlanInput } from "../lib/validate";
import { useTestDatabase } from "./helpers/db";

const weekStart = new Date("2026-11-25T15:00:00Z");
const monthStart = new Date("2026-11-30T15:00:00Z");
const entryInput = {
  title: "Boss",
  period_kind: "weekly",
  clear_minutes: 8,
  reward_meso: 0,
  party_size: 1,
  memo: "Bring potions",
  target_count: 3,
  tags: ["weekly", "mission", "보스"],
} as const;
const weeklyEntry = { ...entryInput, tags: [...entryInput.tags] };
const planFields = { title: "Event", priority: 1, success_criteria: "Finish", expected_minutes: 20 };
const eventInput: EventPlanInput = { ...planFields, starts_at: weekStart, ends_at: monthStart };

describe("plans and todos", () => {
  const sql = useTestDatabase();

  const todos = () => sql`
    SELECT plan_id, entry_id, title, note, character_id, due_at, priority, tags,
           expected_minutes, target_count, use_yn
    FROM todo ORDER BY plan_id, entry_id
  `;

  it("creates one plan and one todo per matching registration in parallel and on repeated access", async () => {
    const character = await createCharacter(sql, "Hero");
    const original = await createEntry(sql, { ...weeklyEntry, character_id: character.id });
    const edit = await editEntry(sql, original.root_id, original.id, {
      ...weeklyEntry, character_id: character.id, clear_minutes: 10,
    });
    expect(edit).toHaveProperty("id");
    const monthlyEntry = await createEntry(sql, {
      ...weeklyEntry, title: "Monthly Boss", period_kind: "monthly", target_count: 1,
    });

    const initial = await Promise.all(Array.from({ length: 5 }, () => ensureCurrentPlans(sql, weekStart)));
    const [{ weekly, monthly }] = initial;
    expect(initial).toEqual(Array(5).fill({ weekly, monthly }));
    expect(weekly).toMatchObject({
      title: "11/26~12/2 주간", priority: 2, expected_minutes: 30,
      success_criteria: "이번 기간의 모든 할 일 완료",
    });
    expect(monthly).toMatchObject({ title: "2026년 11월 월간", expected_minutes: 8 });
    expect(weekly.root_id).toBe(weekly.id);
    expect(monthly.root_id).toBe(monthly.id);
    const snapshot = await todos();
    expect(snapshot).toHaveLength(2);
    expect(snapshot).toEqual(expect.arrayContaining([
      {
        plan_id: weekly.root_id, entry_id: original.root_id, title: weeklyEntry.title, note: weeklyEntry.memo,
        character_id: character.id, due_at: new Date(weekly.ends_at), priority: 2, tags: weeklyEntry.tags,
        expected_minutes: 30, target_count: 3, use_yn: "Y",
      },
      expect.objectContaining({
        plan_id: monthly.root_id, entry_id: monthlyEntry.root_id, character_id: null,
        due_at: new Date(monthly.ends_at), expected_minutes: 8, target_count: 1,
      }),
    ]));
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(ensureCurrentPlans(sql, weekStart)).resolves.toEqual({ weekly, monthly });
    }
    await expect(listPlans(sql)).resolves.toEqual([weekly, monthly]);
    await expect(todos()).resolves.toEqual(snapshot);
  });

  it("uses the Seoul week and month boundaries and rejects other targets", async () => {
    const justBefore = (instant: Date) => new Date(instant.getTime() - 1_000);
    const oldWeek = await ensurePeriodPlan(sql, "weekly", justBefore(weekStart));
    const newWeek = await ensurePeriodPlan(sql, "weekly", weekStart);
    const nextWeek = await ensurePeriodPlan(sql, "weekly", weekStart, "next");
    expect(oldWeek).toMatchObject({ starts_at: "2026-11-18T15:00:00.000Z", ends_at: newWeek.starts_at });
    expect(newWeek.starts_at).toBe(weekStart.toISOString());
    expect(nextWeek).toMatchObject({ starts_at: newWeek.ends_at, ends_at: "2026-12-09T15:00:00.000Z" });

    const oldMonth = await ensurePeriodPlan(sql, "monthly", justBefore(monthStart));
    const newMonth = await ensurePeriodPlan(sql, "monthly", monthStart);
    expect(oldMonth).toMatchObject({
      starts_at: "2026-10-31T15:00:00.000Z", ends_at: newMonth.starts_at, expected_minutes: 0,
    });
    expect(newMonth).toMatchObject({
      starts_at: monthStart.toISOString(), ends_at: "2026-12-31T15:00:00.000Z", title: "2026년 12월 월간",
    });
    for (const target of ["past", "arbitrary", oldWeek.starts_at]) {
      await expect(ensurePeriodPlan(sql, "weekly", weekStart, target as PeriodTarget))
        .rejects.toMatchObject({ field: "target" });
    }
    await expect(ensurePeriodPlan(sql, "weekly", new Date(NaN))).rejects.toMatchObject({ field: "now" });
  });

  it("fills new registrations, keeps snapshots and never restores a soft-deleted todo", async () => {
    const entry = await createEntry(sql, weeklyEntry);
    const { weekly } = await ensureCurrentPlans(sql, weekStart);
    const revised = await editPlan(sql, weekly.root_id, weekly.id, {
      ...planFields, title: weekly.title, expected_minutes: weekly.expected_minutes,
    });
    expect(revised).toHaveProperty("id");
    const added = await createEntry(sql, { ...weeklyEntry, title: "New registration" });
    await ensureCurrentPlans(sql, weekStart);
    await expect(todos()).resolves.toHaveLength(2);
    expect(await todos()).toEqual(expect.arrayContaining([
      expect.objectContaining({ plan_id: weekly.root_id, entry_id: added.root_id }),
    ]));
    await sql`UPDATE todo SET use_yn = 'N' WHERE plan_id = ${weekly.root_id} AND entry_id = ${added.root_id}`;
    const snapshot = await todos();
    const edit = await editEntry(sql, entry.root_id, entry.id, {
      ...weeklyEntry, title: "Updated title", clear_minutes: 15,
    });
    expect(edit).toHaveProperty("id");
    await ensureCurrentPlans(sql, weekStart);
    await expect(todos()).resolves.toEqual(snapshot);
    await expect(getPlan(sql, weekly.root_id)).resolves.toMatchObject({ expected_minutes: 24 });

    await deleteEntry(sql, added.root_id);
    const later = await ensurePeriodPlan(sql, "weekly", weekStart, "next");
    await generateTodos(sql, later.root_id);
    const laterTodos = (await todos()).filter((todo) => todo.plan_id === later.root_id);
    expect(laterTodos).toEqual([expect.objectContaining({
      entry_id: entry.root_id, title: "Updated title", expected_minutes: 45, use_yn: "Y",
    })]);
    expect(later.expected_minutes).toBe(45);
  });

  it("allows coincident event starts, keeps text unchanged and rejects generation for events", async () => {
    const title = "<script>alert('test')</script>";
    const first = await createEventPlan(sql, { ...eventInput, title });
    const second = await createEventPlan(sql, eventInput);
    expect(first).toMatchObject({
      title, period_kind: "event", starts_at: weekStart.toISOString(), ends_at: monthStart.toISOString(),
    });
    expect(first.root_id).toBe(first.id);
    expect(first.id).not.toBe(second.id);
    expect(new Date(first.created_at).toISOString()).toBe(first.created_at);
    await expect(listPlans(sql, { kind: "event" })).resolves.toEqual([first, second]);
    await expect(generateTodos(sql, first.root_id)).rejects.toMatchObject({ field: "plan_id" });
    await expect(generateTodos(sql, "999")).rejects.toMatchObject({ field: "plan_id" });
    await expect(todos()).resolves.toEqual([]);
    const { weekly } = await ensureCurrentPlans(sql, weekStart);
    await expect(ensurePeriodPlan(sql, "weekly", weekStart)).resolves.toEqual(weekly);
    await expect(listPlans(sql, { kind: "weekly" })).resolves.toEqual([weekly]);
  });

  it("versions edits, permits event date changes and filters only current plans", async () => {
    const original = await createEventPlan(sql, eventInput);
    const first = await editPlan(sql, original.root_id, original.id, { ...planFields, title: "Changed" });
    if (!("id" in first)) throw new Error("First edit unexpectedly conflicted.");
    const endsAt = new Date("2026-12-01T15:00:00Z");
    const second = await editPlan(sql, original.root_id, first.id, {
      ...planFields, starts_at: monthStart, ends_at: endsAt, expected_minutes: 0,
    });
    if (!("id" in second)) throw new Error("Second edit unexpectedly conflicted.");
    const newRow = {
      ...original, id: second.id, starts_at: monthStart.toISOString(), ends_at: endsAt.toISOString(),
      expected_minutes: 0, created_at: expect.any(String),
    };
    await expect(getPlanHistory(sql, original.root_id)).resolves.toEqual([
      { ...original, use_yn: "N" },
      { ...original, id: first.id, title: "Changed", use_yn: "N", created_at: expect.any(String) },
      newRow,
    ]);
    await expect(getPlan(sql, original.root_id)).resolves.toEqual(newRow);
    await expect(getPlan(sql, "999")).resolves.toBeNull();
    await expect(listPlans(sql, { kind: "event", endedBefore: endsAt })).resolves.toEqual([]);
    await expect(listPlans(sql, { kind: "event", endedBefore: new Date(endsAt.getTime() + 1) }))
      .resolves.toEqual([newRow]);
  });

  it("makes one parallel plan edit succeed and leaves recurring boundaries fixed", async () => {
    const original = await ensurePeriodPlan(sql, "weekly", weekStart);
    await expect(editPlan(sql, original.root_id, original.id, { ...planFields, starts_at: monthStart }))
      .rejects.toMatchObject({ field: "starts_at" });
    await expect(editPlan(sql, original.root_id, original.id, { ...planFields, ends_at: monthStart }))
      .rejects.toMatchObject({ field: "ends_at" });
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, attempt) =>
        editPlan(sql, original.root_id, original.id, { ...planFields, title: `Attempt ${attempt}` }),
      ),
    );
    const history = await getPlanHistory(sql, original.root_id);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ ...original, use_yn: "N" });
    expect(history[1]).toMatchObject({
      root_id: original.root_id, starts_at: original.starts_at, ends_at: original.ends_at, use_yn: "Y",
      title: `Attempt ${results.findIndex((result) => "id" in result)}`,
    });
    expect(results.filter((result) => "conflict" in result)).toEqual(Array(4).fill({ conflict: true }));
    expect(results.filter((result) => "id" in result)).toEqual([{ id: history[1].id }]);
  });

  it("creates hand-made todos on the root of a current plan and uses its deadline by default", async () => {
    const character = await createCharacter(sql, "Hero");
    const plan = await createEventPlan(sql, eventInput);
    const changedEnd = new Date("2026-12-02T15:00:00Z");
    const edit = await editPlan(sql, plan.root_id, plan.id, { ...planFields, ends_at: changedEnd });
    if (!("id" in edit)) throw new Error("Edit unexpectedly conflicted.");
    const title = "<script>alert('test')</script>";
    const todo = await createTodo(sql, plan.root_id, { title, expected_minutes: 0 });
    expect(todo).toMatchObject({
      id: expect.any(String), plan_id: plan.root_id, entry_id: null, title,
      due_at: changedEnd.toISOString(), character_id: null, tags: [], priority: 2, target_count: 1,
    });
    expect(new Date(todo.created_at).toISOString()).toBe(todo.created_at);
    await expect(createTodo(sql, plan.root_id, {
      title: "Manual", character_id: character.id, due_at: monthStart, expected_minutes: 10, target_count: 2,
    })).resolves.toMatchObject({ character_id: character.id, due_at: monthStart.toISOString(), target_count: 2 });
    await expect(createTodo(sql, plan.root_id, {
      title: "t".repeat(200), note: "n".repeat(1000), priority: 3, expected_minutes: 2147483647, target_count: 1000,
    })).resolves.toMatchObject({ priority: 3, expected_minutes: 2147483647, target_count: 1000 });
    await expect(createTodo(sql, plan.root_id, { title: "t".repeat(201), expected_minutes: 0 }))
      .rejects.toMatchObject({ field: "title" });
    await expect(createTodo(sql, plan.root_id, { title, expected_minutes: 0, character_id: "999" }))
      .rejects.toMatchObject({ field: "character_id" });
    await expect(createTodo(sql, edit.id, { title, expected_minutes: 0 })).rejects.toMatchObject({ field: "plan_id" });
    await expect(createTodo(sql, "999", { title, expected_minutes: 0 })).rejects.toMatchObject({ field: "plan_id" });
    await sql`UPDATE plan SET use_yn = 'N' WHERE id = ${edit.id}`;
    await expect(createTodo(sql, plan.root_id, { title, expected_minutes: 0 }))
      .rejects.toMatchObject({ field: "plan_id" });
  });
});
