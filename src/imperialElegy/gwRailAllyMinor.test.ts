/**
 * 15.4 / 27.5 — a GW Rail Move may carry a controlled allied minor's army.
 *
 * "Minor powers that are allied to a player move as part of their controlling
 * player's march, rail, and naval movement actions."  The rail action still
 * costs exactly 1 CP, uses the ordinary friendly-network path/destination
 * rules, and only carries an army counter (not an EC/EF).  The free 33.5 TSRR
 * move already uses the same command rule
 * (`moves.ts#tsrrMinorRailDecision`); this suite pins the GW rail path.
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {performGwManeuver} from "./engine/greatWarFlow";

const makeCtx = (dieValue = 3): Ctx =>
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
    phase: "action",
  }) as unknown as Ctx;

/** GE is the active CP power; Bavaria is its allied minor and Saxony is friendly. */
const gwState = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = {
    active: true,
    turn: 1,
    order: ["GE", "FR"],
    belligerents: ["GE", "FR"],
    neutrals: ["UK", "AU", "RU", "OT"],
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
  };
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.powers.GE.gwBudget = 5;
  G.spaces.bavaria.ally = "GE";
  G.spaces.saxony.control = "GE";
  return G;
};

const bavarianArmy = (G: ImperialElegyState, space = "bavaria") =>
  placeUnit(G, "Bavaria", "minorArmy", space as never, 2);

describe("15.4/27.5 GW rail carrying a controlled allied minor army", () => {
  test("GE rails its controlled Bavarian army for one CP and the counter stays Bavarian", () => {
    const G = gwState();
    const army = bavarianArmy(G);

    const result = performGwManeuver(G, makeCtx(), {
      kind: "rail",
      power: "GE",
      unitId: army.id,
      to: "berlin",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    expect(result.cost).toBe(1);
    expect(result.budgetBefore).toBe(5);
    expect(result.budgetAfter).toBe(4);
    expect(G.powers.GE.gwBudget).toBe(4);
    expect(G.units[army.id].space).toBe("berlin");
    expect(G.units[army.id].owner).toBe("Bavaria");
    expect(G.units[army.id].kind).toBe("minorArmy");
    expect(G.log.some((entry) => entry.key === "gwManeuverAction" && entry.args?.kind === "rail")).toBe(true);
  });

  test("a second rail action carries another (or the same) army for a second CP", () => {
    const G = gwState();
    const first = bavarianArmy(G);
    performGwManeuver(G, makeCtx(), {kind: "rail", power: "GE", unitId: first.id, to: "berlin"});
    expect(G.powers.GE.gwBudget).toBe(4);

    const result = performGwManeuver(G, makeCtx(), {
      kind: "rail",
      power: "GE",
      unitId: first.id,
      to: "pomerania",
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.cost).toBe(1);
    expect(G.powers.GE.gwBudget).toBe(3);
    expect(G.units[first.id].space).toBe("pomerania");
  });

  test("the rail destination must stay on the friendly network", () => {
    const G = gwState();
    const army = bavarianArmy(G);

    const result = performGwManeuver(G, makeCtx(), {
      kind: "rail",
      power: "GE",
      unitId: army.id,
      to: "paris",
    });

    expect(result.ok).toBe(false);
    expect(G.units[army.id].space).toBe("bavaria");
    expect(G.powers.GE.gwBudget).toBe(5);
  });

  test("an uncontrolled minor's army is rejected", () => {
    const G = gwState();
    G.spaces.bavaria.ally = null;
    const army = bavarianArmy(G);

    const result = performGwManeuver(G, makeCtx(), {
      kind: "rail",
      power: "GE",
      unitId: army.id,
      to: "berlin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalidUnit");
    expect(G.powers.GE.gwBudget).toBe(5);
    expect(G.units[army.id].space).toBe("bavaria");
  });

  test("a minor controlled by another power is rejected", () => {
    const G = gwState();
    G.spaces.bavaria.ally = "FR";
    const army = bavarianArmy(G);

    const result = performGwManeuver(G, makeCtx(), {
      kind: "rail",
      power: "GE",
      unitId: army.id,
      to: "berlin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalidUnit");
  });

  test("an allied minor's EC/EF is not an army counter and cannot rail", () => {
    const G = gwState();
    const ec = placeUnit(G, "Bavaria", "eliteCorps", "bavaria", 1);

    const result = performGwManeuver(G, makeCtx(), {
      kind: "rail",
      power: "GE",
      unitId: ec.id,
      to: "berlin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalidUnit");
  });

  test("the unit may not be carried during a US/Italian impulse", () => {
    const G = gwState();
    const army = bavarianArmy(G);
    G.flags.gwAllyImpulse = "IT";
    G.gw!.italyBudget = 5;

    const result = performGwManeuver(G, makeCtx(), {
      kind: "rail",
      power: "GE",
      unitId: army.id,
      to: "berlin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("invalidUnit");
    expect(G.flags.gwAllyImpulse).toBe("IT");
  });
});
