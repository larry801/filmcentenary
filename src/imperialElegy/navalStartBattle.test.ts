/**
 * 15.1 Special Naval Actions:
 *
 *   "At the start of the maneuver step, if opposing units occupy a naval box a
 *   naval battle is immediately fought (players are still allowed to attempt
 *   to avoid battle)."
 *
 * The rule is a start-of-step sweep, not an action: nobody spends CP, the
 * higher-initiative side is the attacker, and the defender still gets 19.2's
 * avoidance attempt.  Contested boxes resolve one at a time so decisions never
 * stack.
 */

import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {navalUnitsIn} from "./engine/rules";
import {beginNavalStartBattles, navalStartContacts} from "./engine/combat";
import {startGwManeuver} from "./engine/greatWarFlow";
import {declareWar, resolvePending, startWarManeuver} from "./moves";

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

const seat = (power: Power): string => String(["GE", "UK", "FR", "AU", "RU", "OT"].indexOf(power));

const baseGw = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.gw = {
    active: true,
    turn: 1,
    order: ["GE", "FR", "RU"],
    belligerents: ["GE", "FR", "RU"],
    neutrals: ["UK", "AU", "OT"],
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
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.powers.RU.alliance = "teCommitted";
  G.phase = "gwPlanning";
  G.pending = null;
  G.battle = null;
  return G;
};

const clearNaval = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
};

/** A planning-step state with the Baltic and the Western Med emptied. */
const planning = (overrides: Partial<GreatWarState> = {}): ImperialElegyState => {
  const G = baseGw(overrides);
  for (const space of ["baltic-sea", "western-mediterranean", "north-atlantic"]) clearNaval(G, space);
  G.powers.GE.gwBudget = 6;
  G.powers.GE.flags.gwActionsThisImpulse = 0;
  G.powers.GE.flags.passedGw = false;
  return G;
};

describe("15.1 start-of-maneuver naval battles", () => {
  test("opposing fleets in a box form a contact, higher initiative attacking", () => {
    const G = planning();
    placeUnit(G, "GE", "squadron", "baltic-sea", 2);
    placeUnit(G, "FR", "squadron", "baltic-sea", 2);

    const contacts = navalStartContacts(G, ["GE", "FR", "RU"]);
    expect(contacts).toEqual([{box: "baltic-sea", attacker: "GE", defender: "FR"}]);
    // Initiative decides the attacker, not the ships' arrival order.
    expect(navalStartContacts(G, ["FR", "GE", "RU"])).toEqual([
      {box: "baltic-sea", attacker: "FR", defender: "GE"},
    ]);
  });

  test("allied or same-side fleets sharing a box are not a contact", () => {
    const G = planning({te: ["GE", "FR"], ta: ["RU"], belligerents: ["GE", "FR", "RU"]});
    placeUnit(G, "GE", "squadron", "baltic-sea", 2);
    placeUnit(G, "FR", "squadron", "baltic-sea", 2);
    expect(navalStartContacts(G, ["GE", "FR", "RU"])).toEqual([]);

    // A lone fleet is not a contact either.
    removeUnit(G, navalUnitsIn(G, "baltic-sea").find((unit) => unit.owner === "FR")!.id);
    expect(navalStartContacts(G, ["GE", "FR", "RU"])).toEqual([]);
  });

  test("a controlled minor's squadron fights for its controller's side", () => {
    const G = planning();
    placeUnit(G, "GE", "squadron", "baltic-sea", 2);
    placeUnit(G, "Greece", "squadron", "baltic-sea", 2);
    G.spaces.greece.control = "Greece";
    G.spaces.greece.ally = "FR";

    expect(navalStartContacts(G, ["GE", "FR", "RU"])).toEqual([
      {box: "baltic-sea", attacker: "GE", defender: "FR"},
    ]);
  });

  test("starting the GW maneuver fights immediately and offers 19.2 avoidance", () => {
    const G = planning();
    placeUnit(G, "GE", "squadron", "baltic-sea", 2);
    placeUnit(G, "FR", "squadron", "baltic-sea", 2);

    const res = startGwManeuver(G, makeCtx());
    expect(res.ok).toBe(true);
    expect(G.phase).toBe("gwManeuver");
    // 15.1 charges no CP: nobody took an action.
    expect(G.powers.GE.gwBudget).toBe(6);
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(G.pending?.power).toBe("FR");
    expect(G.log.some((entry) => entry.key === "navalStartBattle" && entry.args?.box === "baltic-sea")).toBe(true);
  });

  test("a quiet board starts no battle and leaves no queue behind", () => {
    const G = planning();
    placeUnit(G, "GE", "squadron", "baltic-sea", 2);
    placeUnit(G, "FR", "squadron", "western-mediterranean", 2);

    expect(startGwManeuver(G, makeCtx()).ok).toBe(true);
    expect(G.pending).toBeNull();
    expect(G.battle).toBeNull();
    expect(G.flags.navalStartQueue).toBe("");
  });

  test("contested boxes resolve one at a time, in box order", () => {
    const G = planning({te: ["FR", "RU"], ta: ["GE"]});
    placeUnit(G, "GE", "squadron", "baltic-sea", 2);
    placeUnit(G, "FR", "squadron", "baltic-sea", 2);
    placeUnit(G, "GE", "squadron", "western-mediterranean", 2);
    placeUnit(G, "RU", "squadron", "western-mediterranean", 2);

    expect(startGwManeuver(G, makeCtx()).ok).toBe(true);
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(G.pending?.power).toBe("FR");
    expect(G.flags.navalStartQueue).toBe("western-mediterranean:GE:RU");

    // Fight the Baltic battle; the battle auto-resolves without combat cards and
    // the queue moves straight on to the second box.
    expect(resolvePending(G, makeCtx([], seat("FR")), "fight")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(G.pending?.power).toBe("RU");
    expect(G.flags.navalStartQueue).toBe("");
  });

  test("a limited war's maneuver start fights the same immediate battle", () => {
    // The campaign setup puts GE and FR squadrons in the Baltic-adjacent ports;
    // move one of each into the box so the war opens with a contact.
    const G = planning();
    G.gw = null;
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 4;
    G.war = null;
    G.pending = null;
    G.battle = null;
    placeUnit(G, "GE", "squadron", "baltic-sea", 2);
    placeUnit(G, "FR", "squadron", "baltic-sea", 2);

    expect(declareWar(G, makeCtx([], seat("GE")), "FR", "conquest", ["alsace-lorraine"], 2)).toBeUndefined();
    expect(startWarManeuver(G, makeCtx([], seat("GE")))).toBeUndefined();
    expect(G.war!.status).toBe("maneuver");
    expect(G.pending?.kind).toBe("navalAvoid");
    // 15.1 is a step-start sweep, not an action: no CP was spent on it.
    expect(G.war!.budgets.GE).toBe(2 + G.powers.GE.industry);
    expect(G.log.some((entry) => entry.key === "navalStartBattle" && entry.args?.box === "baltic-sea")).toBe(true);
  });

  test("a queued box whose fleets parted is skipped, not force-fought", () => {
    const G = planning({te: ["FR", "RU"], ta: ["GE"]});
    placeUnit(G, "GE", "squadron", "baltic-sea", 2);
    placeUnit(G, "FR", "squadron", "baltic-sea", 2);
    const ru = placeUnit(G, "RU", "squadron", "western-mediterranean", 2);
    placeUnit(G, "GE", "squadron", "western-mediterranean", 2);

    expect(beginNavalStartBattles(G, makeCtx(), ["GE", "FR", "RU"])).toBe("baltic-sea");
    expect(G.pending?.kind).toBe("navalAvoid");

    // The second contact's fleets no longer share the box when its turn comes.
    removeUnit(G, ru.id);
    expect(resolvePending(G, makeCtx([], seat("FR")), "fight")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.flags.navalStartQueue).toBe("");
  });
});
