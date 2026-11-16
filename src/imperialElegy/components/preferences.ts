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
