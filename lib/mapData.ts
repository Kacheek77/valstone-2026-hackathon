import { currentWeek, inWeek, type AllData } from "./data";
import { matchAccounts } from "./match";
import type { Signal } from "./types";

// Plain, serializable data for the client map (VS-8).

export type MapSignal = {
  id: string;
  county: string;
  state: string;
  lat: number;
  lng: number;
  type: Signal["type"];
  severity: Signal["severity"];
  headline: string;
  detail: string;
  source: string;
  module: string;
  repId: string | null;
  week: string;
  thisWeek: boolean; // VS-12 T2: raised in the current week
  n: number; // opportunities generated
  amount: number; // Σ amount of those opportunities
  stages: Record<string, number>;
  matches: number; // accounts the matcher finds
  pending: string[]; // matched accounts with no opportunity yet (drawer scoring)
};

export type MapOpp = { id: string; stage: string; amount: number; lead: string; score: number; signalId: string | null };

export type MapAccount = {
  id: string;
  name: string;
  county: string;
  state: string;
  lat: number;
  lng: number;
  repId: string | null;
  crops: string;
  acres: number;
  owns: string;
  status: "Customer" | "Prospect";
  contact: string;
  role: string;
  email: string;
  note: string;
  lastContact: string | null;
  current: MapOpp[]; // opportunities on this period's signals
  openLead: boolean; // any of them draft, accepted or sent
};

export type MapRep = { id: string; name: string; territory: string; counties: string[] };

export type MapData = { signals: MapSignal[]; accounts: MapAccount[]; reps: MapRep[] };

const OPEN = new Set(["draft", "pushed", "sent"]);

export function buildMapData(data: AllData, periodSignals: Signal[]): MapData {
  const signalIds = new Set(periodSignals.map((s) => s.id));
  const week = currentWeek(data.signals);
  const signals: MapSignal[] = periodSignals.map((s) => {
    const opps = data.opps.filter((o) => o.signal_id === s.id);
    const stages: Record<string, number> = {};
    for (const o of opps) stages[o.stage] = (stages[o.stage] ?? 0) + 1;
    const generated = new Set(opps.map((o) => o.account_id));
    const matched = matchAccounts(s, data.accounts, data.reps);
    return {
      id: s.id,
      county: s.county,
      state: s.state,
      lat: s.lat,
      lng: s.lng,
      type: s.type,
      severity: s.severity,
      headline: s.headline,
      detail: s.detail,
      source: s.source,
      module: s.target_module,
      repId: s.rep_id,
      week: s.week_of, thisWeek: inWeek(s.week_of, week),
      n: opps.length,
      amount: opps.reduce((sum, o) => sum + o.amount, 0),
      stages,
      matches: matched.length,
      pending: matched.filter((m) => !generated.has(m.account.id)).map((m) => m.account.id),
    };
  });

  const accounts: MapAccount[] = data.accounts.map((a) => {
    const current = data.opps
      .filter((o) => o.account_id === a.id && o.signal_id && signalIds.has(o.signal_id))
      .map((o) => ({ id: o.id, stage: o.stage, amount: o.amount, lead: o.lead_with, score: o.score, signalId: o.signal_id }));
    return {
      id: a.id,
      name: a.name,
      county: a.county,
      state: a.state,
      lat: a.lat,
      lng: a.lng,
      repId: a.rep_id,
      crops: a.crops.join(", "),
      acres: a.acres,
      owns: a.modules_owned.length ? a.modules_owned.join(", ") : "none yet",
      status: a.customer_status,
      contact: a.contact_name ?? "",
      role: a.contact_role ?? "",
      email: a.contact_email ?? "",
      note: a.notes ?? "",
      lastContact: a.last_contact,
      current,
      openLead: current.some((o) => OPEN.has(o.stage)),
    };
  });

  const reps: MapRep[] = data.reps
    .filter((r) => !r.is_manager)
    .map((r) => ({ id: r.id, name: r.name, territory: r.territory_name, counties: r.counties }));

  return { signals, accounts, reps };
}
