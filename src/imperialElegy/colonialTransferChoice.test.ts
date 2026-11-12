/**
 * 29.2 The Colonial War — the winning alliance's live transfer choice.
 *
 * The winner may take one unoccupied space on the contested submap (two on a
 * differential of 4+) with a LoC to it.  The live winter opens a private
 * `gwColonialTransfer` decision for the alliance's deterministic controller;
 * direct helper/bot calls keep the deterministic first-legal-space fallback.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {GreatWarState, ImperialElegyState, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {
  colonialTransferOptions,
  colonialTransferTaker,
  resolveGwWinter,
} from "./engine/greatWarFlow";
import {ImperialElegyGameDef} from "./game";
import {redactForView} from "./engine/privacy";
import {resolvePending} from "./moves";
import {logText} from "./components/logText";

const makeCtx = (dieValue = 3, phase = "action"): Ctx =>
  ({
    playerID: "0",
    random: {Die: (_sides: number) => dieValue},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase,
  }) as unknown as Ctx;

const seatCtx = (power: Power, dieValue = 3): Ctx => ({
  ...makeCtx(dieValue),
  playerID: String(POWERS.indexOf(power)),
}) as unknown as Ctx;

const baseGw = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = {
    active: true,
    turn: 2,
    order: ["FR", "GE"],
    belligerents: ["FR", "GE"],
    neutrals: [],
    te: ["FR"],
    ta: ["GE"],
    usIn: false,
    italyIn: false,
    usStability: 3,
    usManpower: 3,
    usBudget: 4,
    italyStability: 3,
    italyManpower: 3,
    italyBudget: 2,
    trenches: {},
    lastColonialWar: null,
    victor: null,
    outbreakDone: true,
    nationalWillDone: true,
    bonusImpulses: [],
    ...overrides,
  };
  for (const power of G.gw.te) G.powers[power].alliance = "teCommitted";
  for (const power of G.gw.ta) G.powers[power].alliance = "taCommitted";
  G.phase = "gwWinter";
  return G;
};

/** A TE win by +1: two French armies (+2) against one German army (+1). */
const oneSpaceWin = (): ImperialElegyState => {
  const G = baseGw();
  placeUnit(G, "FR", "army", "sudan", 2);
  placeUnit(G, "FR", "army", "nigeria", 2);
  placeUnit(G, "GE", "army", "east-africa", 2);
  return G;
};

describe("29.2 live transfer choice", () => {
  test("the winter stops for the winner's transfer decision; the chosen space is applied", () => {
    const G = oneSpaceWin();
    const res = resolveGwWinter(G, makeCtx(3), {promptChoices: true});
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.awaitingColonialChoices).toBe(true);
    expect(G.pending?.kind).toBe("gwColonialTransfer");
    expect(G.pending?.power).toBe("FR");
    expect(G.pending?.promptArgs).toMatchObject({region: "africa", side: "te", remaining: 1});
    const options = G.pending!.options.map((entry) => entry.id);
    expect(options).toContain("skip");
    // Every offered space is a legal LoC target that is not already TE's.
    for (const id of options.filter((entry) => entry !== "skip")) {
      expect(colonialTransferOptions(G, "africa", "te")).toContain(id);
      expect(colonialTransferTaker(G, "te", id as never)).not.toBeNull();
    }
    const chosen = options.find((entry) => entry !== "skip")!;
    expect(resolvePending(G, seatCtx("FR"), chosen)).toBeUndefined();

    expect(G.spaces[chosen].control).toBe("FR");
    expect(G.spaces[chosen].units).toEqual([]);
    expect(G.pending).toBeNull();
    // No neutrals: the winter closes and the next planning step begins.
    expect(G.gw!.winter).toBeNull();
    expect(G.gw!.turn).toBe(3);
    expect(G.phase).toBe("gwPlanning");
    expect(G.log.some((entry) => entry.key === "gwColonialTransfer" && entry.args?.space === chosen)).toBe(true);
  });

  test("a differential of 4+ offers two transfers, one decision per space", () => {
    const G = baseGw();
    for (const space of ["sudan", "nigeria", "cameroon", "somalia"] as const) {
      placeUnit(G, "FR", "army", space, 2);
    }
    const res = resolveGwWinter(G, makeCtx(3), {promptChoices: true});
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.awaitingColonialChoices).toBe(true);
    expect(G.pending?.promptArgs).toMatchObject({remaining: 2});

    const first = G.pending!.options.find((entry) => entry.id !== "skip")!.id;
    expect(resolvePending(G, seatCtx("FR"), first)).toBeUndefined();
    expect(G.pending?.kind).toBe("gwColonialTransfer");
    expect(G.pending?.promptArgs).toMatchObject({remaining: 1});
    const second = G.pending!.options.find((entry) => entry.id !== "skip" && entry.id !== first)!.id;
    expect(resolvePending(G, seatCtx("FR"), second)).toBeUndefined();

    expect(G.spaces[first].control).toBe("FR");
    expect(G.spaces[second].control).toBe("FR");
    expect(G.gw!.turn).toBe(3);
    const transferLogs = G.log.filter((entry) => entry.key === "gwColonialTransfer" && entry.args?.space);
    expect(transferLogs.map((entry) => entry.args?.space)).toEqual([first, second]);
  });

  test("skipping takes no space and is logged", () => {
    const G = oneSpaceWin();
    resolveGwWinter(G, makeCtx(3), {promptChoices: true});
    expect(G.pending?.kind).toBe("gwColonialTransfer");
    expect(resolvePending(G, seatCtx("FR"), "skip")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.gw!.turn).toBe(3);
    const skipEntry = G.log.find((entry) => entry.key === "gwColonialTransfer" && entry.args?.skip === true);
    expect(skipEntry).toBeTruthy();
    expect(logText(skipEntry!, "en")).toContain("found no unoccupied");
    // Nothing was taken: the unoccupied Africa spaces keep their old control.
    expect(G.spaces.morocco.control).toBe("Morocco");
  });

  test("a reject from the wrong seat or an illegal option leaves the decision open", () => {
    const G = oneSpaceWin();
    resolveGwWinter(G, makeCtx(3), {promptChoices: true});
    const chosen = G.pending!.options.find((entry) => entry.id !== "skip")!.id;
    expect(resolvePending(G, seatCtx("GE"), chosen)).toBe(INVALID_MOVE);
    expect(resolvePending(G, seatCtx("FR"), "not-a-space")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("gwColonialTransfer");
    expect(G.spaces[chosen].control).not.toBe("FR");
  });

  test("the pending options are private to the deciding seat", () => {
    const G = oneSpaceWin();
    resolveGwWinter(G, makeCtx(3), {promptChoices: true});
    const view = redactForView(G, "1");
    expect(view.pending?.options).toEqual([]);
    const own = redactForView(G, String(POWERS.indexOf("FR")));
    expect(own.pending?.options.length).toBeGreaterThan(0);
  });

  test("the live gwWinter phase hook opens the choice (ctx.phase drives the policy)", () => {
    const G = oneSpaceWin();
    type PhaseOnBegin = (G: ImperialElegyState, ctx: Ctx) => void;
    const phases = ImperialElegyGameDef.phases as unknown as Record<string, {onBegin: PhaseOnBegin}>;
    phases.gwWinter.onBegin(G, makeCtx(3, "gwWinter"));
    expect(G.pending?.kind).toBe("gwColonialTransfer");
    expect(G.phase).toBe("gwWinter");
    const chosen = G.pending!.options.find((entry) => entry.id !== "skip")!.id;
    expect(resolvePending(G, seatCtx("FR"), chosen)).toBeUndefined();
    expect(G.phase).toBe("gwPlanning");
  });

  test("after the transfer the winter continues to the neutral-entry decision", () => {
    const G = oneSpaceWin();
    G.gw!.neutrals = ["OT"];
    G.powers.OT.alliance = "neutral";
    const res = resolveGwWinter(G, makeCtx(3), {promptChoices: true});
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    const chosen = G.pending!.options.find((entry) => entry.id !== "skip")!.id;
    expect(resolvePending(G, seatCtx("FR"), chosen)).toBeUndefined();
    expect(G.pending?.kind).toBe("gwNeutralEntry");
    expect(G.pending?.power).toBe("OT");
    expect(resolvePending(G, seatCtx("OT"), "stay")).toBeUndefined();
    expect(resolvePending(G, seatCtx("OT"), "done")).toBeUndefined();
    expect(G.gw!.turn).toBe(3);
    expect(G.phase).toBe("gwPlanning");
  });

  test("the direct helper call keeps the deterministic fallback", () => {
    const G = oneSpaceWin();
    const res = resolveGwWinter(G, makeCtx(3));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.pending).toBeNull();
    expect(res.awaitingColonialChoices).not.toBe(true);
    expect(res.colonialTransfers).toHaveLength(1);
    expect(res.colonialTransfers![0]).toMatchObject({region: "africa", side: "te", by: "FR"});
    expect(G.spaces[res.colonialTransfers![0].space].control).toBe("FR");
  });

  test("no legal target skips the transfer with a log", () => {
    const G = oneSpaceWin();
    // Occupy every remaining Africa-submap space with a neutral minor unit so
    // no unoccupied target exists after the loss.
    for (const space of [
      "south-africa", "morocco", "nigeria", "cameroon", "west-congo", "central-congo",
      "east-africa", "somalia", "ethiopia", "sudan", "southwest-africa", "rhodesia", "madagascar",
    ]) {
      if (G.spaces[space].units.length === 0) placeUnit(G, "Belgium", "minorArmy", space, 1);
    }
    const res = resolveGwWinter(G, makeCtx(3), {promptChoices: true});
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.pending).toBeNull();
    expect(res.colonialTransfers).toEqual([]);
    expect(G.log.some((entry) => entry.key === "gwColonialTransfer" && entry.args?.skip === true)).toBe(true);
  });

  test("30.0 key-loss applies when the taken space is an enemy belligerent key", () => {
    const G = baseGw({te: ["FR"], ta: ["GE", "UK"], belligerents: ["FR", "GE", "UK"]});
    G.powers.UK.alliance = "taCommitted";
    // South Africa is a UK home key and the only printed UK stability key on
    // the Africa submap.  Give FR a supply source in Africa (a home-override
    // colonial key) so the LoC reaches it through the Indian Ocean.
    G.spaces.sudan.control = "FR";
    G.spaces.sudan.homeOverride = "FR";
    // The UK colonial EF starts in South Africa; clear it so the key can be taken.
    for (const id of [...G.spaces["south-africa"].units]) removeUnit(G, id);
    placeUnit(G, "FR", "army", "sudan", 2);
    placeUnit(G, "FR", "army", "cameroon", 2);
    placeUnit(G, "GE", "army", "east-africa", 2);
    expect(colonialTransferOptions(G, "africa", "te")).toContain("south-africa");

    const stabilityBefore = G.powers.UK.stability;
    resolveGwWinter(G, makeCtx(3), {promptChoices: true});
    expect(G.pending?.kind).toBe("gwColonialTransfer");
    expect(resolvePending(G, seatCtx("FR"), "south-africa")).toBeUndefined();

    expect(G.spaces["south-africa"].control).toBe("FR");
    expect(G.powers.UK.stability).toBe(stabilityBefore - 1);
    expect(G.log.some((entry) => entry.key === "gwKeyLost" && entry.args?.space === "south-africa")).toBe(true);
  });
});
