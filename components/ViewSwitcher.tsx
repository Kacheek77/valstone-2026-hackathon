"use client";

type Option = { value: string; label: string };

// A <select> styled as a pill. Changing it goes through /view, which sets the
// sd_view cookie and lands on /team or the chosen rep's dashboard.
export function ViewSwitcher({ options, selected }: { options: Option[]; selected: string }) {
  return (
    <label className="relative">
      <span className="sr-only">Switch view</span>
      <select
        value={selected}
        onChange={(e) => {
          // Full navigation on purpose: /view is a route handler that sets a
          // cookie and redirects, not a page the client router can render.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign(`/view?as=${encodeURIComponent(e.target.value)}`);
        }}
        className="cursor-pointer appearance-none rounded-full bg-white/15 py-1.5 pl-4 pr-9 text-sm font-medium text-white outline-none transition-colors duration-150 hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-[#f55a00]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="text-[#0f1419]">
            {o.label}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-white">
        ▾
      </span>
    </label>
  );
}
