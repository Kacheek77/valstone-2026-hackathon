export const MODULES = [
  "Irrigation Scheduling",
  "Field-Work Planner",
  "Yield & Insurance Records",
] as const;
export type Module = (typeof MODULES)[number];

export type SignalType = "drought" | "rain" | "heat";
export type Severity = "High" | "Medium";
export type Stage = "draft" | "pushed" | "sent" | "won" | "lost";

// The module each kind of weather makes urgent (signals also carry it as
// target_module; this is the fallback).
export const TYPE_MODULE: Record<SignalType, Module> = {
  drought: "Irrigation Scheduling",
  rain: "Field-Work Planner",
  heat: "Yield & Insurance Records",
};

export type Rep = {
  id: string; // REP-01 .. REP-06, MGR-01
  name: string;
  territory_name: string;
  counties: string[]; // "Finney County, KS"
  quota_quarterly: number;
  is_manager: boolean;
};

export type Account = {
  id: string; // ACC-001
  name: string;
  county: string; // "Finney County"
  state: string;
  lat: number;
  lng: number;
  crops: string[];
  acres: number;
  modules_owned: string[];
  customer_status: "Customer" | "Prospect";
  contact_name: string | null;
  contact_email: string | null;
  last_contact: string | null;
  rep_id: string | null;
};

export type Signal = {
  id: string; // SIG-0023
  week_of: string;
  county: string; // "Finney County"
  state: string;
  lat: number;
  lng: number;
  type: SignalType;
  severity: Severity;
  headline: string;
  detail: string;
  source: string;
  target_module: string;
  status: "new" | "processed";
  rep_id: string | null;
  drought_level: number | null; // null in the seed; see droughtLevel()
};

export type Opportunity = {
  id: string; // OPP-0042
  signal_id: string | null; // null = list-prospected
  account_id: string;
  rep_id: string | null;
  score: number;
  lead_with: string;
  why_now: string;
  email_subject: string;
  email_body: string;
  amount: number;
  stage: Stage;
  ai_offline: boolean;
  is_signal_driven: boolean;
  is_off_territory: boolean;
  sf_opportunity_id: string | null;
  sf_error: string | null;
  created_at: string;
  pushed_at: string | null;
  sent_at: string | null;
};

export type PriceList = Record<Module, number> & { setup: number };

export type Settings = { price_list: PriceList };

// Stages that count as "acted on" / "captured", and as open pipeline.
export const ACTED_STAGES: Stage[] = ["pushed", "sent", "won"];
export const OPEN_STAGES: Stage[] = ["draft", "pushed", "sent"];

// USDM level after the change. The seed leaves drought_level null, so read it
// from the headline ("Finney, KS moved D2 → D3 (Extreme Drought)").
export function droughtLevel(s: Pick<Signal, "type" | "headline" | "drought_level">): number | null {
  if (s.type !== "drought") return null;
  if (s.drought_level !== null && s.drought_level !== undefined) return s.drought_level;
  const m = s.headline.match(/→\s*D([0-4])/);
  return m ? Number(m[1]) : null;
}

// "Finney County" -> "Finney"
export function shortCounty(county: string): string {
  return county.replace(/ County$/, "");
}
