/**
 * Card-face preference storage.  Runs in the node test environment, which is
 * exactly the situation the module has to survive: no `window`, no
 * `localStorage`, and a storage mock that can throw at any time.
 */
import {
  CARD_FACE_KEY,
  cardImageSrc,
  defaultPreferenceStorage,
  readCardFace,
  writeCardFace,
} from "./preferences";
import type {PreferenceStorage} from "./preferences";

const storageWith = (value: string | null): PreferenceStorage => ({
  getItem: (key: string) => (key === CARD_FACE_KEY ? value : null),
  setItem: () => undefined,
});

const throwingStorage = (): PreferenceStorage => ({
  getItem: () => {
    throw new Error("storage blocked");
  },
  setItem: () => {
    throw new Error("quota exceeded");
  },
});

afterEach(() => {
  delete (globalThis as {localStorage?: PreferenceStorage}).localStorage;
});

describe("readCardFace", () => {
  test("defaults to svg when there is no storage at all", () => {
    expect(readCardFace(null)).toBe("svg");
    expect(readCardFace()).toBe("svg");
  });

  test("defaults to svg when the key is missing", () => {
    expect(readCardFace(storageWith(null))).toBe("svg");
  });

  test("defaults to svg for an unrecognised stored value", () => {
    expect(readCardFace(storageWith("poster"))).toBe("svg");
    expect(readCardFace(storageWith(""))).toBe("svg");
  });

  test("defaults to svg when reading throws", () => {
    expect(readCardFace(throwingStorage())).toBe("svg");
  });

  test("round-trips the print preference", () => {
    let saved: string | null = null;
    const storage: PreferenceStorage = {
      getItem: (key: string) => (key === CARD_FACE_KEY ? saved : null),
      setItem: (key: string, value: string) => {
        expect(key).toBe(CARD_FACE_KEY);
        saved = value;
      },
    };

    expect(readCardFace(storage)).toBe("svg");
    writeCardFace("print", storage);
    expect(saved).toBe("print");
    expect(readCardFace(storage)).toBe("print");
    writeCardFace("svg", storage);
    expect(readCardFace(storage)).toBe("svg");
  });
});

describe("writeCardFace", () => {
  test("silently ignores missing storage", () => {
    expect(() => writeCardFace("print", null)).not.toThrow();
  });

  test("silently ignores storage errors", () => {
    expect(() => writeCardFace("print", throwingStorage())).not.toThrow();
  });
});

describe("defaultPreferenceStorage", () => {
  test("returns the usable global storage when present", () => {
    const storage = storageWith("print");
    (globalThis as {localStorage?: PreferenceStorage}).localStorage = storage;
    expect(defaultPreferenceStorage()).toBe(storage);
  });

  test("returns null when the global storage throws", () => {
    (globalThis as {localStorage?: PreferenceStorage}).localStorage = throwingStorage();
    expect(defaultPreferenceStorage()).toBeNull();
  });
});

describe("cardImageSrc", () => {
  test("prefixes the public imperial-elegy path", () => {
    expect(cardImageSrc("cards/action-001.jpg")).toBe("/imperial-elegy/cards/action-001.jpg");
    expect(cardImageSrc("/cards/action-001.jpg")).toBe("/imperial-elegy/cards/action-001.jpg");
  });

  test("returns null for an empty or missing image", () => {
    expect(cardImageSrc(undefined)).toBeNull();
    expect(cardImageSrc(null)).toBeNull();
    expect(cardImageSrc("")).toBeNull();
  });
});
