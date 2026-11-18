import {
  initialInteraction,
  interactionPrompt,
  interactionReducer,
  Interaction,
  intentsAt,
  isTargeting,
  selectedUnitIds,
  submitNow,
  TargetIntent,
} from "./useInteraction";

const INTENTS: TargetIntent[] = [
  "redeploy",
  "landBattle",
  "navalBattle",
  "amphibious",
  "navalTransport",
  "navalIntercept",
  "gwMarch",
  "gwRail",
];

const PROMPTS: Record<TargetIntent, {en: string; zh_CN: string}> = {
  redeploy: {en: "Redeploy", zh_CN: "重新部署"},
  landBattle: {en: "Land battle: choose an adjacent target", zh_CN: "陆战：选择相邻目标"},
  navalBattle: {en: "Naval battle", zh_CN: "海战"},
  amphibious: {en: "Amphibious assault", zh_CN: "两栖突击"},
  navalTransport: {en: "Naval transport", zh_CN: "海上运输"},
  navalIntercept: {en: "Naval interception", zh_CN: "海上拦截"},
  gwMarch: {en: "Great War march", zh_CN: "大战行军"},
  gwRail: {en: "Great War rail", zh_CN: "大战铁路"},
};

const begin = (
  intent: TargetIntent,
  from = "berlin",
  targets: string[] = ["vienna", "paris"],
  sources = ["u1"],
): Interaction =>
  interactionReducer(initialInteraction, {
    type: "beginTargeting",
    intent,
    from,
    sources,
    targets,
  });

describe.each(INTENTS)("%s targeting", (intent) => {
  test("begins with the intent, source and targets, and commits to a plain space", () => {
    const targeting = begin(intent);

    expect(targeting).toEqual({
      kind: "targeting",
      intent,
      from: "berlin",
      sources: ["u1"],
      targets: ["vienna", "paris"],
    });
    expect(isTargeting(targeting)).toBe(true);

    if (!isTargeting(targeting)) throw new Error("expected targeting state");
    expect(targeting.intent).toBe(intent);
    expect(targeting.from).toBe("berlin");
    expect(targeting.targets).toEqual(["vienna", "paris"]);

    const after = interactionReducer(targeting, {type: "commit", space: "paris"});
    expect(after).toEqual({kind: "space", space: "paris"});
    expect(isTargeting(after)).toBe(false);
  });
});

describe("interaction state machine", () => {
  test("a selectSpace click while targeting is a no-op", () => {
    const before = begin("landBattle");
    const after = interactionReducer(before, {type: "selectSpace", space: "london"});

    expect(after).toEqual(before);
    expect(isTargeting(after)).toBe(true);
  });

  test("cancel from targeting returns to the source space", () => {
    const targeting = begin("navalBattle", "london");
    expect(interactionReducer(targeting, {type: "cancel"})).toEqual({
      kind: "space",
      space: "london",
    });
  });

  test("cancel from unit or space returns to idle", () => {
    expect(
      interactionReducer({kind: "unit", space: "berlin", unit: "u1"}, {type: "cancel"}),
    ).toEqual({kind: "idle"});
    expect(interactionReducer({kind: "space", space: "berlin"}, {type: "cancel"})).toEqual({
      kind: "idle",
    });
  });

  test("reset clears targeting", () => {
    expect(interactionReducer(begin("gwRail"), {type: "reset"})).toEqual({kind: "idle"});
  });

  test("unit selection keeps both space and unit", () => {
    const selected = interactionReducer(initialInteraction, {
      type: "selectUnit",
      space: "berlin",
      unit: "u1",
    });
    expect(selected).toEqual({kind: "unit", space: "berlin", unit: "u1"});

    const reselected = interactionReducer(selected, {
      type: "selectUnit",
      space: "berlin",
      unit: "u1",
    });
    expect(reselected).toEqual({kind: "unit", space: "berlin", unit: "u1"});
  });

  test("selecting a space clears any selected unit", () => {
    const selected = interactionReducer(
      {kind: "unit", space: "berlin", unit: "u1"},
      {type: "selectSpace", space: "vienna"},
    );
    expect(selected).toEqual({kind: "space", space: "vienna"});
  });

  /**
   * 12.15 / 16.1: a whole stack moves as one action, so the selection can hold
   * several units of the same space.  `toggleUnit` is the click that adds or
   * removes one; `selectedUnitIds` is the single reader every other module uses.
   */
  test("toggleUnit builds a selection of several units in one space", () => {
    let state = interactionReducer({kind: "space", space: "berlin"}, {type: "toggleUnit", space: "berlin", unit: "u1"});
    expect(selectedUnitIds(state)).toEqual(["u1"]);
    state = interactionReducer(state, {type: "toggleUnit", space: "berlin", unit: "u2"});
    expect(state).toMatchObject({kind: "unit", space: "berlin", unit: "u1", extra: ["u2"]});
    expect(selectedUnitIds(state)).toEqual(["u1", "u2"]);
    // Toggling a member off keeps the rest.
    state = interactionReducer(state, {type: "toggleUnit", space: "berlin", unit: "u1"});
    expect(selectedUnitIds(state)).toEqual(["u2"]);
    expect((state as {extra?: string[]}).extra).toBeUndefined();
    // Toggling the last one off drops back to a plain space selection.
    state = interactionReducer(state, {type: "toggleUnit", space: "berlin", unit: "u2"});
    expect(state).toEqual({kind: "space", space: "berlin"});
  });

  test("toggleUnit in another space starts a fresh selection there", () => {
    const selected = interactionReducer(
      {kind: "unit", space: "berlin", unit: "u1", extra: ["u2"]},
      {type: "toggleUnit", space: "vienna", unit: "u9"},
    );
    expect(selected).toEqual({kind: "unit", space: "vienna", unit: "u9"});
    expect(selectedUnitIds(selected)).toEqual(["u9"]);
  });

  test("a single-unit selection exposes no `extra`", () => {
    const state = interactionReducer(initialInteraction, {type: "selectUnit", space: "berlin", unit: "u1"});
    expect((state as {extra?: string[]}).extra).toBeUndefined();
    expect(selectedUnitIds(state)).toEqual(["u1"]);
    expect(selectedUnitIds(initialInteraction)).toEqual([]);
  });

  /**
   * "Select all" must be one dispatch.  Looping `toggleUnit` cannot build a
   * group: React batches the dispatches and every reducer call still reads the
   * pre-batch state, so the first unit was dropped and the whole feature
   * silently did nothing (found in the browser, not in a unit test).
   */
  test("selectUnit with `extra` builds the whole group in one action", () => {
    const state = interactionReducer(initialInteraction, {
      type: "selectUnit", space: "berlin", unit: "u1", extra: ["u2", "u3"],
    });
    expect(state).toMatchObject({kind: "unit", space: "berlin", unit: "u1", extra: ["u2", "u3"]});
    expect(selectedUnitIds(state)).toEqual(["u1", "u2", "u3"]);
  });

  test("an empty `extra` is not stored", () => {
    const state = interactionReducer(initialInteraction, {
      type: "selectUnit", space: "berlin", unit: "u1", extra: [],
    });
    expect((state as {extra?: string[]}).extra).toBeUndefined();
  });

  /**
   * The selection must survive its own targeting mode.  The soft mode enters
   * targeting the instant a unit is selected, so a reader that only accepted
   * `kind: "unit"` dropped the selection one render later — the rings appeared
   * while `aria-pressed` cleared and the Orders row for the unit vanished.
   */
  test("selectedUnitIds reads the selection while targeting", () => {
    const targeting = interactionReducer({kind: "unit", space: "berlin", unit: "u1", extra: ["u2"]}, {
      type: "beginTargeting",
      intent: "redeploy",
      from: "berlin",
      sources: ["u1", "u2"],
      targets: ["silesia"],
      soft: true,
    });
    expect(selectedUnitIds(targeting)).toEqual(["u1", "u2"]);
  });

  test("toggleUnit works from a targeting state in the same space", () => {
    const targeting: Interaction = {
      kind: "targeting", intent: "redeploy", from: "berlin",
      sources: ["u1"], targets: ["silesia"], soft: true,
    };
    const added = interactionReducer(targeting, {type: "toggleUnit", space: "berlin", unit: "u2"});
    expect(selectedUnitIds(added)).toEqual(["u1", "u2"]);
  });

  test("commit outside targeting is a no-op", () => {
    for (const state of [
      initialInteraction,
      {kind: "space", space: "berlin"} as Interaction,
      {kind: "unit", space: "berlin", unit: "u1"} as Interaction,
    ]) {
      expect(interactionReducer(state, {type: "commit", space: "paris"})).toEqual(state);
    }
  });

  test("beginTargeting defaults sources to [] and copies the target list", () => {
    const targets = ["vienna"];
    const started = interactionReducer(initialInteraction, {
      type: "beginTargeting",
      intent: "redeploy",
      from: "berlin",
      targets,
    });

    if (!isTargeting(started)) throw new Error("expected targeting state");
    expect(started.sources).toEqual([]);
    expect(started.targets).toEqual(["vienna"]);

    targets.push("paris");
    expect(started.targets).toEqual(["vienna"]);
  });

  test("prompts are localised for every intent", () => {
    for (const intent of INTENTS) {
      expect(interactionPrompt(intent, "en")).toBe(PROMPTS[intent].en);
      expect(interactionPrompt(intent, "zh_CN")).toBe(PROMPTS[intent].zh_CN);
    }
  });
});

describe("soft targeting and the intent chooser", () => {
  const soft = (): Interaction => interactionReducer(initialInteraction, {
    type: "beginTargeting",
    intent: "gwMarch",
    from: "berlin",
    sources: ["u1"],
    targets: ["saxony", "silesia"],
    soft: true,
    // Two intents at one destination: a Great War land unit can march or rail.
    byTarget: {saxony: ["gwMarch"], silesia: ["gwMarch", "gwRail"]},
  });

  test("is marked soft and keeps its per-target intents", () => {
    const state = soft();
    if (!isTargeting(state)) throw new Error("expected targeting");
    expect(state.soft).toBe(true);
    expect(intentsAt(state, "saxony")).toEqual(["gwMarch"]);
    expect(intentsAt(state, "silesia")).toEqual(["gwMarch", "gwRail"]);
    expect(intentsAt(state, "paris")).toEqual(["gwMarch"]);
  });

  test("one intent submits on the click", () => {
    const state = soft();
    if (!isTargeting(state)) throw new Error("expected targeting");
    expect(submitNow(state, "saxony")).toBe("gwMarch");
    expect(submitNow(state, "paris")).toBeNull();
  });

  test("two intents ask first: the click opens the chooser and spends nothing", () => {
    const state = soft();
    if (!isTargeting(state)) throw new Error("expected targeting");
    expect(submitNow(state, "silesia")).toBeNull();
    const choosing = interactionReducer(state, {type: "choose", space: "silesia"});
    if (!isTargeting(choosing)) throw new Error("expected targeting");
    expect(choosing.choosing).toBe("silesia");
    // Still targeting: no commit, no CP.
    expect(choosing.kind).toBe("targeting");
    // The still-open chooser submits its chosen intent on the next click.
    expect(submitNow(choosing, "silesia")).toBe("gwMarch");
  });

  test("a chooser on a non-target is a no-op", () => {
    const state = soft();
    expect(interactionReducer(state, {type: "choose", space: "paris"})).toBe(state);
  });

  test("an armed targeting miss is ignored, a soft miss cancels", () => {
    const armed = begin("landBattle", "berlin", ["vienna"]);
    // The reducer cannot know about misses (the board decides), but it must
    // keep the mode intact so the board can ignore the click.
    if (!isTargeting(armed)) throw new Error("expected targeting");
    expect(armed.soft).toBeUndefined();
    const state = soft();
    if (!isTargeting(state)) throw new Error("expected targeting");
    // The board implements the soft miss as cancel + select; the reducer's
    // cancel returns to the source so the next click selects normally.
    const cancelled = interactionReducer(state, {type: "cancel"});
    expect(cancelled).toEqual({kind: "space", space: "berlin"});
  });

  test("commit leaves targeting for the clicked space", () => {
    const state = soft();
    const committed = interactionReducer(state, {type: "commit", space: "saxony"});
    expect(committed).toEqual({kind: "space", space: "saxony"});
  });
});
