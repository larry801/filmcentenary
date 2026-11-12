/**
 * 33.1 German characteristics — live coverage.
 *
 * Superior Staff Work (free deploy reserves in GE's first war/GW impulse),
 * German Confederation (annex a German minor after a won unification war,
 * including one gained by the realignment treaty), Zollverein (German
 * unification spaces always count as GE territorial keys) and Blood and Iron!
 * (turn-1 end phase search for the Unification! NG, played faceup).
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {GreatWarState, ImperialElegyState, PendingDecision, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {recomputeTracks} from "./engine/rules";
import {
  beginEndPhase,
  declareWar,
  deployReserves,
  gwDeploy,
  gwPass,
  passWarMove,
  resolvePending,
  resolveWar,
  startWarManeuver,
} from "./moves";
import {
  germanConfederationCandidates,
  superiorStaffWorkFreeDeploy,
  superiorStaffWorkGwFreeDeploy,
} from "./engine/characteristics";
import {europeanKeys} from "./engine/victory";

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

/** Minimal live Great War maneuver state for the Superior Staff Work GW half. */
const activateGw = (G: ImperialElegyState): void => {
  const gw: GreatWarState = {
    active: true,
    turn: 0,
    order: ["GE", "FR"],
    belligerents: ["GE", "FR"],
    neutrals: ["UK", "AU", "RU", "OT"],
    te: ["GE"],
    ta: ["FR"],
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
  G.gw = gw;
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.pending = null;
  G.powers.GE.gwBudget = 3;
  G.powers.FR.gwBudget = 3;
};

const startAction = (G: ImperialElegyState, power: Power, cp = 4): void => {
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = cp;
  G.pending = null;
};

/** Declare and start GE's war of unification over AU-held Bavaria. */
const startUnificationWar = (G: ImperialElegyState): void => {
  startAction(G, "GE");
  G.spaces.bavaria.control = "AU";
  const ctx = makeCtx([3], seat("GE"));
  expect(declareWar(G, ctx, "AU", "unification", ["bavaria"], 2)).toBeUndefined();
  expect(startWarManeuver(G, ctx)).toBeUndefined();
  expect(G.war?.status).toBe("maneuver");
};

/** Resolve the end phase, choosing `bloodAndIron` from `pick` when offered. */
const runEndPhase = (
  G: ImperialElegyState,
  ctx: Ctx,
  pick: (pending: PendingDecision) => string | undefined = () => undefined,
): string[] => {
  const seen: string[] = [];
  beginEndPhase(G, ctx);
  let guard = 0;
  while (G.pending !== null) {
    guard += 1;
    if (guard > 400) throw new Error("the end phase did not settle");
    const pending = G.pending;
    seen.push(`${pending.kind}:${pending.power}`);
    const decisionCtx = {...ctx, playerID: seat(pending.power)};
    const optionId = pick(pending) ?? pending.options.find((o) => o.id === "skip")?.id ?? pending.options[0]?.id ?? "";
    expect(resolvePending(G, decisionCtx, optionId)).toBeUndefined();
  }
  expect(G.endPhase).toBeUndefined();
  return seen;
};

describe("33.1 Superior Staff Work", () => {
  test("GE's first war impulse deploys one reserve army without spending the war budget", () => {
    const G = fresh();
    startUnificationWar(G);
    const ctx = makeCtx([3], seat("GE"));
    const budget = G.war!.budgets.GE!;
    const reserveId = G.powers.GE.reserves[0];
    expect(reserveId).toBeDefined();
    expect(superiorStaffWorkFreeDeploy(G, "GE")).toBe(true);

    expect(deployReserves(G, ctx, "berlin", 1)).toBeUndefined();

    expect(G.war!.budgets.GE).toBe(budget);
    expect(G.units[reserveId].space).toBe("berlin");
    expect(G.powers.GE.flags.superiorStaffWorkUsed).toBe(true);
    expect(superiorStaffWorkFreeDeploy(G, "GE")).toBe(false);
    const log = G.log.filter((entry) => entry.key === "superiorStaffWork");
    expect(log).toHaveLength(1);
    expect(log[0].args).toMatchObject({space: "berlin", count: 1});
  });

  test("a second deploy reserves action is no longer free (no reserves left is rejected)", () => {
    const G = fresh();
    startUnificationWar(G);
    const ctx = makeCtx([3], seat("GE"));
    expect(deployReserves(G, ctx, "berlin", 1)).toBeUndefined();
    // The setup only gives GE one reserve; a second action has nothing to place.
    expect(deployReserves(G, ctx, "berlin", 1)).toBe(INVALID_MOVE);
  });

  test("passing forfeits the free action once per war and logs the decline", () => {
    const G = fresh();
    startUnificationWar(G);
    const ctx = makeCtx([3], seat("GE"));
    expect(passWarMove(G, ctx)).toBeUndefined();
    expect(G.powers.GE.flags.superiorStaffWorkUsed).toBe(true);
    expect(G.log.some((entry) => entry.key === "superiorStaffWorkDeclined")).toBe(true);
  });

  test("A063 Rapid Mobilization's free deploy is not stacked with Superior Staff Work", () => {
    const G = fresh();
    startUnificationWar(G);
    const ctx = makeCtx([3], seat("GE"));
    // Pretend GE played A063 for this war.
    G.flags.rapidMobilization = true;
    G.powers.GE.flags.rapidMobilization = true;

    expect(deployReserves(G, ctx, "berlin", 1)).toBeUndefined();

    expect(G.powers.GE.flags.rapidFreeDeployUsed).toBe(true);
    expect(G.powers.GE.flags.superiorStaffWorkUsed).toBeUndefined();
  });

  test("the first GW impulse also deploys reserves for free", () => {
    const G = fresh();
    activateGw(G);
    const ctx = makeCtx([3], seat("GE"));
    const reserveId = G.powers.GE.reserves[0];
    expect(superiorStaffWorkFreeDeploy(G, "GE")).toBe(false);
    // 33.1: the first GW impulse is latched by the live GW move itself, so the
    // grant is consumed from GE's first active impulse of GW turn 0.
    expect(superiorStaffWorkGwFreeDeploy(G)).toBe(false);
    expect(gwDeploy(G, ctx, "berlin")).toBeUndefined();
    expect(G.powers.GE.gwBudget).toBe(3);
    expect(G.units[reserveId].space).toBe("berlin");
    expect(G.powers.GE.flags.superiorStaffWorkGwUsed).toBe(true);
    expect(superiorStaffWorkGwFreeDeploy(G)).toBe(false);
  });

  test("a first GW impulse that passes forfeits the free deploy", () => {
    const G = fresh();
    activateGw(G);
    const ctx = makeCtx([3], seat("GE"));
    expect(gwPass(G, ctx)).toBeUndefined();
    expect(G.powers.GE.flags.superiorStaffWorkGwUsed).toBe(true);
    expect(G.log.some((entry) => entry.key === "superiorStaffWorkDeclined" && entry.args?.scope === "gw")).toBe(true);
  });

  test("Superior Staff Work never applies to another power", () => {
    const G = fresh();
    startUnificationWar(G);
    expect(superiorStaffWorkFreeDeploy(G, "AU")).toBe(false);
    expect(superiorStaffWorkFreeDeploy(G, "FR")).toBe(false);
  });
});

describe("33.1 German Confederation", () => {
  test("a won unification war offers the eligible German minor allies and annexes the chosen one", () => {
    const G = fresh();
    startAction(G, "GE");
    G.spaces.bavaria.control = "AU";
    const ctx = makeCtx([3], seat("GE"));
    expect(declareWar(G, ctx, "AU", "unification", ["bavaria"], 2)).toBeUndefined();
    // Bavaria returns to its own control but stays allied to GE: the attacker
    // now holds the objective and Bavaria is an eligible minor ally.
    G.spaces.bavaria.control = "Bavaria";
    G.spaces.bavaria.ally = "GE";
    placeUnit(G, "Bavaria", "army", "bavaria", 2);

    expect(resolveWar(G, ctx, [])).toBeUndefined();

    expect(G.pending?.kind).toBe("germanConfederation");
    expect(G.pending?.power).toBe("GE");
    const optionIds = G.pending!.options.map((o) => o.id);
    expect(optionIds).toContain("bavaria");
    expect(optionIds).toContain("decline");
    expect(germanConfederationCandidates(G).map((c) => c.minor)).toEqual(["Bavaria"]);

    // Only GE may answer.
    expect(resolvePending(G, {...ctx, playerID: seat("AU")}, "bavaria")).toBe(INVALID_MOVE);
    expect(resolvePending(G, ctx, "bavaria")).toBeUndefined();

    expect(G.spaces.bavaria.control).toBe("GE");
    expect(G.spaces.bavaria.ally).toBeNull();
    expect(G.spaces.bavaria.homeOverride).toBe("GE");
    expect(G.eliminatedMinors).toContain("Bavaria");
    expect(Object.values(G.units).some((unit) => unit.owner === "Bavaria")).toBe(false);
    expect(G.pending?.kind).not.toBe("germanConfederation");
    expect(G.log.some((entry) => entry.key === "germanConfederation")).toBe(true);
    expect(G.war).toBeNull();
    expect(G.phase).toBe("action");
  });

  test("declining leaves the minor ally in place and logs the decline", () => {
    const G = fresh();
    startAction(G, "GE");
    G.spaces.saxony.control = "AU";
    const ctx = makeCtx([3], seat("GE"));
    expect(declareWar(G, ctx, "AU", "unification", ["saxony"], 2)).toBeUndefined();
    G.spaces.saxony.control = "Saxony";
    G.spaces.saxony.ally = "GE";

    expect(resolveWar(G, ctx, [])).toBeUndefined();
    expect(G.pending?.kind).toBe("germanConfederation");
    expect(resolvePending(G, ctx, "decline")).toBeUndefined();

    expect(G.spaces.saxony.control).toBe("Saxony");
    expect(G.spaces.saxony.ally).toBe("GE");
    expect(G.eliminatedMinors ?? []).not.toContain("Saxony");
    expect(G.log.some((entry) => entry.key === "germanConfederationDeclined")).toBe(true);
    expect(G.war).toBeNull();
  });

  test("a minor gained by the realignment treaty option is eligible", () => {
    const G = fresh();
    startAction(G, "GE");
    G.spaces.bavaria.control = "AU";
    const ctx = makeCtx([3], seat("GE"));
    expect(declareWar(G, ctx, "AU", "unification", ["bavaria"], 2)).toBeUndefined();
    // The minor is allied to the loser before the treaty; the unification
    // realignment option hands it to GE.
    G.spaces.bavaria.control = "Bavaria";
    G.spaces.bavaria.ally = "AU";
    G.spaces.bavaria.occupiedBy = "GE";

    expect(resolveWar(G, ctx, [{option: "realignment"}])).toBeUndefined();
    expect(G.spaces.bavaria.ally).toBe("GE");
    expect(G.pending?.kind).toBe("germanConfederation");
    expect(G.pending!.options.map((o) => o.id)).toContain("bavaria");

    expect(resolvePending(G, ctx, "bavaria")).toBeUndefined();
    expect(G.spaces.bavaria.control).toBe("GE");
    expect(G.eliminatedMinors).toContain("Bavaria");
  });

  test("a non-unification victory never opens the Confederation choice", () => {
    const G = fresh();
    startAction(G, "GE");
    G.spaces.bohemia.control = "AU";
    const ctx = makeCtx([3], seat("GE"));
    expect(declareWar(G, ctx, "AU", "conquest", ["bohemia"], 2)).toBeUndefined();
    G.spaces.bohemia.occupiedBy = "GE";
    G.spaces.bavaria.control = "Bavaria";
    G.spaces.bavaria.ally = "GE";

    expect(resolveWar(G, ctx, [])).toBeUndefined();
    expect(G.pending?.kind).not.toBe("germanConfederation");
    expect(G.spaces.bavaria.control).toBe("Bavaria");
  });
});

describe("33.1 Zollverein", () => {
  test("a GE-controlled German unification space counts as a territorial key", () => {
    const G = fresh();
    recomputeTracks(G);
    const before = G.powers.GE.territorialKeys;
    const beforeEuropean = europeanKeys(G, "GE");

    G.spaces.bavaria.control = "GE";
    recomputeTracks(G);

    expect(G.powers.GE.territorialKeys).toBe(before + 1);
    expect(europeanKeys(G, "GE")).toBe(beforeEuropean + 1);
  });

  test("does not double count a German space that already prints a territorial key", () => {
    const G = fresh();
    recomputeTracks(G);
    const before = G.powers.GE.territorialKeys;
    // Silesia is already a printed territorial key; re-stamping control is a no-op.
    G.spaces.silesia.control = "GE";
    recomputeTracks(G);
    expect(G.powers.GE.territorialKeys).toBe(before);
  });

  test("Zollverein only credits GE, not another controller of the same space", () => {
    const G = fresh();
    G.spaces.bavaria.control = "FR";
    recomputeTracks(G);
    const frBefore = G.powers.FR.territorialKeys;
    G.spaces.bavaria.control = "GE";
    recomputeTracks(G);
    expect(G.powers.FR.territorialKeys).toBe(frBefore);
    expect(G.powers.GE.territorialKeys).toBeGreaterThan(0);
  });
});

describe("33.1 Blood and Iron!", () => {
  test("turn 1 end phase offers the search, then selects NG-08 faceup without a normal draw", () => {
    const G = fresh();
    G.turn = 1;
    const ctx = makeCtx([3], "0");
    let sawChoice = false;
    const seen = runEndPhase(G, ctx, (pending) => {
      if (pending.kind !== "bloodAndIron") return undefined;
      sawChoice = true;
      expect(pending.power).toBe("GE");
      expect(pending.options.map((o) => o.id)).toEqual(["search", "draw"]);
      return "search";
    });

    expect(sawChoice).toBe(true);
    expect(seen).toContain("bloodAndIron:GE");
    expect(G.powers.GE.goals).toContain("NG-08");
    expect(G.revealedGoals).toContain("NG-08");
    expect(G.powers.GE.flags.ngChoices).toBeUndefined();
    expect(G.powers.GE.goalDeck).not.toContain("NG-08");
    expect(G.log.some((entry) => entry.key === "bloodAndIron")).toBe(true);
    // The other five powers still drew normally.
    for (const power of POWERS.filter((p) => p !== "GE")) {
      expect(String(G.powers[power].flags.ngChoices ?? "").split(",").filter(Boolean)).toHaveLength(3);
    }
  });

  test("declining draws three NGs normally and reveals nothing", () => {
    const G = fresh();
    G.turn = 1;
    const ctx = makeCtx([3], "0");
    runEndPhase(G, ctx, (pending) => (pending.kind === "bloodAndIron" ? "draw" : undefined));
    expect(String(G.powers.GE.flags.ngChoices ?? "").split(",").filter(Boolean)).toHaveLength(3);
    expect(G.revealedGoals ?? []).not.toContain("NG-08");
  });

  test("the choice is only offered on turn 1", () => {
    const G = fresh();
    G.turn = 3;
    const ctx = makeCtx([3], "0");
    const seen = runEndPhase(G, ctx);
    expect(seen).not.toContain("bloodAndIron:GE");
    expect(String(G.powers.GE.flags.ngChoices ?? "").split(",").filter(Boolean)).toHaveLength(3);
  });

  test("only the GE seat may answer the choice", () => {
    const G = fresh();
    G.turn = 1;
    const ctx = makeCtx([3], "0");
    beginEndPhase(G, ctx);
    let guard = 0;
    while (G.pending !== null && G.pending.kind !== "bloodAndIron") {
      guard += 1;
      if (guard > 400) throw new Error("the end phase did not reach Blood and Iron!");
      const pending = G.pending;
      const decisionCtx = {...ctx, playerID: seat(pending.power)};
      const optionId = pending.options.find((o) => o.id === "skip")?.id ?? pending.options[0]?.id ?? "";
      expect(resolvePending(G, decisionCtx, optionId)).toBeUndefined();
    }
    expect(G.pending?.kind).toBe("bloodAndIron");
    expect(resolvePending(G, {...ctx, playerID: seat("AU")}, "search")).toBe(INVALID_MOVE);
    expect(G.pending?.kind).toBe("bloodAndIron");
  });
});
