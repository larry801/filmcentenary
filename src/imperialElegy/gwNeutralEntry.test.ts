/**
 * 29.3 Neutral player powers in the Great War — the winter player choice, the
 * 8.4 / "larger alliance" limits, the roll-off order, the joining free
 * redeployment / deploy reserves / order slot, the stay-out free redeployment
 * and bonus CP, the opposing alliance bonus impulse, and privacy.
 */
import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {GreatWarState, ImperialElegyState, PendingDecision, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {
  freeDeployAllowance,
  joinNeutralAlliance,
  neutralBonusCpTargets,
  neutralEntrySides,
  rebalanceBonusImpulse,
  resolveGwWinter,
  rollOffNeutralOrder,
} from "./engine/greatWarFlow";
import {resolvePending} from "./moves";
import {ImperialElegyGameDef} from "./game";
import {redactForView} from "./engine/privacy";

const ctxFor = (playerID: string, dieValue = 3): Ctx =>
  ({
    playerID,
    random: {Die: (_sides: number) => dieValue},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const seatCtx = (power: Power, dieValue = 3): Ctx =>
  ctxFor(String(POWERS.indexOf(power)), dieValue);

const seqCtx = (values: number[]): Ctx => {
  let index = 0;
  return {
    playerID: "0",
    random: {
      Die: (_sides: number) => {
        const value = values[Math.min(index, values.length - 1)];
        index += 1;
        return value;
      },
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

const baseGw = (
  te: Power[],
  ta: Power[],
  neutrals: Power[],
  order?: GreatWarState["order"],
): ImperialElegyState => {
  const G = setupImperialElegy(ctxFor("0"));
  G.gw = {
    active: true,
    turn: 2,
    order: order ?? [...te, ...ta],
    belligerents: [...te, ...ta],
    neutrals: [...neutrals],
    te: [...te],
    ta: [...ta],
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
    combatCardsInFront: [],
  };
  for (const power of te) G.powers[power].alliance = "teCommitted";
  for (const power of ta) G.powers[power].alliance = "taCommitted";
  for (const power of neutrals) G.powers[power].alliance = "neutral";
  G.phase = "gwWinter";
  return G;
};

const pending = (G: ImperialElegyState): PendingDecision => {
  if (!G.pending) throw new Error("no pending decision");
  return G.pending;
};

const optionIds = (G: ImperialElegyState): string[] => pending(G).options.map((entry) => entry.id);

const choose = (G: ImperialElegyState, optionId: string, dieValue = 3): string | void =>
  resolvePending(G, seatCtx(pending(G).power, dieValue), optionId);

describe("29.3 neutral entry decision", () => {
  test("the winter stops for the neutral choice; joining grants the seat and free actions", () => {
    const G = baseGw(["FR"], ["GE"], ["RU"]);
    const res = resolveGwWinter(G, ctxFor("0"));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(res.awaitingNeutrals).toBe(true);
    expect(G.pending?.kind).toBe("gwNeutralEntry");
    expect(G.pending?.power).toBe("RU");
    expect(optionIds(G)).toEqual(["join:te", "join:ta", "stay"]);

    // Join the Entente.
    expect(choose(G, "join:te")).toBeUndefined();
    expect(G.powers.RU.alliance).toBe("teCommitted");
    expect(G.gw!.te).toContain("RU");
    expect(G.gw!.belligerents).toContain("RU");
    expect(G.gw!.neutrals).not.toContain("RU");
    // The next free player slot, after the existing player slots.
    expect(G.gw!.order).toContain("RU");
    expect(G.gw!.order.indexOf("RU")).toBeGreaterThan(G.gw!.order.indexOf("GE"));
    expect(G.pending?.kind).toBe("gwNeutralAction");
    expect(optionIds(G)).toEqual(["redeploy", "deploy", "done"]);

    // Free deploy reserves: half industry (min 1, max 3) to a home/key space.
    const reservesBefore = [...G.powers.RU.reserves];
    expect(reservesBefore.length).toBeGreaterThan(0);
    expect(choose(G, "deploy")).toBeUndefined();
    expect(G.pending?.kind).toBe("gwNeutralDeploy");
    expect(choose(G, "st-petersburg")).toBeUndefined();
    const placed = reservesBefore.filter((id) => G.units[id].space === "st-petersburg");
    expect(placed.length).toBe(Math.min(reservesBefore.length, freeDeployAllowance(G, "RU")));
    expect(G.powers.RU.reserves).toEqual(reservesBefore.slice(placed.length));
    expect(G.log.some((entry) => entry.key === "gwNeutralDeploy" && entry.power === "RU")).toBe(true);

    // Free redeployment: one unit to a friendly destination.
    const beforeRedeploy = Object.keys(G.units).find((id) => {
      const unit = G.units[id];
      return unit.owner === "RU" && unit.naval !== true && Boolean(unit.space);
    });
    expect(beforeRedeploy).toBeTruthy();
    expect(choose(G, "redeploy")).toBeUndefined();
    expect(G.pending?.kind).toBe("gwNeutralUnit");
    const unitOption = pending(G).options.find((entry) => entry.id.startsWith("unit:"));
    expect(unitOption).toBeTruthy();
    const unitId = unitOption!.id.slice(5);
    expect(choose(G, unitOption!.id)).toBeUndefined();
    expect(G.pending?.kind).toBe("gwNeutralDestination");
    const destination = pending(G).options[0].id;
    const from = G.units[unitId].space;
    expect(choose(G, destination)).toBeUndefined();
    expect(G.units[unitId].space).toBe(destination);
    expect(G.spaces[from!].units).not.toContain(unitId);
    expect(G.log.some((entry) => entry.key === "gwNeutralRedeploy" && entry.power === "RU")).toBe(true);

    // Finish the (only) neutral: the winter closes and planning begins.
    expect(choose(G, "done")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.gw!.neutralEntry).toBeNull();
    expect(G.gw!.turn).toBe(3);
    expect(G.phase).toBe("gwPlanning");
  });

  test("the live gwWinter phase hook opens the neutral decision", () => {
    const G = baseGw(["FR"], ["GE"], ["AU"]);
    G.phase = "gwWinter";
    type PhaseOnBegin = (G: ImperialElegyState, ctx: Ctx) => void;
    const phases = ImperialElegyGameDef.phases as unknown as Record<string, {onBegin: PhaseOnBegin}>;
    phases.gwWinter.onBegin(G, ctxFor("0"));
    expect(G.pending?.kind).toBe("gwNeutralEntry");
    expect(G.pending?.power).toBe("AU");
    // The phase stayed on winter, so the boardgame.io hook did not advance to
    // planning before the player answered.
    expect(G.phase).toBe("gwWinter");
    expect(choose(G, "stay")).toBeUndefined();
    expect(choose(G, "done")).toBeUndefined();
    expect(G.phase).toBe("gwPlanning");
    expect(G.gw!.turn).toBe(3);
  });

  test("the roll-off chooses the highest die first and rerolls ties", () => {
    const G = baseGw(["FR"], ["GE"], ["UK", "AU", "OT"]);
    const order = rollOffNeutralOrder(G, seqCtx([2, 5, 4]), ["UK", "AU", "OT"]);
    expect(order.map((entry) => entry.power)).toEqual(["AU", "OT", "UK"]);
    expect(order.map((entry) => entry.roll)).toEqual([5, 4, 2]);

    // UK and AU tie on 3; the reroll ranks UK first without letting OT's lower
    // initial 2 jump the queue.
    const tied = rollOffNeutralOrder(G, seqCtx([3, 3, 2, 6]), ["UK", "AU", "OT"]);
    expect(tied.map((entry) => entry.power)).toEqual(["UK", "AU", "OT"]);
    expect(tied.map((entry) => entry.roll)).toEqual([3, 3, 2]);

    // A constant die can never loop forever and keeps the seat order.
    const constant = rollOffNeutralOrder(G, ctxFor("0", 3), ["UK", "AU", "OT"]);
    expect(constant.map((entry) => entry.power)).toEqual(["UK", "AU", "OT"]);
  });

  test("the 8.4 three-player cap makes the full alliance illegal", () => {
    const G = baseGw(["FR", "UK", "RU"], ["AU"], ["OT"]);
    expect(neutralEntrySides(G, "OT")).toEqual(["ta"]);
    const res = resolveGwWinter(G, ctxFor("0"));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(optionIds(G)).toEqual(["join:ta", "stay"]);
    // A direct attempt at the full alliance is refused and changes nothing.
    expect(resolvePending(G, seatCtx("OT"), "join:te")).toBe(INVALID_MOVE);
    expect(G.powers.OT.alliance).toBe("neutral");
    expect(G.pending?.kind).toBe("gwNeutralEntry");
  });

  test("an eliminated ally no longer fills the 8.4 slot (30.1)", () => {
    const G = baseGw(["FR", "UK", "RU"], ["AU", "GE"], ["OT"]);
    // `eliminatePower` removes the power from the GW rosters but its alliance
    // chit stays in the committed box; the cap must count living players only.
    G.gw!.te = ["FR", "UK"];
    G.gw!.belligerents = ["FR", "UK", "AU", "GE"];
    G.powers.RU.eliminated = true;
    expect(neutralEntrySides(G, "OT")).toEqual(["te", "ta"]);
    expect(joinNeutralAlliance(G, ctxFor("0"), "OT", "te")).toBe(true);
    expect(G.gw!.te).toContain("OT");
  });

  test("a neutral cannot join an alliance larger than the opposing one", () => {
    const G = baseGw(["FR", "UK"], ["AU"], ["OT"]);
    expect(neutralEntrySides(G, "OT")).toEqual(["ta"]);
    const res = resolveGwWinter(G, ctxFor("0"));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(optionIds(G)).toEqual(["join:ta", "stay"]);
  });

  test("privacy: the decision and its options stay with the neutral", () => {
    const G = baseGw(["FR"], ["GE"], ["RU"]);
    resolveGwWinter(G, ctxFor("0"));
    const view = redactForView(G, String(POWERS.indexOf("GE")), ctxFor("2"));
    expect(view.pending?.options).toEqual([]);
    expect(view.pending?.context).toEqual({});
    const own = redactForView(G, String(POWERS.indexOf("RU")), ctxFor("4"));
    expect(own.pending?.options.length).toBe(3);
  });
});

describe("29.3 staying neutral", () => {
  test("a staying neutral may give a bonus CP to a belligerent with a LoC", () => {
    const G = baseGw(["FR"], ["GE"], ["AU"]);
    expect(neutralBonusCpTargets(G, "AU")).toContain("GE");
    const res = resolveGwWinter(G, ctxFor("0"));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.pending?.power).toBe("AU");
    expect(choose(G, "stay")).toBeUndefined();
    expect(G.pending?.kind).toBe("gwNeutralAction");
    expect(optionIds(G)).toContain("cp:GE");
    expect(optionIds(G)).not.toContain("deploy");
    // Giving the CP ends that neutral's choices and closes the winter.
    expect(choose(G, "cp:GE")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.log.some((entry) => entry.key === "gwNeutralBonusCp" && entry.power === "AU")).toBe(true);
    // The bonus lands in GE's next planning budget.
    expect(G.powers.GE.gwBudget).toBe(Math.max(2, G.powers.GE.industry) + 1);
  });

  test("a staying neutral may take the free redeployment", () => {
    const G = baseGw(["FR"], ["GE"], ["AU"]);
    resolveGwWinter(G, ctxFor("0"));
    expect(choose(G, "stay")).toBeUndefined();
    expect(choose(G, "redeploy")).toBeUndefined();
    const unitOption = pending(G).options.find((entry) => entry.id.startsWith("unit:"));
    expect(unitOption).toBeTruthy();
    const unitId = unitOption!.id.slice(5);
    expect(choose(G, unitOption!.id)).toBeUndefined();
    const destination = pending(G).options[0].id;
    const from = G.units[unitId].space;
    expect(choose(G, destination)).toBeUndefined();
    expect(G.units[unitId].space).toBe(destination);
    expect(G.spaces[from!].units).not.toContain(unitId);
    // The menu comes back so the neutral can still give its bonus CP.
    expect(G.pending?.kind).toBe("gwNeutralAction");
    expect(optionIds(G)).not.toContain("redeploy");
    expect(optionIds(G)).toContain("done");
  });

  test("declining the pending decision means staying neutral", () => {
    const G = baseGw(["FR"], ["GE"], ["AU"]);
    resolveGwWinter(G, ctxFor("0"));
    // declinePending is exercised through the generic move: staying neutral is
    // the printed "no" answer, then finish the free-action menu.
    expect(resolvePending(G, seatCtx("AU"), "stay")).toBeUndefined();
    expect(G.pending?.kind).toBe("gwNeutralAction");
    expect(choose(G, "done")).toBeUndefined();
    expect(G.gw!.neutrals).toEqual(["AU"]);
  });
});

describe("29.3 order slot and bonus impulse", () => {
  test("joining the smaller alliance gives the opposing alliance a bonus impulse", () => {
    const G = baseGw(["FR"], ["GE"], ["RU"]);
    const res = resolveGwWinter(G, ctxFor("0"));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(choose(G, "join:ta")).toBeUndefined();
    expect(G.gw!.order).toContain("bonus");
    expect(G.log.some((entry) => entry.key === "gwBonusImpulse" && entry.args?.side === "te")).toBe(true);
  });

  test("joining an alliance that had the bonus impulse removes it", () => {
    const G = baseGw(["FR"], ["GE", "AU"], ["RU"], ["GE", "AU", "FR", "bonus"]);
    const res = resolveGwWinter(G, ctxFor("0"));
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(choose(G, "join:te")).toBeUndefined();
    expect(G.gw!.te).toEqual(["FR", "RU"]);
    expect(G.gw!.order).not.toContain("bonus");
    expect(G.log.some((entry) => entry.key === "gwBonusImpulseRemoved")).toBe(true);
  });

  test("rebalance keeps exactly one bonus slot for the outnumbered side", () => {
    const G = baseGw(["FR"], ["GE", "AU"], [], ["GE", "AU", "FR"]);
    rebalanceBonusImpulse(G);
    expect(G.gw!.order.filter((slot) => slot === "bonus")).toHaveLength(1);
    // Equal sizes have no bonus slot.
    G.powers.RU.alliance = "teCommitted";
    G.gw!.te.push("RU");
    rebalanceBonusImpulse(G);
    expect(G.gw!.order).not.toContain("bonus");
  });

  test("joinNeutralAlliance validates the printed limits itself", () => {
    const G = baseGw(["FR", "UK", "RU"], ["AU"], ["OT"]);
    const ctx = ctxFor("0");
    expect(joinNeutralAlliance(G, ctx, "OT", "te")).toBe(false);
    expect(G.powers.OT.alliance).toBe("neutral");
    expect(G.log.some((entry) => entry.key === "gwNeutralEntryBlocked" && entry.power === "OT")).toBe(true);
    expect(joinNeutralAlliance(G, ctx, "OT", "ta")).toBe(true);
    expect(G.powers.OT.alliance).toBe("taCommitted");
  });
});
