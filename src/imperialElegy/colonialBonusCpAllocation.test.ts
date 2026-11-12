/**
 * 29.2.1 The Colonial War — bonus-CP allocation.
 *
 * "These bonus CP must be divided up amongst alliance members who are not
 * blockaded … If players cannot come to an agreement on how to allocate bonus
 * CP, all bonus CP are lost."  The live winter opens one private
 * `gwColonialBonusCp` decision per CP for the alliance's deterministic
 * controller; the explicit decline loses the whole pool.  Direct helper/bot
 * calls keep the round-robin deterministic fallback.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {GreatWarState, ImperialElegyState, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {resolveGwWinter} from "./engine/greatWarFlow";
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

/**
 * TE = UK + FR, TA = GE.  The counted Africa and Asia spaces are all
 * British/French, so TE controls both submaps and earns the printed 3 CP.
 */
const baseGw = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = {
    active: true,
    turn: 2,
    order: ["UK", "FR", "GE"],
    belligerents: ["UK", "FR", "GE"],
    neutrals: [],
    te: ["UK", "FR"],
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
  };
  G.powers.UK.alliance = "teCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.powers.GE.alliance = "taCommitted";
  G.phase = "gwWinter";
  return G;
};

/** Clear the two colonial transfer decisions that precede the bonus choice. */
const skipTransfers = (G: ImperialElegyState): void => {
  for (let guard = 0; guard < 4; guard += 1) {
    const pending = G.pending;
    if (!pending || pending.kind !== "gwColonialTransfer") return;
    expect(resolvePending(G, seatCtx(pending.power), "skip")).toBeUndefined();
  }
  throw new Error("transfer decisions did not finish");
};

const openBonus = (): ImperialElegyState => {
  const G = baseGw();
  const res = resolveGwWinter(G, makeCtx(3), {promptChoices: true});
  expect(res.ok).toBe(true);
  if (!res.ok) throw new Error(res.message);
  skipTransfers(G);
  expect(G.pending?.kind).toBe("gwColonialBonusCp");
  return G;
};

describe("29.2.1 live bonus-CP allocation", () => {
  test("the winner allocates the 3 CP one at a time and the split lands in the next planning step", () => {
    const G = openBonus();
    expect(G.pending?.power).toBe("UK");
    expect(G.pending?.promptArgs).toMatchObject({side: "te", pool: 3, remaining: 3});
    const options = G.pending!.options.map((entry) => entry.id);
    expect(options).toEqual(expect.arrayContaining(["power:UK", "power:FR", "decline"]));

    expect(resolvePending(G, seatCtx("UK"), "power:UK")).toBeUndefined();
    expect(G.pending?.promptArgs).toMatchObject({remaining: 2});
    expect(resolvePending(G, seatCtx("UK"), "power:UK")).toBeUndefined();
    expect(G.pending?.promptArgs).toMatchObject({remaining: 1});
    expect(resolvePending(G, seatCtx("UK"), "power:FR")).toBeUndefined();

    expect(G.pending).toBeNull();
    expect(G.gw!.winter).toBeNull();
    expect(G.gw!.turn).toBe(3);
    expect(G.phase).toBe("gwPlanning");
    // 29.2.1: the chosen split is paid into the next planning budgets.
    const secondEmpire = G.powers.FR.government === "secondEmpire" ? 1 : 0;
    expect(G.powers.UK.gwBudget).toBe(Math.max(2, G.powers.UK.industry) + 2);
    expect(G.powers.FR.gwBudget).toBe(Math.max(2, G.powers.FR.industry) + 1 + secondEmpire);
    // The one-shot bonus bag is consumed by planning.
    expect(G.gw!.bonusCp).toEqual({});
    const logged = G.log.find((entry) => entry.key === "gwColonialBonusCp" && entry.args?.lost === false);
    expect(logged?.args?.recipients).toBe("UK,UK,FR");
  });

  test("the printed disagreement loses the entire pool", () => {
    const G = baseGw();
    resolveGwWinter(G, makeCtx(3), {promptChoices: true});
    skipTransfers(G);
    expect(G.pending?.kind).toBe("gwColonialBonusCp");
    expect(resolvePending(G, seatCtx("UK"), "decline")).toBeUndefined();

    expect(G.pending).toBeNull();
    expect(G.phase).toBe("gwPlanning");
    const secondEmpire = G.powers.FR.government === "secondEmpire" ? 1 : 0;
    expect(G.powers.UK.gwBudget).toBe(Math.max(2, G.powers.UK.industry));
    expect(G.powers.FR.gwBudget).toBe(Math.max(2, G.powers.FR.industry) + secondEmpire);
    const lost = G.log.find((entry) => entry.key === "gwColonialBonusCp" && entry.args?.lost === true);
    expect(lost?.args).toMatchObject({side: "te", pool: 3, reason: "disagreement"});
    expect(logText(lost!, "en")).toContain("could not agree");
  });

  test("declining after part of the pool was allocated loses the allocated CP too", () => {
    const G = openBonus();
    expect(resolvePending(G, seatCtx("UK"), "power:FR")).toBeUndefined();
    expect(G.pending?.promptArgs).toMatchObject({remaining: 2});
    expect(resolvePending(G, seatCtx("UK"), "decline")).toBeUndefined();

    expect(G.pending).toBeNull();
    expect(G.phase).toBe("gwPlanning");
    const secondEmpire = G.powers.FR.government === "secondEmpire" ? 1 : 0;
    expect(G.powers.UK.gwBudget).toBe(Math.max(2, G.powers.UK.industry));
    expect(G.powers.FR.gwBudget).toBe(Math.max(2, G.powers.FR.industry) + secondEmpire);
  });

  test("a reject from the wrong seat or an ineligible recipient leaves the decision open", () => {
    const G = openBonus();
    expect(resolvePending(G, seatCtx("FR"), "power:FR")).toBe(INVALID_MOVE);
    expect(resolvePending(G, seatCtx("UK"), "power:GE")).toBe(INVALID_MOVE);
    expect(resolvePending(G, seatCtx("UK"), "power:IT")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("gwColonialBonusCp");
    expect(G.pending?.promptArgs).toMatchObject({remaining: 3});
  });

  test("the bonus options are private to the deciding seat", () => {
    const G = openBonus();
    const view = redactForView(G, String(POWERS.indexOf("FR")));
    expect(view.pending?.options).toEqual([]);
    const own = redactForView(G, String(POWERS.indexOf("UK")));
    expect(own.pending?.options.length).toBeGreaterThan(0);
  });

  test("a single eligible ally receives the whole pool without a decision", () => {
    const G = baseGw();
    // A dead UK no longer counts as a living alliance member; FR is then the
    // only eligible ally, so there is nothing to negotiate and the 3 CP are
    // awarded directly.
    G.powers.UK.eliminated = true;
    G.powers.UK.stability = 0;
    resolveGwWinter(G, makeCtx(3), {promptChoices: true});
    skipTransfers(G);
    expect(G.pending).toBeNull();
    expect(G.phase).toBe("gwPlanning");
    expect(G.powers.FR.gwBudget).toBe(
      Math.max(2, G.powers.FR.industry) + 3 + (G.powers.FR.government === "secondEmpire" ? 1 : 0),
    );
  });

  test("the deterministic fallback keeps the round-robin split for unattended games", () => {
    const G = baseGw();
    const res = resolveGwWinter(G, makeCtx(3));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.pending).toBeNull();
    expect(res.awaitingColonialChoices).not.toBe(true);
    expect(res.bonusCp).toEqual({UK: 2, FR: 1});
    const secondEmpire = G.powers.FR.government === "secondEmpire" ? 1 : 0;
    expect(G.powers.UK.gwBudget).toBe(Math.max(2, G.powers.UK.industry) + 2);
    expect(G.powers.FR.gwBudget).toBe(Math.max(2, G.powers.FR.industry) + 1 + secondEmpire);
  });
});
