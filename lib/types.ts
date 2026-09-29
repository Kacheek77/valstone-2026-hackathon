export const MODULES = [
  "Irrigation Scheduling",
  "Field-Work Planner",
  "Yield & Insurance Records",
] as const;
export type Module = (typeof MODULES)[number];

export type SignalType = "drought" | "rain" | "heat";
export type Severity = "High" | "Medium";
export type Stage = "draft" | "pushed" | "sent" | "won" | "lost";

// The module each kind of weather makes urgent.
export const TYPE_MODULE: Record<SignalType, Module> = {
  drought: "Irrigation Scheduling",
  rain: "Field-Work Planner",
  heat: "Yield & Insurance Records",
};

export type Rep = {
  id: number;
  name: string;
  territory_name: string;
  counties: string[];
  is_manager: boolean;
};

export type Account = {
  id: string;
  name: string;
  contact_name: string | null;
  county: string;
  state: string;
  lat: number;
  lng: number;
  crops: string[];
  acres: number;
  modules_owned: string[];
  last_contact: string | null;
  rep_id: number | null;
};

export type Signal = {
  id: string;
  week_of: string;
  county: string;
  state: string;
  lat: number;
  lng: number;
  type: SignalType;
  severity: Severity;
  headline: string;
  detail: string;
  source: string;
  status: "new" | "processed";
  rep_id: number | null;
  drought_level: number | null;
  created_at: string;
};

export type Opportunity = {
  id: string;
  signal_id: string;
  account_id: string;
  rep_id: number | null;
  score: number;
  lead_with: string;
  why_now: string;
  email_subject: string;
  email_body: string;
  amount: number;
  stage: Stage;
  ai_offline: boolean;
  sf_opportunity_id: string | null;
  sf_error: string | null;
  created_at: string;
  pushed_at: string | null;
  sent_at: string | null;
};

export type PriceList = Record<Module, number> & { setup: number };

export type WeeklyHistory = Record<
  string,
  { pipeline: number[]; capture: number[]; hours: number[] }
>;

export type Settings = { price_list: PriceList; weekly_history: WeeklyHistory };

// Stages that count as "acted on" / "captured".
export const ACTED_STAGES: Stage[] = ["pushed", "sent", "won"];
