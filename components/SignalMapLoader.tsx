"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type SignalMapType from "./SignalMap";
import { prefetchMapGeo } from "@/lib/mapGeo";

// Start the map's GeoJSON downloads as soon as this (small) module runs, in
// parallel with the MapLibre bundle instead of after it.
if (typeof window !== "undefined") prefetchMapGeo();

// MapLibre needs the browser, so the map loads client-side only; SSR and the
// build never touch it.
const SignalMap = dynamic(() => import("./SignalMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] items-center justify-center rounded-xl bg-[#dfe6ec] text-sm text-[#5a6975]">Loading map…</div>
  ),
});

export function SignalMapLoader(props: ComponentProps<typeof SignalMapType>) {
  return <SignalMap {...props} />;
}
