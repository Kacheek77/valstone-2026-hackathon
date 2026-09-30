import type { AllData } from "./data";
import type { Opportunity, OutreachStep } from "./types";

const DAY = 86_400_000;

// Steps are due relative to when the lead was accepted.
export function dueDate(opp: Pick<Opportunity, "pushed_at" | "created_at">, day: number): Date {
  const base = Date.parse(opp.pushed_at ?? opp.created_at);
  return new Date(base + day * DAY);
}

// A step's due date: its rescheduled date when set (VS-12 T7), else accepted + day.
export function stepDue(opp: Pick<Opportunity, "pushed_at" | "created_at">, step: Pick<OutreachStep, "day" | "due_on">): Date {
  if (step.due_on) return new Date(`${step.due_on.slice(0, 10)}T12:00:00-05:00`);
  return dueDate(opp, step.day);
}

export function formatDue(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" });
}

export type DisplayStatus = "Planned" | "Scheduled" | "Done ✓" | "Overdue" | "Sent ✓" | "Skipped";

function endOfDay(d: Date): number {
  return d.getTime() + DAY - 1;
}

// VS-12 T7: a planned or scheduled step whose date has passed shows as Overdue.
export function stepStatus(opp: Opportunity, step: OutreachStep, now = Date.now()): DisplayStatus {
  if (step.status === "done") return "Done ✓";
  if (step.status === "skipped") return "Skipped";
  if (endOfDay(stepDue(opp, step)) < now) return "Overdue";
  return step.status === "scheduled" ? "Scheduled" : "Planned";
}

// Steps still to do: not done, not skipped.
export function isOpenStep(step: Pick<OutreachStep, "status">): boolean {
  return step.status === "planned" || step.status === "scheduled";
}

// Day 0 is the opening email: it mirrors the opportunity's own stage.
export function day0Status(opp: Opportunity, now = Date.now()): DisplayStatus {
  if (opp.stage === "sent" || opp.stage === "won" || opp.stage === "lost") return "Sent ✓";
  if (opp.stage === "pushed") return endOfDay(dueDate(opp, 0)) < now ? "Overdue" : "Scheduled";
  return "Planned";
}

export function stepsFor(oppId: string, steps: OutreachStep[]): OutreachStep[] {
  return steps.filter((s) => s.opportunity_id === oppId).sort((a, b) => a.day - b.day);
}

// "n/4 steps", counting Day 0 as done once the email is sent. Null when no
// sequence has been built.
export function stepProgress(opp: Opportunity, steps: OutreachStep[]): { done: number; total: number } | null {
  const mine = stepsFor(opp.id, steps);
  if (mine.length === 0) return null;
  const day0 = day0Status(opp) === "Sent ✓" ? 1 : 0;
  const counted = mine.filter((s) => s.status !== "skipped");
  return { done: day0 + counted.filter((s) => s.status === "done").length, total: counted.length + 1 };
}

export type Task = { step: OutreachStep; opp: Opportunity; due: Date; overdue: boolean };

// Scheduled, unfinished steps due within the next `days` days (overdue ones
// included), for one rep or everyone. Closed opportunities are skipped.
export function tasksDue(data: AllData, repId: string | null, days = 7, now = Date.now()): Task[] {
  const oppById = new Map(data.opps.map((o) => [o.id, o]));
  const tasks: Task[] = [];
  for (const step of data.steps) {
    if (step.status !== "scheduled") continue;
    const opp = oppById.get(step.opportunity_id);
    if (!opp || (repId !== null && opp.rep_id !== repId)) continue;
    if (opp.stage === "won" || opp.stage === "lost") continue;
    const due = stepDue(opp, step);
    if (due.getTime() > now + days * DAY) continue;
    tasks.push({ step, opp, due, overdue: endOfDay(due) < now });
  }
  return tasks.sort((a, b) => a.due.getTime() - b.due.getTime());
}
