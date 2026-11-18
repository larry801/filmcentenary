/**
 * Small, dependency-light display preferences for the Imperial Elegy client.
 *
 * Every storage access is wrapped in try/catch: web storage can be absent
 * (Node/Jest, SSR), disabled (private browsing, cookie policy), or full, and a
 * broken preference must never stop a card from rendering.  Nothing here
 * touches `window` or `localStorage` at module scope, so importing this module
 * in a Node test or on the server is safe.
 */
import {useCallback, useState} from "react";

export type CardFaceMode = "svg" | "print";

export const CARD_FACE_KEY = "ie_card_face";

/** The subset of the Web Storage API the preference needs. */
export type PreferenceStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const DEFAULT_CARD_FACE: CardFaceMode = "svg";

/**
 * The browser's `localStorage` when it exists and can be read, otherwise null.
 * Merely reading the property can throw in locked-down browsing contexts, and
 * accessing an exposed-but-blocked storage throws on the first call, so the
 * lookup is probed rather than trusted.
 */
export const defaultPreferenceStorage = (): PreferenceStorage | null => {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    storage.getItem(CARD_FACE_KEY);
    return storage;
  } catch {
    return null;
  }
};

/** Read the stored card face, falling back to the data-driven SVG face. */
export const readCardFace = (
  storage: PreferenceStorage | null = defaultPreferenceStorage(),
): CardFaceMode => {
  try {
    if (!storage) return DEFAULT_CARD_FACE;
    const stored = storage.getItem(CARD_FACE_KEY);
    return stored === "print" ? "print" : DEFAULT_CARD_FACE;
  } catch {
    return DEFAULT_CARD_FACE;
  }
};

/** Persist the chosen card face; storage failures (quota, privacy) are ignored. */
export const writeCardFace = (
  mode: CardFaceMode,
  storage: PreferenceStorage | null = defaultPreferenceStorage(),
): void => {
  try {
    if (!storage) return;
    storage.setItem(CARD_FACE_KEY, mode);
  } catch {
    // The preference is cosmetic: a failed write must not break play.
  }
};

/** React state bound to the persisted face mode. */
export const useCardFaceMode = (): [CardFaceMode, (mode: CardFaceMode) => void] => {
  const [mode, setMode] = useState<CardFaceMode>(() => readCardFace(defaultPreferenceStorage()));
  const choose = useCallback((next: CardFaceMode) => {
    writeCardFace(next, defaultPreferenceStorage());
    setMode(next);
  }, []);
  return [mode, choose];
};

/**
 * Public URL for a card face image, or null when the card has no image.
 * Card images live under `public/imperial-elegy/`; the stored path is relative
 * to that directory and may or may not carry a leading slash.
 */
export const cardImageSrc = (image: string | undefined | null): string | null => {
  if (!image) return null;
  return `/imperial-elegy/${image.replace(/^\/+/, "")}`;
};

// ---------------------------------------------------------------------------
// Confirmations (phase 4): two-step "arm, then confirm" for irreversible actions
// ---------------------------------------------------------------------------

export const CONFIRM_ACTIONS_KEY = "ie_confirm_actions";

/**
 * Whether a destructive or irreversible control arms before it fires.
 *
 * On by default: there is no engine undo (the state hides other players'
 * hands, rolls dice and runs with `disableUndo`), so a mis-click cannot be
 * taken back.  A player who plays fast can switch it off; every legacy e2e
 * helper does exactly that.
 */
export const DEFAULT_CONFIRM_ACTIONS = true;

export const readConfirmActions = (
  storage: PreferenceStorage | null = defaultPreferenceStorage(),
): boolean => {
  try {
    if (!storage) return DEFAULT_CONFIRM_ACTIONS;
    const stored = storage.getItem(CONFIRM_ACTIONS_KEY);
    return stored === "off" ? false : DEFAULT_CONFIRM_ACTIONS;
  } catch {
    return DEFAULT_CONFIRM_ACTIONS;
  }
};

export const writeConfirmActions = (
  enabled: boolean,
  storage: PreferenceStorage | null = defaultPreferenceStorage(),
): void => {
  try {
    storage?.setItem(CONFIRM_ACTIONS_KEY, enabled ? "on" : "off");
  } catch {
    // Cosmetic: a failed write must never stop play.
  }
};

/** React state bound to the persisted confirmation preference. */
export const useConfirmActions = (): [boolean, (enabled: boolean) => void] => {
  const [enabled, setEnabled] = useState<boolean>(() => readConfirmActions(defaultPreferenceStorage()));
  const choose = useCallback((next: boolean) => {
    writeConfirmActions(next, defaultPreferenceStorage());
    setEnabled(next);
  }, []);
  return [enabled, choose];
};

// ---------------------------------------------------------------------------
// The Orders panel's refused actions
// ---------------------------------------------------------------------------

export const SHOW_UNAVAILABLE_KEY = "ie_show_unavailable";

/**
 * Whether the Orders panel's "unavailable" fold starts open.
 *
 * Closed by default: a typical space refuses ten of its twelve rows, and the
 * reason lines are reference material, not the next click.  The rows are never
 * removed — only folded — so the printed restriction stays one tap away.
 */
export const DEFAULT_SHOW_UNAVAILABLE = false;

export const readShowUnavailable = (
  storage: PreferenceStorage | null = defaultPreferenceStorage(),
): boolean => {
  try {
    if (!storage) return DEFAULT_SHOW_UNAVAILABLE;
    const stored = storage.getItem(SHOW_UNAVAILABLE_KEY);
    return stored === "open";
  } catch {
    return DEFAULT_SHOW_UNAVAILABLE;
  }
};

export const writeShowUnavailable = (
  open: boolean,
  storage: PreferenceStorage | null = defaultPreferenceStorage(),
): void => {
  try {
    storage?.setItem(SHOW_UNAVAILABLE_KEY, open ? "open" : "closed");
  } catch {
    // Cosmetic: a failed write must never stop play.
  }
};
