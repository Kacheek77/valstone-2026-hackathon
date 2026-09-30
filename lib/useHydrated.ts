import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False in the server HTML and during hydration, true once React has attached
// the click handlers. Action buttons stay disabled until then, so a click that
// lands before hydration is not silently dropped (VS-11 item 5).
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
