import React, {useCallback} from "react";

/**
 * Board-wide UI services that every layout region may call — without
 * threading a dozen callbacks through every slice.
 *
 * The context is deliberately small: it carries *presentation* events only
 * (say something to the player, open the printed reference at an anchor).  No
 * game state crosses it, so a region rendered outside the board (a
 * static-markup test, an isolated component test) still gets a working board
 * through the no-op fallback below, exactly like `seatUiContext`.
 */
export interface UiServices {
  /** Show a transient, polite status message (the toast). */
  notify: (message: {title: string; body?: string; tone?: "info" | "warn" | "error"}) => void;
  /** Open the reference drawer at a printed chart/rule anchor. */
  openReference: (anchor: string) => void;
}

export const UiContext = React.createContext<UiServices>({
  notify: () => undefined,
  openReference: () => undefined,
});

/** The services for this subtree; never undefined, even without a provider. */
export const useUi = (): UiServices => React.useContext(UiContext) ?? {
  notify: () => undefined,
  openReference: () => undefined,
};

/**
 * Build the provider value.  `notify` and `openReference` are expected to be
 * stable (useCallback in the shell); this helper keeps the memo honest.
 */
export const useUiServices = (
  notify: UiServices["notify"],
  openReference: UiServices["openReference"],
): UiServices => React.useMemo(() => ({notify, openReference}), [notify, openReference]);

/** Convenience for a component that needs a stable no-op set. */
export const useNoopUi = (): UiServices => {
  const notify = useCallback<UiServices["notify"]>(() => undefined, []);
  const openReference = useCallback<UiServices["openReference"]>(() => undefined, []);
  return useUiServices(notify, openReference);
};
