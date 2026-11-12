/**
 * Rule 3.4.1 — every path that moves units between the Black Sea and the
 * Eastern Mediterranean asks the Dardanelles controller, not only the live
 * wrappers: direct `performGwManeuver` callers (including joint naval
 * operations, where each contingent needs its own grant) and the free
 * demobilization naval move.
 */

import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {createWarState} from "./engine/limitedWar";
import {navalUnitsIn} from "./engine/rules";
import {performGwManeuver} from "./engine/greatWarFlow";
import {planNavalMove} from "./engine/navalMovement";
import {resolvePending, resolveWar} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "4"): Ctx => {
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

const clearNaval = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
};

const gwState = (overrides: Partial<GreatWarState> = {}): GreatWarState => ({
  active: true,
  turn: 1,
  order: ["RU", "FR", "OT"],
  belligerents: ["RU", "FR"],
  neutrals: ["GE", "UK", "AU", "OT"],
  te: ["RU", "FR"],
  ta: [],
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
});

/** RU active in the GW; the strait is OT-controlled; the Black Sea is empty. */
const straitFixture = (): {G: ImperialElegyState; ship: string} => {
  const G = setupImperialElegy(makeCtx());
  G.gw = gwState();
  G.powers.RU.alliance = "teCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.phase = "gwManeuver";
  G.activePower = "RU";
  G.turnIndex = 0;
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  G.powers.RU.gwBudget = 4;
  G.powers.RU.flags.gwActionsThisImpulse = 0;
  G.powers.RU.flags.passedGw = false;
  G.spaces.dardanelles.control = "OT";
  clearNaval(G, "black-sea");
  clearNaval(G, "eastern-mediterranean");
  const ship = placeUnit(G, "RU", "squadron", "black-sea", 2).id;
  return {G, ship};
};

describe("3.4.1 direct GW maneuver paths", () => {
  test("a direct performGwManeuver crossing raises the controller's decision", () => {
    const {G, ship} = straitFixture();
    const res = performGwManeuver(G, makeCtx(), {
      kind: "naval",
      power: "RU",
      unitIds: [ship],
      to: "eastern-mediterranean",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.pending).toBe(true);
    expect(G.pending?.kind).toBe("dardanellesPassage");
    expect(G.pending?.power).toBe("OT");
    expect(G.pending?.context?.requesting).toBe("RU");
    // Nothing was spent or moved while the controller decides.
    expect(G.powers.RU.gwBudget).toBe(4);
    expect(G.units[ship].space).toBe("black-sea");
    expect(G.log.some((entry) => entry.key === "dardanellesPassageRequested")).toBe(true);

    expect(resolvePending(G, makeCtx([], seat("OT")), "grant")).toBeUndefined();
    expect(G.dardanellesPassage).toMatchObject({requesting: "RU", granting: "OT"});
    const allowed = performGwManeuver(G, makeCtx(), {
      kind: "naval",
      power: "RU",
      unitIds: [ship],
      to: "eastern-mediterranean",
    });
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) throw new Error(allowed.message);
    expect(G.units[ship].space).toBe("eastern-mediterranean");
    expect(G.powers.RU.gwBudget).toBe(3);
  });

  test("a multi-box GW route asks for an intermediate Dardanelles hop", () => {
    const {G} = straitFixture();
    clearNaval(G, "sevastopol");
    const ship = placeUnit(G, "RU", "squadron", "sevastopol", 2).id;
    // Sevastopol (port) -> Black Sea -> Eastern Mediterranean -> Western
    // Mediterranean: the strait is crossed on an intermediate hop.
    expect(planNavalMove(G, "RU", "sevastopol", "western-mediterranean", {ignoreDardanellesGate: true})).toMatchObject({
      ok: true,
      path: ["sevastopol", "black-sea", "eastern-mediterranean", "western-mediterranean"],
    });
    const res = performGwManeuver(G, makeCtx(), {
      kind: "naval",
      power: "RU",
      unitIds: [ship],
      to: "western-mediterranean",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.pending).toBe(true);
    expect(G.pending?.kind).toBe("dardanellesPassage");
    expect(G.pending?.context?.from).toBe("black-sea");
    expect(G.pending?.context?.to).toBe("eastern-mediterranean");
    expect(resolvePending(G, makeCtx([], seat("OT")), "grant")).toBeUndefined();
    const allowed = performGwManeuver(G, makeCtx(), {
      kind: "naval",
      power: "RU",
      unitIds: [ship],
      to: "western-mediterranean",
    });
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) throw new Error(allowed.message);
    expect(G.units[ship].space).toBe("western-mediterranean");
    expect(G.powers.RU.gwBudget).toBe(3);
  });

  test("a joint naval crossing asks each contingent's power in turn", () => {
    const {G, ship} = straitFixture();
    const ally = placeUnit(G, "FR", "squadron", "black-sea", 2).id;
    const request = {
      kind: "jointNaval" as const,
      power: "RU" as const,
      ally: "FR" as const,
      unitIds: [ship],
      allyUnitIds: [ally],
      to: "eastern-mediterranean" as const,
    };
    // RU's grant first.
    expect(performGwManeuver(G, makeCtx(), request).ok).toBe(false);
    expect(G.pending?.kind).toBe("dardanellesPassage");
    expect(G.pending?.context?.requesting).toBe("RU");
    expect(resolvePending(G, makeCtx([], seat("OT")), "grant")).toBeUndefined();
    // France still needs its own permission.
    expect(performGwManeuver(G, makeCtx(), request).ok).toBe(false);
    expect(G.pending?.kind).toBe("dardanellesPassage");
    expect(G.pending?.context?.requesting).toBe("FR");
    expect(G.powers.RU.gwBudget).toBe(4);
    expect(resolvePending(G, makeCtx([], seat("OT")), "grant")).toBeUndefined();
    // Both grants coexist for the same turn.
    expect(G.dardanellesPassages?.map((entry) => entry.requesting).sort()).toEqual(["FR", "RU"]);

    const allowed = performGwManeuver(G, makeCtx(), request);
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) throw new Error(allowed.message);
    expect(G.units[ship].space).toBe("eastern-mediterranean");
    expect(G.units[ally].space).toBe("eastern-mediterranean");
    expect(G.powers.RU.gwBudget).toBe(3);
  });
});

describe("3.4.1 free demobilization naval move", () => {
  test("the free naval move prompts for the strait and resumes the free-action chain", () => {
    const G = setupImperialElegy(makeCtx());
    const ctx = makeCtx([], "4");
    G.phase = "action";
    G.activePower = "RU";
    G.cpRemaining = 0;
    G.pending = null;
    G.pendingStack = [];
    G.battle = null;
    G.spaces.dardanelles.control = "OT";
    G.spaces.bohemia.occupiedBy = "RU";
    G.spaces.vienna.occupiedBy = "RU";
    clearNaval(G, "black-sea");
    clearNaval(G, "eastern-mediterranean");
    const ship = placeUnit(G, "RU", "squadron", "black-sea", 2).id;

    // RU wins a major victory over AU: the winner side receives the 17.0 free
    // redeployment / naval movement actions.
    G.war = createWarState(G, "RU", "AU", "conquest", ["bohemia"], 2);
    expect(resolveWar(G, ctx, [])).toBeUndefined();
    expect(G.war).toBeNull();
    expect(G.pending?.kind).toBe("demobilizationFreeAction");
    const navalOption = G.pending!.options.find((option) => option.data?.unitId === ship);
    expect(navalOption).toBeDefined();
    expect(navalOption!.data?.action).toBe("naval");

    // The blocked strait destination is offered with an explicit "needs
    // permission" marker rather than hidden.
    expect(resolvePending(G, ctx, navalOption!.id)).toBeUndefined();
    expect(G.pending?.kind).toBe("movementDestination");
    const gated = G.pending!.options.find((option) => option.id === "eastern-mediterranean");
    expect(gated?.data?.requiresDardanelles).toBe(true);
    expect(String(gated?.label)).toContain("Dardanelles");

    // Choosing it raises the controller's decision (nothing spent or moved).
    expect(resolvePending(G, ctx, "eastern-mediterranean")).toBeUndefined();
    expect(G.pending?.kind).toBe("dardanellesPassage");
    expect(G.pending?.power).toBe("OT");
    expect(G.pending?.context?.requesting).toBe("RU");
    expect(G.units[ship].space).toBe("black-sea");

    expect(resolvePending(G, makeCtx([], seat("OT")), "grant")).toBeUndefined();
    // The free-action chooser is reopened for the mover.
    expect(G.pending?.kind).toBe("demobilizationFreeAction");
    expect(G.pending?.power).toBe("RU");

    const again = G.pending!.options.find((option) => option.data?.unitId === ship)!;
    expect(resolvePending(G, ctx, again.id)).toBeUndefined();
    expect(G.pending?.kind).toBe("movementDestination");
    const plain = G.pending!.options.find((option) => option.id === "eastern-mediterranean")!;
    expect(plain.data?.requiresDardanelles).toBeUndefined();
    expect(resolvePending(G, ctx, "eastern-mediterranean")).toBeUndefined();
    expect(G.units[ship].space).toBe("eastern-mediterranean");
    expect(G.cpRemaining).toBe(0);
  });
});
