import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

/**
 * Calls `onShouldReload` when the app comes back to the foreground after
 * being backgrounded for more than `staleAfterMs`. This guarantees the
 * admin sees fresh bookings/jobs after switching apps for a while
 * (instead of staring at a stale dashboard).
 */
export function useBackgroundReload(
  onShouldReload: () => void,
  staleAfterMs: number = 10 * 60 * 1000,
): void {
  const lastBackgroundedAt = useRef<number | null>(null);
  const stateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = stateRef.current;
      stateRef.current = next;

      if (
        (prev === "active") &&
        (next === "background" || next === "inactive")
      ) {
        lastBackgroundedAt.current = Date.now();
        return;
      }

      if (next === "active" && lastBackgroundedAt.current != null) {
        const elapsed = Date.now() - lastBackgroundedAt.current;
        lastBackgroundedAt.current = null;
        if (elapsed >= staleAfterMs) {
          onShouldReload();
        }
      }
    });
    return () => sub.remove();
  }, [onShouldReload, staleAfterMs]);
}
