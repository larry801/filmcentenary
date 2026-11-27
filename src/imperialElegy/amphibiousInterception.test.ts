import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {landUnitsIn, navalUnitsIn} from "./engine/rules";
import {amphibiousAssault, amphibiousAssaultCheck, navalIntercept, navalMove} from "./moves";
import {beginGwImpulse, currentGwImpulse} from "./engine/gwImpulse";

const makeCtx = (dice: number[] = [], playerID: string | null = "1"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {
      Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3,
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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const warState = (attacker: Power, defender: Power): WarState => ({
  attacker,
  defender,
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: [],
  warAim: "conquest",
  objectives: [],
  status: "maneuver",
  budgets: {},
  initiative: [],
  treaties: [],
  victor: null,
  truceTurns: 2,
  passed: [],
  startedTurn: 1,
} as unknown as WarState);

/** UK (seat 1) vs FR (seat 2) at war, UK active with CP, North Atlantic stage. */
const navalWar = (): ImperialElegyState => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "UK";
  G.passed = [];
  G.pending = null;
  G.battle = null;
  G.cpRemaining = 6;
  G.war = warState("UK", "FR");
  for (const unit of [...landUnitsIn(G, "north-atlantic")]) removeUnit(G, unit.id);
  for (const unit of [...navalUnitsIn(G, "north-atlantic")]) removeUnit(G, unit.id);
  for (const unit of [...landUnitsIn(G, "brittany")]) removeUnit(G, unit.id);
  for (const unit of [...navalUnitsIn(G, "brittany")]) removeUnit(G, unit.id);
  return G;
};

// ---------------------------------------------------------------------------
// 19.10 amphibious assault
// ---------------------------------------------------------------------------

describe("19.10 amphibious assault", () => {
  test("an undefended enemy port is occupied by up to two armies", () => {
    const G = navalWar();
    const ids = [placeUnit(G, "UK", "army", "north-atlantic", 2).id, placeUnit(G, "UK", "army", "north-atlantic", 2).id];
    const ctx = makeCtx([], "1");
    expect(amphibiousAssault(G, ctx, "north-atlantic", "brittany", ids)).toBeUndefined();
    expect(landUnitsIn(G, "brittany").filter((u) => u.owner === "UK")).toHaveLength(2);
    expect(G.spaces.brittany.occupiedBy).toBe("UK");
    expect(G.battle).toBeNull();
  });

  test("a defended port fights a land battle with the amphibious modifier", () => {
    const G = navalWar();
    placeUnit(G, "FR", "army", "brittany", 2);
    const id = placeUnit(G, "UK", "army", "north-atlantic", 2).id;
    const ctx = makeCtx([], "1");
    expect(amphibiousAssault(G, ctx, "north-atlantic", "brittany", [id])).toBeUndefined();
    expect(G.battle?.kind).toBe("land");
    expect(G.battle?.amphibious).toBe(true);
    expect(G.battle?.attackerDrm).toBe(-1);
    expect(G.battle?.from).toBe("north-atlantic");
    expect(G.battle?.to).toBe("brittany");
  });

  test("at most two armies may assault; the origin must be an adjacent box or loading port", () => {
    const G = navalWar();
    const ids = [0, 1, 2].map(() => placeUnit(G, "UK", "army", "north-atlantic", 2).id);
    const ctx = makeCtx([], "1");
    expect(amphibiousAssault(G, ctx, "north-atlantic", "brittany", ids)).toBe(INVALID_MOVE);
    expect(amphibiousAssault(G, ctx, "south-atlantic", "brittany", ids.slice(0, 2))).toBe(INVALID_MOVE);
  });

  test("a port with enemy naval units needs a 2:1 escort", () => {
    const G = navalWar();
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const army = placeUnit(G, "UK", "army", "north-atlantic", 2).id;
    const ctx = makeCtx([], "1");
    // One UK ship is not enough.
    placeUnit(G, "UK", "squadron", "north-atlantic", 2);
    expect(amphibiousAssault(G, ctx, "north-atlantic", "brittany", [army])).toBe(INVALID_MOVE);
    // Two UK ships against one FR ship is enough.  19.10/19.11: the armies
    // land first and displace the port fleet, which then fights as the
    // attacker of the follow-up naval battle.
    placeUnit(G, "UK", "squadron", "north-atlantic", 2);
    expect(amphibiousAssault(G, ctx, "north-atlantic", "brittany", [army])).toBeUndefined();
    expect(G.units[army].space).toBe("brittany");
    expect(navalUnitsIn(G, "brittany")).toHaveLength(0);
    expect(G.pending?.kind).toBe("navalInterception");
  });

  test("a friendly port cannot be assaulted", () => {
    const G = navalWar();
    const army = placeUnit(G, "UK", "army", "north-atlantic", 2).id;
    const ctx = makeCtx([], "1");
    // London is a UK port.
    expect(amphibiousAssault(G, ctx, "north-atlantic", "london", [army])).toBe(INVALID_MOVE);
  });
});

// ---------------------------------------------------------------------------
// 19.1 naval interception
// ---------------------------------------------------------------------------

describe("19.1 naval interception", () => {
  const stageMove = (G: ImperialElegyState, ctx: Ctx): string => {
    const ship = navalUnitsIn(G, "london").find((unit) => unit.owner === "UK")!;
    expect(navalMove(G, ctx, [ship.id], "north-atlantic")).toBeUndefined();
    return ship.id;
  };

  test("a successful interception starts a battle with the active player as attacker", () => {
    const G = navalWar();
    const ctx = makeCtx([5], "1");
    const moved = stageMove(G, ctx);
    placeUnit(G, "FR", "squadron", "brittany", 2);
    const frCtx = makeCtx([5], "2");
    expect(navalIntercept(G, frCtx, "brittany", "north-atlantic")).toBeUndefined();
    expect(G.battle?.kind).toBe("naval");
    expect(G.battle?.attacker).toBe("UK");
    expect(G.battle?.to).toBe("north-atlantic");
    expect(G.battle?.mainAttack).toContain(moved);
    expect(G.battle?.mainDefense.some((id) => G.units[id]?.owner === "FR")).toBe(true);
  });

  test("a failed interception roll changes nothing", () => {
    const G = navalWar();
    const ctx = makeCtx([1], "1");
    stageMove(G, ctx);
    placeUnit(G, "FR", "squadron", "brittany", 2);
    expect(navalIntercept(G, makeCtx([1], "2"), "brittany", "north-atlantic")).toBeUndefined();
    expect(G.battle).toBeNull();
    const last = G.log[G.log.length - 1];
    expect(last.key).toBe("navalInterception");
    expect(last.args?.success).toBe(false);
  });

  test("interception requires a preceding naval move into the box", () => {
    const G = navalWar();
    placeUnit(G, "FR", "squadron", "brittany", 2);
    // No naval move happened, so the defender cannot intercept a stale state.
    expect(navalIntercept(G, makeCtx([6], "2"), "brittany", "north-atlantic")).toBe(INVALID_MOVE);
  });

  test("the interceptor must control the port and be at war with the mover", () => {
    const G = navalWar();
    const ctx = makeCtx([5], "1");
    stageMove(G, ctx);
    // Germany owns no port adjacent to the box and is not at war with the UK.
    placeUnit(G, "FR", "squadron", "brittany", 2);
    expect(navalIntercept(G, makeCtx([6], "0"), "brittany", "north-atlantic")).toBe(INVALID_MOVE);
  });
});

// ---------------------------------------------------------------------------
// 27.5 — amphibious assault as a Great War naval action
// ---------------------------------------------------------------------------

describe("27.5 Great War amphibious assault", () => {
  const gwUk = (): ImperialElegyState => {
    const G = setupImperialElegy(makeCtx(), {scenario: "gwTutorial"});
    G.phase = "gwManeuver";
    G.pending = null;
    G.battle = null;
    G.gw!.active = true;
    G.gw!.turn = 1;
    G.gw!.neutralImpulses = 0;
    G.gw!.belligerents = ["GE", "AU", "FR", "UK", "RU"];
    G.activePower = "UK";
    G.turnIndex = 5;
    beginGwImpulse(G, "UK");
    G.powers.UK.gwBudget = 5;
    for (const unit of [...landUnitsIn(G, "north-atlantic")]) removeUnit(G, unit.id);
    for (const unit of [...navalUnitsIn(G, "north-atlantic")]) removeUnit(G, unit.id);
    for (const unit of [...landUnitsIn(G, "hanover")]) removeUnit(G, unit.id);
    for (const unit of [...navalUnitsIn(G, "hanover")]) removeUnit(G, unit.id);
    return G;
  };

  test("an assault is legal in the GW maneuver and spends one war-budget CP", () => {
    const G = gwUk();
    const id = placeUnit(G, "UK", "army", "north-atlantic", 2).id;
    const check = amphibiousAssaultCheck(G, "UK", "north-atlantic", "hanover", [id]);
    expect(check.reason).toBeUndefined();
    expect(check.ok).toBe(true);
    expect(amphibiousAssault(G, makeCtx([], "1"), "north-atlantic", "hanover", [id])).toBeUndefined();
    expect(G.powers.UK.gwBudget).toBe(4);
    expect(currentGwImpulse(G, "UK").acted).toBe(true);
  });

  test("27.1: a second assault in the same impulse is refused", () => {
    const G = gwUk();
    const first = placeUnit(G, "UK", "army", "north-atlantic", 2).id;
    const second = placeUnit(G, "UK", "army", "north-atlantic", 2).id;
    expect(amphibiousAssault(G, makeCtx([], "1"), "north-atlantic", "hanover", [first])).toBeUndefined();
    placeUnit(G, "UK", "army", "north-atlantic", 2);
    expect(amphibiousAssault(G, makeCtx([], "1"), "north-atlantic", "hanover", [second])).toBe(INVALID_MOVE);
  });

  test("the Historical Great War's UK restriction now applies to a held German port", () => {
    const G = gwUk();
    // p. 7: "The UK cannot amphibiously assault GE home spaces containing a GE
    // naval unit(s)."  Hanover is a German home port in this scenario.
    placeUnit(G, "GE", "squadron", "hanover", 2);
    const id = placeUnit(G, "UK", "army", "north-atlantic", 2).id;
    // Enough escorts to clear the 19.10 2:1 rule, so only the scenario clause
    // can refuse the assault.
    for (let i = 0; i < 8; i++) placeUnit(G, "UK", "squadron", "north-atlantic", 2);
    const check = amphibiousAssaultCheck(G, "UK", "north-atlantic", "hanover", [id]);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe("scenario-german-port");
    expect(amphibiousAssault(G, makeCtx([], "1"), "north-atlantic", "hanover", [id])).toBe(INVALID_MOVE);
  });
});
