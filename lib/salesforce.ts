// Salesforce push via the OAuth 2.0 client-credentials flow. Every setting is
// optional: with none set, or on any failure, the caller queues the push.

const API_VERSION = "v61.0";
const TIMEOUT_MS = 8_000;

export type PushInput = {
  accountName: string;
  opportunityName: string;
  amount: number;
  description: string;
};

export type PushResult =
  | { ok: true; opportunityId: string; url: string }
  | { ok: false; error: string };

function config() {
  const loginUrl = process.env.SF_LOGIN_URL?.replace(/\/+$/, "");
  const clientId = process.env.SF_CLIENT_ID;
  const clientSecret = process.env.SF_CLIENT_SECRET;
  return loginUrl && clientId && clientSecret ? { loginUrl, clientId, clientSecret } : null;
}

export function salesforceConfigured(): boolean {
  return config() !== null;
}

// Link to a record, from the org's My Domain (the login URL).
export function recordUrl(id: string): string | null {
  const c = config();
  return c ? `${c.loginUrl}/lightning/r/Opportunity/${id}/view` : null;
}

function isoDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
}

function soqlString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function pushToSalesforce(input: PushInput): Promise<PushResult> {
  const c = config();
  if (!c) return { ok: false, error: "Salesforce is not configured." };
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  try {
    const tokenRes = await fetch(`${c.loginUrl}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: c.clientId, client_secret: c.clientSecret }),
      signal,
    });
    if (!tokenRes.ok) return { ok: false, error: `Salesforce sign-in failed (${tokenRes.status}).` };
    const { access_token, instance_url } = (await tokenRes.json()) as { access_token: string; instance_url: string };
    const base = `${instance_url}/services/data/${API_VERSION}`;
    const headers = { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" };

    const sf = async (path: string, init?: RequestInit) => {
      const res = await fetch(`${base}${path}`, { ...init, headers, signal });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = Array.isArray(json) && json[0]?.message ? json[0].message : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      return json;
    };

    // Find or create the Account by name.
    const found = await sf(`/query?q=${encodeURIComponent(`SELECT Id FROM Account WHERE Name = '${soqlString(input.accountName)}' LIMIT 1`)}`);
    const accountId: string =
      found?.records?.[0]?.Id ??
      (await sf("/sobjects/Account", { method: "POST", body: JSON.stringify({ Name: input.accountName }) })).id;

    const opp = await sf("/sobjects/Opportunity", {
      method: "POST",
      body: JSON.stringify({
        Name: input.opportunityName.slice(0, 120),
        AccountId: accountId,
        Amount: input.amount,
        CloseDate: isoDate(45),
        StageName: "Prospecting",
        Description: input.description.slice(0, 32000),
      }),
    });

    await sf("/sobjects/Task", {
      method: "POST",
      body: JSON.stringify({ Subject: "Send Signal Desk email", ActivityDate: isoDate(1), WhatId: opp.id }),
    });

    return { ok: true, opportunityId: opp.id, url: `${instance_url}/lightning/r/Opportunity/${opp.id}/view` };
  } catch (e) {
    const timeout = e instanceof Error && e.name === "TimeoutError";
    return { ok: false, error: timeout ? "Salesforce did not answer within 8 seconds." : `Salesforce error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ---------------------------------------------------------------- demo mode (VS-6)

export const DEMO_PREFIX = "DEMO-";

// With no org connected, a push "succeeds" in demo mode: a Salesforce-style
// 15-character Opportunity id (key prefix 006), marked DEMO- so it can never be
// mistaken for a real record. The mock record lives at /crm/<opportunity id>.
export function demoOpportunityId(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let id = "006";
  for (let i = 0; i < 12; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return DEMO_PREFIX + id;
}

export function isDemoId(id: string | null | undefined): boolean {
  return !!id && id.startsWith(DEMO_PREFIX);
}
