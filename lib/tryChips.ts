// VS-13 TRY: the Valstone companies a visitor can try Signal Desk on, grouped
// by vertical, each with what it sells and the events that make its customers
// buy. Client-safe (no server imports).

export type TryChip = { id: string; name: string; vertical: string; sells: string; triggers: string };

export const TRY_CHIPS: TryChip[] = [
  { id: "datastor", name: "DATA STOR / DSL Systems", vertical: "Agriculture", sells: "feed and chemical plant batching software", triggers: "new or expanding feed and ethanol plant permits; corn price swings" },
  { id: "pigknows", name: "PigKnows", vertical: "Agriculture", sells: "swine production management software", triggers: "a PRRS or disease outbreak reported in a producer's region; a hog price drop" },
  { id: "verticalsoftware", name: "Vertical Software", vertical: "Agriculture", sells: "grain elevator ERP and scale software", triggers: "USDA Crop Progress shows harvest ahead of pace; storage gets tight and basis moves" },
  { id: "redwing", name: "Red Wing Software", vertical: "Agriculture", sells: "farm accounting and payroll software", triggers: "a drought disaster designation; crop insurance claims season; year-end tax changes" },
  { id: "matrix", name: "Matrix Controls", vertical: "Food & Beverage", sells: "processing yield, recipe and traceability software", triggers: "an FDA or USDA-FSIS recall in the same category or region; traceability rule deadlines" },
  { id: "prophet", name: "Prophet", vertical: "Food & Beverage", sells: "fresh-produce ERP", triggers: "a produce recall, or a weather-driven crop shortfall that forces re-sourcing" },
  { id: "aws-cis", name: "AWS and Creative Info Systems", vertical: "Construction & Materials", sells: "truck-scale ticketing for aggregates, mining, landfills and waste", triggers: "a new quarry or landfill permit; a state DOT letting that spikes aggregate tonnage" },
  { id: "aldata", name: "ALDATA", vertical: "Construction & Materials", sells: "timber fiber supply software", triggers: "storm or wildfire salvage; a mill opening or closing" },
  { id: "henning", name: "Henning Software", vertical: "Manufacturing", sells: "ERP for aerospace and automotive tier-2 manufacturers", triggers: "a DoD contract award to a prime they supply; CMMC cybersecurity compliance deadlines" },
  { id: "discus", name: "DISCUS", vertical: "Manufacturing", sells: "first-article inspection and ballooning software", triggers: "new part numbers from an OEM rate increase or program award" },
  { id: "shopdata", name: "ShopData", vertical: "Manufacturing", sells: "CAD/CAM nesting software for steel fabrication", triggers: "steel price or tariff moves; a construction start in the shop's area" },
  { id: "documoto", name: "Documoto and CADShare", vertical: "Manufacturing", sells: "OEM parts catalogs and 3D parts software", triggers: "a product recall or a new model launch that changes the parts list" },
  { id: "geometrix", name: "GeoMetrix, PST and Nascent", vertical: "Logistics", sells: "railcar tracking, crew management and terminal operations software", triggers: "a rail service disruption; a port congestion spike; a new federal crew or safety rule" },
  { id: "gtmaritime", name: "GT Maritime", vertical: "Logistics", sells: "ship-to-shore secure communications", triggers: "a new maritime cybersecurity rule; a reported vessel cyber incident" },
];

export const TRY_VERTICALS = [...new Set(TRY_CHIPS.map((c) => c.vertical))];

export const TRY_MAX_INPUT = 400;

export type TrySignal = { event: string; source: string; cadence: string };

export type TryOutput = {
  business: string; // one line: who the seller is and what they sell
  signals: TrySignal[]; // three
  example: {
    account: { name: string; location: string; profile: string };
    signal: string; // which event matched
    score: number;
    why_now: string;
    lead_with: string;
    email_subject: string;
    email_body: string;
  };
  needs: string; // "What Signal Desk would need: …"
};
