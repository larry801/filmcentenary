/**
 * 33.2 Rapid Deployment.
 *
 * "When the UK enters a war (including the GW) they may immediately conduct one
 * free naval movement action. Land units using this movement must end their
 * movement in a friendly port."
 *
 * Covers the grant on entry (declaration, ally join, GW outbreak), the free
 * naval move that spends no CP/GW budget, the decline path, the once-per-war
 * limit and the printed destination restrictions.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {outbreakGreatWar} from "./engine/greatWar";
import {canUseRapidDeployment} from "./engine/characteristics";
import {declareWar, declineRapidDeployment, rapidDeploy} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
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

const ukArmy = (G: ImperialElegyState) =>
  Object.values(G.units).find((unit) => unit.owner === "UK" && unit.kind === "army")!;

const londonSquadron = (G: ImperialElegyState) =>
  G.spaces.london.units
    .map((id) => G.units[id])
    .find((unit) => unit !== undefined && unit.owner === "UK" && unit.kind === "squadron")!;

/** Declare war on the UK (GE attacks) so the UK enters as the defender. */
const warOnUk = (G: ImperialElegyState): void => {
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 6;
  G.pending = null;
  expect(declareWar(G, makeCtx([], seat("GE")), "UK", "conquest", ["scotland"], 2)).toBeUndefined();
  G.war!.status = "maneuver";
};

const gwWithUk = (G: ImperialElegyState): void => {
  G.powers.GE.alliance = "taCommitted";
  G.powers.UK.alliance = "teCommitted";
  for (const power of POWERS) {
    if (power !== "GE" && power !== "UK") G.powers[power].alliance = "neutral";
  }
  G.powers.UK.vp = 0;
  outbreakGreatWar(G, makeCtx([3]), "GE", "incident");
};

describe("Rapid Deployment grant", () => {
  test("the UK receives the grant when it is attacked", () => {
    const G = fresh();
    expect(canUseRapidDeployment(G, "UK")).toBe(false);
    warOnUk(G);
    expect(canUseRapidDeployment(G, "UK")).toBe(true);
    expect(G.powers.UK.rapidDeployment).toMatchObject({scope: "limited", spent: false});
  });

  test("the UK receives the grant when it declares war", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "UK";
    G.cpRemaining = 6;
    G.pending = null;
    expect(declareWar(G, makeCtx([], seat("UK")), "GE", "conquest", ["silesia"], 2)).toBeUndefined();
    expect(G.powers.UK.rapidDeployment).toMatchObject({scope: "limited", spent: false});
  });

  test("the GW outbreak grants the GW-scoped action to a belligerent UK", () => {
    const G = fresh();
    gwWithUk(G);
    expect(G.gw?.belligerents).toContain("UK");
    expect(G.powers.UK.rapidDeployment).toMatchObject({scope: "gw", spent: false});
  });

  test("a neutral UK at the outbreak does not receive the GW grant", () => {
    const G = fresh();
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    for (const power of POWERS) {
      if (power !== "GE" && power !== "FR") G.powers[power].alliance = "neutral";
    }
    outbreakGreatWar(G, makeCtx([3]), "GE", "incident");
    expect(G.gw?.belligerents).not.toContain("UK");
    expect(G.powers.UK.rapidDeployment ?? null).toBeNull();
  });
});

describe("the free naval movement action", () => {
  test("moves a squadron without spending CP and is then spent", () => {
    const G = fresh();
    warOnUk(G);
    const squadron = londonSquadron(G);
    G.phase = "wartime";
    G.activePower = "UK";
    G.cpRemaining = 0;
    G.pending = null;

    expect(rapidDeploy(G, makeCtx([], seat("UK")), [squadron.id], "north-atlantic")).toBeUndefined();

    expect(G.units[squadron.id].space).toBe("north-atlantic");
    expect(G.cpRemaining).toBe(0);
    expect(G.powers.UK.rapidDeployment).toMatchObject({scope: "limited", spent: true});
    expect(G.log.some((entry) => entry.key === "rapidDeployment")).toBe(true);
    // Once per war: a second attempt is refused.
    expect(rapidDeploy(G, makeCtx([], seat("UK")), [squadron.id], "north-atlantic")).toBe(INVALID_MOVE);
    expect(canUseRapidDeployment(G, "UK")).toBe(false);
  });

  test("can be declined once, and never returns", () => {
    const G = fresh();
    warOnUk(G);
    G.phase = "wartime";
    G.activePower = "UK";
    G.pending = null;

    expect(declineRapidDeployment(G, makeCtx([], seat("UK")))).toBeUndefined();
    expect(G.powers.UK.rapidDeployment).toMatchObject({spent: true});
    expect(rapidDeploy(G, makeCtx([], seat("UK")), [londonSquadron(G).id], "north-atlantic")).toBe(INVALID_MOVE);
  });

  test("rejects a non-naval unit, an enemy port and the wrong actor/phase", () => {
    const G = fresh();
    warOnUk(G);
    const squadron = londonSquadron(G);
    G.phase = "wartime";
    G.activePower = "UK";
    G.cpRemaining = 0;
    G.pending = null;

    // Land units are not carried by this path (no generic transport move).
    expect(rapidDeploy(G, makeCtx([], seat("UK")), [ukArmy(G).id], "north-atlantic")).toBe(INVALID_MOVE);
    // An enemy port is not a legal free-naval destination.
    expect(rapidDeploy(G, makeCtx([], seat("UK")), [squadron.id], "paris")).toBe(INVALID_MOVE);
    // Only the UK may use it.
    expect(rapidDeploy(G, makeCtx([], seat("FR")), [squadron.id], "north-atlantic")).toBe(INVALID_MOVE);
    // Wrong phase.
    G.phase = "action";
    expect(rapidDeploy(G, makeCtx([], seat("UK")), [squadron.id], "north-atlantic")).toBe(INVALID_MOVE);
    // Nothing was spent by any rejected attempt.
    expect(G.powers.UK.rapidDeployment).toMatchObject({spent: false});
    expect(G.units[squadron.id].space).toBe("london");
  });

  test("the GW grant works without a GW budget and does not consume it", () => {
    const G = fresh();
    gwWithUk(G);
    const squadron = londonSquadron(G);
    G.phase = "gwManeuver";
    G.activePower = "UK";
    const budget = G.powers.UK.gwBudget ?? 0;
    G.pending = null;

    expect(rapidDeploy(G, makeCtx([], seat("UK")), [squadron.id], "north-atlantic")).toBeUndefined();

    expect(G.units[squadron.id].space).toBe("north-atlantic");
    expect(G.powers.UK.gwBudget).toBe(budget);
    expect(G.powers.UK.rapidDeployment).toMatchObject({scope: "gw", spent: true});
  });

  test("negative: a limited-war grant cannot be used during the GW", () => {
    const G = fresh();
    warOnUk(G);
    const squadron = londonSquadron(G);
    G.phase = "gwManeuver";
    G.activePower = "UK";
    G.pending = null;
    expect(rapidDeploy(G, makeCtx([], seat("UK")), [squadron.id], "north-atlantic")).toBe(INVALID_MOVE);
  });
});

describe("land units and the printed port restriction", () => {
  test("the free action never creates a land unit at sea", () => {
    const G = fresh();
    warOnUk(G);
    const army = ukArmy(G);
    G.phase = "wartime";
    G.activePower = "UK";
    G.pending = null;
    expect(rapidDeploy(G, makeCtx([], seat("UK")), [army.id], "north-atlantic")).toBe(INVALID_MOVE);
    expect(G.units[army.id].space).toBe("london");
  });

  test("a naval stack of the UK moves together for free", () => {
    const G = fresh();
    warOnUk(G);
    const squadrons = G.spaces.london.units
      .map((id) => G.units[id])
      .filter((unit) => unit !== undefined && unit.owner === "UK" && unit.kind === "squadron");
    expect(squadrons.length).toBeGreaterThanOrEqual(2);
    G.phase = "wartime";
    G.activePower = "UK";
    G.pending = null;
    const ids = squadrons.map((unit) => unit.id);
    expect(rapidDeploy(G, makeCtx([], seat("UK")), ids, "north-atlantic")).toBeUndefined();
    for (const id of ids) expect(G.units[id].space).toBe("north-atlantic");
  });

  test("a neutral third party cannot be dragged into the free move", () => {
    const G = fresh();
    warOnUk(G);
    const french = placeUnit(G, "FR", "squadron", "london", 2);
    G.phase = "wartime";
    G.activePower = "UK";
    G.pending = null;
    expect(rapidDeploy(G, makeCtx([], seat("UK")), [french.id], "north-atlantic")).toBe(INVALID_MOVE);
  });
});
