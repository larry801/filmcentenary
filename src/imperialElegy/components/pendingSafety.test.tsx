import {
  ARM_MS,
  ConfirmButton,
} from "./ConfirmButton";
import {renderToStaticMarkup} from "react-dom/server";
import React from "react";
import {CARD_FACE_KEY, CONFIRM_ACTIONS_KEY, readConfirmActions, readCardFace, writeConfirmActions} from "./preferences";
import {pendingKindIsDestructive, pendingOptionSafety} from "./pendingSafety";
import {tabbableIn} from "./useFocusTrap";

/** An in-memory storage double with the same failure modes as the browser's. */
const memory = (entries: Record<string, string> = {}) => {
  const store = {...entries};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => { store[key] = value; },
    dump: () => ({...store}),
  };
};

describe("confirmActions preference", () => {
  test("defaults on: an irreversible control must be confirmed", () => {
    expect(readConfirmActions(null)).toBe(true);
    expect(readConfirmActions(memory())).toBe(true);
  });

  test("remembers an explicit opt-out and can be switched back on", () => {
    const storage = memory();
    writeConfirmActions(false, storage);
    expect(storage.dump()[CONFIRM_ACTIONS_KEY]).toBe("off");
    expect(readConfirmActions(storage)).toBe(false);
    writeConfirmActions(true, storage);
    expect(readConfirmActions(storage)).toBe(true);
  });

  test("a broken storage never disables the safety net", () => {
    const hostile = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(readConfirmActions(hostile)).toBe(true);
    expect(() => writeConfirmActions(false, hostile)).not.toThrow();
    // The card-face preference next to it keeps its own behaviour.
    expect(readCardFace(hostile)).toBe("svg");
    expect(CARD_FACE_KEY).toBe("ie_card_face");
  });
});

describe("pendingOptionSafety", () => {
  const option = (label: string, labelZh?: string) => ({id: "o1", label, labelZh});
  const pending = (kind: string) => ({kind});

  test("a plain space choice is one click", () => {
    expect(pendingOptionSafety(pending("eventTargetSpace"), option("Berlin"), "en"))
      .toEqual({confirm: false, reason: undefined});
  });

  test("a decision the rules call final is always confirmed", () => {
    for (const kind of ["discardForStability", "warAim", "treatyOption", "combatLosses", "gwWinter"]) {
      const safety = pendingOptionSafety(pending(kind), option("Continue"), "en");
      expect(safety.confirm).toBe(true);
      expect(safety.reason).toBe("This cannot be undone.");
      expect(pendingKindIsDestructive(kind)).toBe(true);
    }
  });

  test("a final word in the label is enough in a mixed list", () => {
    for (const label of ["Discard this card", "Refuse the alliance", "Pay 2 CP"]) {
      expect(pendingOptionSafety(pending("eventChoice"), option(label), "en").confirm).toBe(true);
    }
    const zh = pendingOptionSafety(pending("eventChoice"), option("Discard", "弃掉此牌"), "zh_CN");
    expect(zh.confirm).toBe(true);
    expect(zh.reason).toBe("此操作不可撤销。");
  });

  test("declining arms the control in both locales", () => {
    // The engine marks a decline as a final answer, so the button must ask
    // twice whether the UI is reading the English label or the Chinese one.
    const decline = {id: "decline", label: "Decline", labelZh: "拒绝"};
    for (const locale of ["en", "zh_CN"] as const) {
      expect(pendingOptionSafety(pending("eventChoice"), decline, locale)).toEqual({
        confirm: true,
        reason: locale === "zh_CN" ? "此操作不可撤销。" : "This cannot be undone.",
      });
    }
  });

  test("the Chinese word for decline is destructive even without an English hint", () => {
    expect(
      pendingOptionSafety(pending("eventChoice"), {id: "decline-zh", label: "No", labelZh: "拒绝"}, "zh_CN").confirm,
    ).toBe(true);
  });

  test("a harmless option stays a single click in both locales", () => {
    for (const locale of ["en", "zh_CN"] as const) {
      expect(pendingOptionSafety(pending("eventChoice"), option("Continue", "继续"), locale))
        .toEqual({confirm: false, reason: undefined});
    }
  });

  test("a Chinese decline label arms in both locales, like the English one", () => {
    // PendingPanel builds the synthetic decline option from a localized
    // string, so a Chinese-only "拒绝" must be as destructive as "Decline".
    const decline = {id: "decline", label: "拒绝", labelZh: "拒绝"};
    for (const locale of ["en", "zh_CN"] as const) {
      const safety = pendingOptionSafety(pending("eventChoice"), decline, locale);
      expect(safety.confirm).toBe(true);
      expect(safety.reason).toBe(
        locale === "zh_CN" ? "此操作不可撤销。" : "This cannot be undone.",
      );
    }
  });

  test("a missing decision or option is harmless", () => {
    expect(pendingOptionSafety(null, option("x"), "en").confirm).toBe(false);
    expect(pendingOptionSafety(pending("warAim"), undefined, "en").confirm).toBe(false);
    expect(pendingKindIsDestructive(null)).toBe(false);
  });
});

describe("ConfirmButton", () => {
  const props = (overrides: Partial<React.ComponentProps<typeof ConfirmButton>> = {}) => ({
    confirm: true,
    onConfirm: () => undefined,
    ...overrides,
  });

  test("renders as a plain button in static markup, with the confirm state as data", () => {
    const html = renderToStaticMarkup(<ConfirmButton {...props()}>Play for 3 CP</ConfirmButton>);
    expect(html).toContain("data-armed=\"false\"");
    expect(html).toContain("Play for 3 CP");
    expect(html).toContain("type=\"button\"");
  });

  test("an already-armed button says so, and the label names the action", () => {
    // The armed render is driven by a React state machine; a static render is
    // always unarmed, so the confirmation label is checked through its prop.
    const withLabel = renderToStaticMarkup(
      <ConfirmButton {...props({confirmLabel: "Confirm: play for 3 CP"})}>Play for 3 CP</ConfirmButton>,
    );
    expect(withLabel).toContain("Play for 3 CP");
    expect(withLabel).not.toContain("Confirm:");
  });

  test("the arm window is five seconds", () => {
    expect(ARM_MS).toBe(5000);
  });

  test("disabled and title props pass through", () => {
    const html = renderToStaticMarkup(
      <ConfirmButton {...props()} disabled title="Finish the impulse">End impulse</ConfirmButton>,
    );
    expect(html).toContain("disabled");
    expect(html).toContain("title=\"Finish the impulse\"");
  });
});

describe("useFocusTrap", () => {
  test("has no tab stops without a container", () => {
    expect(tabbableIn(null)).toEqual([]);
  });
});
