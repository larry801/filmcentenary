/**
 * Fixes from the printed-rule audit round 3 (2026-11-26):
 *
 * - A051 Polish Revolt: the armies are placed once, in two spaces the victim
 *   controls that the actor picks (the print names no nationality for them).
 * - A049 South German Confederation: an AU-controlled Bavaria still counts as
 *   an Austrian minor ally for the National Goals metrics.
 * - A110 Extreme Militarism: the -1 VP is provisional and the GW outbreak
 *   refunds every recorded play.
 * - A081 Conquest of Central Asia: the peacetime sweep eliminates an off-Asia
 *   reserve army and demobilization leaves one on-Asia army on the map.
 * - A105 Impulsive Ruler: the mandatory-response window opens when the WTT
 *   increases and the CP mode closes while that trigger stands.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {returnReserveArmies} from "./engine/limitedWar";
import {changeWtt} from "./engine/rules";
import {outbreakGreatWar} from "./engine/greatWar";
import {goalMetric} from "./engine/victory";
import {cpPlayability} from "./engine/playability";
import {playCard, playResponseCard, resolveEnd, resolvePending, responseCardEligibility, responseWindowFor} from "./moves";
import {GOALS} from "./constant/goals";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {
      Die: (sides: number) => Math.min(sides, dice[Math.min(index++, dice.length - 1)] ?? 3),
      Shuffle: (items: unknown[]) => items,
    },
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const rebelSteps = (G: ImperialElegyState, space: string): number =>
  (G.spaces[space].rebellion?.rebels ?? []).reduce(
    (total, id) => total + (G.units[id]?.steps ?? 0),
    0,
  );

// ---------------------------------------------------------------------------
// A051 Polish Revolt
// ---------------------------------------------------------------------------

describe("A051 Polish Revolt", () => {
  test("the actor places both armies in victim-controlled spaces and places them once", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.spaces.poland.control = "RU";
    G.powers.GE.hand = ["IE-A051"];
    const ctx = makeCtx([], seat("GE"));

    expect(playCard(G, ctx, "IE-A051", "event")).toBeUndefined();
    expect(G.pending?.kind).toBe("eventTargetPower");
    resolvePending(G, ctx, "RU");
    // Step 2: the actor picks the first space among every space the victim
    // controls — no Polish-nationality restriction.
    expect(G.pending?.kind).toBe("eventTargetSpace");
    const candidates = G.pending!.options.map((option: {id: string}) => option.id);
    expect(candidates).toContain("poland");
    expect(candidates).toContain("moscow");
    resolvePending(G, ctx, "poland");
    expect(G.pending?.kind).toBe("eventTargetSpace");
    resolvePending(G, ctx, "moscow");
    // Step 4: the victim's stability-or-discard choice opens after the armies;
    // the victim answers from its own seat.
    expect(G.pending?.kind).toBe("eventChoice");
    resolvePending(G, makeCtx([], seat("RU")), "stability");
    expect(G.pending).toBeNull();

    expect(G.spaces.poland.rebellion?.minor).toBe("Poland");
    expect(G.spaces.poland.rebellion?.step).toBe(0);
    expect(rebelSteps(G, "poland")).toBe(2);
    expect(rebelSteps(G, "moscow")).toBe(2);
    // Exactly one rebel army per space: no second placement when the victim answers.
    const polishUnits = Object.values(G.units).filter(
      (unit) => unit.owner === "REBEL:Poland" && unit.space !== null,
    );
    expect(polishUnits).toHaveLength(2);
  });

  test("the single-space case places one army without a second choice", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.powers.GE.hand = ["IE-A051"];
    const ctx = makeCtx([], seat("GE"));
    expect(playCard(G, ctx, "IE-A051", "event")).toBeUndefined();
    expect(G.pending?.kind).toBe("eventTargetPower");
    // Deprive RU of every controlled space but poland by handing them to GE.
    for (const space of Object.keys(G.spaces)) {
      if (space !== "poland" && G.spaces[space].control === "RU") G.spaces[space].control = "GE";
    }
    resolvePending(G, ctx, "RU");
    // Only one candidate exists: no space choice, straight to the victim.
    expect(G.pending?.kind).toBe("eventChoice");
    resolvePending(G, makeCtx([], seat("RU")), "discard");
    expect(G.pending).toBeNull();
    expect(rebelSteps(G, "poland")).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// A049 South German Confederation
// ---------------------------------------------------------------------------

describe("A049 South German Confederation", () => {
  const lookToVienna = GOALS.find((goal) => goal.power === "AU" && goal.kind === "rankedAlliances")!;

  test("annexed Bavaria still counts as an Austrian minor ally for National Goals", () => {
    const G = fresh();
    G.spaces.bavaria.ally = "AU";
    G.phase = "action";
    G.activePower = "AU";
    G.powers.AU.hand = ["IE-A049"];
    const before = goalMetric(G, "AU", lookToVienna);
    expect(before).toBeGreaterThan(0);

    const ctx = makeCtx([], seat("AU"));
    expect(playCard(G, ctx, "IE-A049", "event")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.spaces.bavaria.control).toBe("AU");
    expect(G.spaces.bavaria.homeOverride).toBe("AU");
    // The Bavaria minor's units are gone with the minor itself.
    expect(Object.values(G.units).some((unit) => unit.owner === "Bavaria")).toBe(false);
    // The Special keeps the National Goal metric where the pre-annexation
    // ally marker put it ("still treated as allied"); without the fix the
    // metric would lose Bavaria the moment the minor ceased to exist.
    expect(goalMetric(G, "AU", lookToVienna)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// A110 Extreme Militarism
// ---------------------------------------------------------------------------

describe("A110 Extreme Militarism", () => {
  test("the -1 VP is provisional and the outbreak refunds it", () => {
    const charged = fresh();
    charged.phase = "action";
    charged.activePower = "GE";
    charged.powers.GE.hand = ["IE-A110"];
    const before = charged.powers.GE.vp;

    expect(playCard(charged, makeCtx([], seat("GE")), "IE-A110", "event")).toBeUndefined();
    expect(charged.powers.GE.vp).toBe(before - 1);
    expect(charged.flags["extremeMilitarism_GE"]).toBe(1);

    // The outbreak's own stability bank also moves VP, so the refund is read
    // as a diff against an identical state that never played the card.
    const clean = fresh();
    outbreakGreatWar(charged, makeCtx([], seat("GE")), "GE", "test");
    outbreakGreatWar(clean, makeCtx([], seat("GE")), "GE", "test");
    // The refund erases the charge completely: both states score identically.
    expect(charged.powers.GE.vp).toBe(clean.powers.GE.vp);
    expect(charged.flags["extremeMilitarism_GE"]).toBeUndefined();
  });

  test("a play made after the outbreak is never charged", () => {
    const G = fresh();
    outbreakGreatWar(G, makeCtx([], seat("GE")), "GE", "test");
    const before = G.powers.GE.vp;
    // The card is gone from every hand at outbreak; simulate the engine state
    // the handler sees on a post-outbreak play.
    G.resolvingCard = "IE-A110";
    G.phase = "gwPlanning";
    expect(G.gw?.active).toBe(true);
    // The handler charges only while no GW is active; the flag never appears.
    expect(G.flags["extremeMilitarism_GE"]).toBeUndefined();
    expect(G.powers.GE.vp).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// A081 Conquest of Central Asia
// ---------------------------------------------------------------------------

describe("A081 Conquest of Central Asia", () => {
  const playCentralAsia = (G: ImperialElegyState): void => {
    G.spaces["central-asia"].control = "RU";
    G.phase = "action";
    G.activePower = "RU";
    G.powers.RU.hand = ["IE-A081"];
    expect(playCard(G, makeCtx([], seat("RU")), "IE-A081", "event")).toBeUndefined();
  };

  test("the card places the privileged reserve army in Central Asia", () => {
    const G = fresh();
    playCentralAsia(G);
    expect(G.persistent.russianAsiaReserve).toBe(true);
    const reserve = Object.values(G.units).find(
      (unit) => unit.owner === "RU" && unit.kind === "reserveArmy" && unit.space === "central-asia",
    );
    expect(reserve?.space).toBe("central-asia");
  });

  test("demobilization leaves the on-Asia reserve army on the map and returns the rest", () => {
    const G = fresh();
    playCentralAsia(G);
    const onAsia = Object.values(G.units).find(
      (unit) => unit.owner === "RU" && unit.kind === "reserveArmy" && unit.space === "central-asia",
    )!;
    const offAsia = placeUnit(G, "RU", "reserveArmy", "moscow", 2);

    const report = returnReserveArmies(G);
    const returned = report.find((entry) => entry.power === "RU")?.unitIds ?? [];
    expect(returned).toContain(offAsia.id);
    expect(returned).not.toContain(onAsia.id);
    expect(G.units[onAsia.id].space).toBe("central-asia");
    expect(G.units[offAsia.id].space).toBeNull();
  });

  test("the peacetime end phase eliminates the privileged army once it leaves Asia", () => {
    const G = fresh();
    playCentralAsia(G);
    const reserve = Object.values(G.units).find(
      (unit) => unit.owner === "RU" && unit.kind === "reserveArmy" && unit.space === "central-asia",
    )!;
    // A wartime redeploy took it off the Asia submap; the next peacetime end
    // phase sweeps it.
    G.spaces["moscow"].units.push(reserve.id);
    G.spaces["central-asia"].units = G.spaces["central-asia"].units.filter((id) => id !== reserve.id);
    reserve.space = "moscow";

    resolveEnd(G, makeCtx(), []);
    expect(G.units[reserve.id]).toBeUndefined();
    expect(G.log.some((entry) => entry.key === "russianAsiaReserveEliminated")).toBe(true);
  });

  test("an on-Asia privileged army survives the peacetime end phase", () => {
    const G = fresh();
    playCentralAsia(G);
    resolveEnd(G, makeCtx(), []);
    const reserve = Object.values(G.units).find(
      (unit) => unit.owner === "RU" && unit.kind === "reserveArmy" && unit.space === "central-asia",
    );
    expect(reserve?.space).toBe("central-asia");
  });
});

// ---------------------------------------------------------------------------
// A105 Impulsive Ruler
// ---------------------------------------------------------------------------

describe("A105 Impulsive Ruler", () => {
  test("the response window opens once the WTT has increased", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    expect(responseWindowFor(G, "GE")).toEqual({ok: true});
    expect(responseCardEligibility(G, "GE", "IE-A105")).toEqual({ok: false, reason: "wtt-trigger"});

    changeWtt(G, 1, makeCtx());
    expect(G.flags.wttIncreasedTurn).toBe(G.turn);
    expect(responseCardEligibility(G, "GE", "IE-A105")).toEqual({ok: true});
    // "MUST be played as a response card if the WTT increases": the CP mode
    // closes while the trigger stands, however few cards the hand holds.
    G.powers.GE.hand = ["IE-A105"];
    expect(cpPlayability(G, "GE", "IE-A105")).toEqual({ok: false, reason: "impulsive-ruler-response"});
  });

  test("the response play raises the WTT, grants no CP and draws a card", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    changeWtt(G, 1, makeCtx());
    G.powers.GE.hand = ["IE-A105"];
    const wttBefore = G.wtt;
    const deckBefore = G.deck.length;

    expect(playResponseCard(G, makeCtx([], seat("GE")), "IE-A105")).toBeUndefined();
    expect(G.wtt).toBe(wttBefore + 1);
    expect(G.cpRemaining).toBe(0);
    expect(G.powers.GE.hand).toHaveLength(1);
    expect(G.deck.length).toBe(deckBefore - 1);
    expect(G.discard).toContain("IE-A105");
  });

  test("without the trigger the card stays unplayable as a response and legal for CP", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.powers.GE.hand = ["IE-A105", "IE-A021", "IE-A022"];
    expect(responseCardEligibility(G, "GE", "IE-A105")).toEqual({ok: false, reason: "wtt-trigger"});
    expect(cpPlayability(G, "GE", "IE-A105")).toEqual({ok: true});
  });
});

