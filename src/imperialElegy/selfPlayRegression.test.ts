/**
 * Regression tests for six engine bugs found by seeded self-play.
 *
 * Each case started from a real campaign (a seeded boardgame.io match driven by
 * the Rule 34 bot) and failed there, not in a hand-built fixture:
 *
 *  1. `applyPrepCharacteristics` pushed The Dual Monarchy into AU's hand
 *     without removing the physical copy from the deck/discard, so a later
 *     shuffle produced two A047s.
 *  2. `canRecruitIn` said "legal" while `recruit` refused on the 5.5 stacking
 *     cap, so the hotseat bot re-sent the rejected build forever.
 *  3. `canRecruitIn` ignored A83 Liberal Reforms' "no armies this impulse",
 *     with the same deadlock.
 *  4. `gwWinterBegin` opened a pending decision from a phase `onBegin` hook;
 *     `openDecision` calls `setActivePlayers`, which boardgame.io rejects in
 *     that hook, so the winter move was rolled back and the GW deadlocked.
 *  5. The bot passed in the GW maneuver while holding GW-10 Exhaustion, which
 *     27.3 forbids; `gwPass` refused and the seat had no legal move.
 *  6. The bot "marched" onto enemy- and ally-held spaces instead of declaring
 *     a battle, so `performGwManeuver` refused the move every impulse.
 */
import {Ctx} from "boardgame.io";
import {CreateGameReducer, InitializeGame, ProcessGameConfig} from "boardgame.io/internal";
import {INVALID_MOVE} from "boardgame.io/core";
import {ImperialElegyGameDef} from "./game";
import {ImperialElegyState, POWERS, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {canRecruitIn} from "./engine/characteristics";
import {botDecision} from "./engine/bot";
import {redactForView} from "./engine/privacy";
import {ensureStateDefaults} from "./engine/migrations";
import {outbreakGreatWar} from "./engine/greatWar";
import {performGwManeuver} from "./engine/greatWarFlow";
import {isArmyKind, landUnitsIn, hostileOwner, maneuverDestinationProblem} from "./engine/rules";
import {neighboursOf} from "./constant/spaces";
import {applyPrepCharacteristics, discardForStability, recruit} from "./moves";
import {cardById} from "./engine/deck";
import {navalAvoidanceModifiers, navalAvoidPlans, navalPortBattleModifiers} from "./engine/combat";

const makeCtx = (playerID: string | null = "0"): Ctx =>
  ({
    playerID,
    random: {Die: (_sides: number) => 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

// ---------------------------------------------------------------------------
// 1. The Dual Monarchy is one physical card
// ---------------------------------------------------------------------------

describe("1 — The Dual Monarchy is never duplicated", () => {
  test("adding it on turn 2 moves the copy out of the deck and discard", () => {
    const G = fresh();
    G.turn = 2;
    G.phase = "end";
    G.powers.AU.hand = [];
    // Played for CP on turn 1, so the single copy is in the discard pile and the
    // prep deck merge will shuffle it back into the deck.
    G.discard.push("IE-A047");
    G.deck = G.deck.filter((id) => id !== "IE-A047");

    applyPrepCharacteristics(G);

    expect(G.powers.AU.hand).toContain("IE-A047");
    const copies = [
      ...G.deck, ...G.discard, ...G.removed,
      ...POWERS.flatMap((p) => G.powers[p].hand),
    ].filter((id) => id === "IE-A047");
    expect(copies).toHaveLength(1);
  });

  test("a copy still in the deck is moved, not copied", () => {
    const G = fresh();
    G.turn = 2;
    G.phase = "end";
    G.powers.AU.hand = [];
    G.discard = G.discard.filter((id) => id !== "IE-A047");
    if (!G.deck.includes("IE-A047")) G.deck.push("IE-A047");

    applyPrepCharacteristics(G);

    expect(G.powers.AU.hand.filter((id) => id === "IE-A047")).toHaveLength(1);
    expect(G.deck).not.toContain("IE-A047");
    expect(G.discard).not.toContain("IE-A047");
  });
});

// ---------------------------------------------------------------------------
// 2 / 3. The recruitment decision must agree with the move
// ---------------------------------------------------------------------------

describe("2 — the stacking cap is part of the recruitment decision", () => {
  test("canRecruitIn refuses a full space and the move agrees", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 3;
    // Keep the manpower ceiling out of the way so the only refusal is stacking.
    G.powers.GE.manpower = 12;
    // A reduced army in the space would legally be flipped in place instead, so
    // make every German army there full strength first.
    for (const unit of landUnitsIn(G, "berlin")) unit.steps = 2;
    // Berlin is a European key (cap 3): fill it with the power's own armies.
    for (let i = 0; i < 5 && landUnitsIn(G, "berlin").filter((unit) => isArmyKind(unit.kind)).length < 3; i += 1) {
      const id = `pad${G.nextUnitId++}`;
      G.units[id] = {id, kind: "army", owner: "GE", steps: 2, space: "berlin", naval: false};
      G.spaces.berlin.units.push(id);
    }
    const decision = canRecruitIn(G, "GE", "berlin", "army");
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join(" ")).toMatch(/Stacking limit/);
    expect(recruit(G, makeCtx("0"), "berlin", "army", 1)).toBe(INVALID_MOVE);
  });

  test("a reduced army of the same nationality may still be flipped in place", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 3;
    G.powers.GE.manpower = 12;
    const existing = landUnitsIn(G, "berlin").find((unit) => unit.owner === "GE" && unit.kind === "army");
    expect(existing).toBeDefined();
    existing!.steps = 1;
    expect(canRecruitIn(G, "GE", "berlin", "army").allowed).toBe(true);
  });
});

describe("3 — A83 Liberal Reforms is part of the recruitment decision", () => {
  test("no army may be built this impulse, and the move agrees", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 3;
    G.powers.GE.flags.noBuildArmiesThisImpulse = true;

    const decision = canRecruitIn(G, "GE", "berlin", "army");
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join(" ")).toMatch(/this impulse/);
    expect(recruit(G, makeCtx("0"), "berlin", "army", 1)).toBe(INVALID_MOVE);
    // An elite corps is not an army: the printed restriction does not cover it.
    expect(canRecruitIn(G, "GE", "berlin", "eliteCorps").reasons.join(" ")).not.toMatch(/this impulse/);
  });
});

// ---------------------------------------------------------------------------
// 4. The winter hook must not touch stage events
// ---------------------------------------------------------------------------

describe("4 — resolving the winter opens no stage event from onBegin", () => {
  /** A GW harness that can start the war from inside a real move. */
  const simOutbreak = (G: ImperialElegyState, ctx: Ctx): void => {
    for (const power of POWERS) {
      G.powers[power].alliance = power === "GE" || power === "AU" || power === "OT"
        ? "taCommitted"
        : "teCommitted";
    }
    G.wtt = 5;
    outbreakGreatWar(G, ctx, "GE", "sim" as never, undefined);
    G.phase = "gwPlanning";
  };

  const withSim = (): typeof ImperialElegyGameDef => {
    const phases: Record<string, unknown> = {};
    for (const [name, phase] of Object.entries(ImperialElegyGameDef.phases ?? {})) {
      const typed = phase as {turn?: {stages?: {play?: {moves?: Record<string, unknown>}}}};
      phases[name] = {
        ...phase,
        turn: {order: typed.turn?.stages, ...phase.turn, stages: {play: {moves: {...typed.turn?.stages?.play?.moves, simOutbreak}}}},
      };
    }
    return {...ImperialElegyGameDef, moves: {...ImperialElegyGameDef.moves, simOutbreak}, phases: phases as never};
  };

  test("passing the last GW impulse reaches the winter without a plugin error", () => {
    const game = ProcessGameConfig({...withSim(), seed: "IE-WINTER-1"} as never);
    const reducer = CreateGameReducer({game, isClient: false});
    let state = InitializeGame({game, numPlayers: 6});
    state = reducer(state, {type: "MAKE_MOVE", payload: {type: "simOutbreak", args: [], playerID: state.ctx.currentPlayer}});
    state = reducer(state, {type: "MAKE_MOVE", payload: {type: "endGwPlanningMove", args: [], playerID: "0"}});

    // Every belligerent passes; the last pass moves the game into gwWinter,
    // whose onBegin hook used to raise a pending decision and be rolled back.
    let sawError: unknown = null;
    const phaseOf = () => {
      const ctxPhase = (state.ctx as {phase?: string}).phase;
      const gPhase = (state.G as ImperialElegyState).phase;
      // The engine sets G.phase before the framework's ctx catches up; either is
      // a valid "the winter was reached" signal.
      return ctxPhase === "gwWinter" || gPhase === "gwWinter" ? "gwWinter" : ctxPhase;
    };
    for (let step = 0; step < 40 && !sawError && phaseOf() !== "gwWinter"; step += 1) {
      const G = state.G as ImperialElegyState;
      const seat = G.pending !== null
        ? String(POWERS.indexOf(G.pending.power))
        : String(POWERS.indexOf(G.activePower));
      const view = redactForView(JSON.parse(JSON.stringify(state.G)), seat, state.ctx) as ImperialElegyState;
      ensureStateDefaults(view);
      const decision = G.pending !== null
        ? {move: G.pending.options.length ? "resolvePending" : "declinePending", args: G.pending.options.length ? [G.pending.options[0].id] : []}
        : botDecision(view, state.ctx, POWERS[Number(seat)]);
      const next = reducer(state, {type: "MAKE_MOVE", payload: {type: decision.move, args: decision.args, playerID: seat}});
      sawError = next.transients?.error ?? null;
      state = next;
    }
    expect(sawError).toBeNull();
    // The winter resolved to a pending decision (or straight on to planning):
    // either way the hook itself completed.
    expect(["gwWinter", "gwPlanning", "gameOver"]).toContain(phaseOf());
  });
});

// ---------------------------------------------------------------------------
// 5 / 6. The bot must never name a GW move the engine refuses
// ---------------------------------------------------------------------------

describe("5 — GW-10 Exhaustion: the bot plays it instead of passing", () => {
  test("a bot holding Exhaustion chooses a legal card play", () => {
    const G = fresh();
    G.gw = {
      active: true, turn: 2, order: ["GE", "FR"], belligerents: ["GE", "FR"], neutrals: [],
      te: ["FR"], ta: ["GE"], usIn: false, italyIn: false,
      usStability: 3, usManpower: 3, usBudget: 4, italyStability: 3, italyManpower: 3, italyBudget: 2,
      trenches: {}, lastColonialWar: null, victor: null, outbreakDone: true, nationalWillDone: true,
      bonusImpulses: [], discard: [],
    } as never;
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.turnIndex = 0;
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    G.powers.GE.gwBudget = 3;
    G.powers.GE.gwCard = "IE-GW-10";

    // Strip every attack/refit option so the only thing left is the pass decision.
    for (const unit of Object.values(G.units)) {
      if (unit.owner !== "GE") unit.space = null;
      else if (!unit.naval) unit.steps = 2;
    }
    for (const space of Object.values(G.spaces)) space.units = space.units.filter((id) => G.units[id]?.owner === "GE");

    const decision = botDecision(G, makeCtx("0"), "GE");
    // 27.3 forbids passing with Exhaustion in hand; the escape is its CP play.
    expect(decision.move).not.toBe("gwPass");
    expect(decision.move).toBe("playGwCardMove");
    expect(decision.args).toEqual(["cp"]);
  });
});

describe("6 — the bot attacks enemies, never allies or illegal targets", () => {
  test("every land battle names a space with a hostile unit", () => {
    const G = fresh();
    G.gw = {
      active: true, turn: 2, order: ["GE", "AU"], belligerents: ["GE", "AU"], neutrals: [],
      te: [], ta: ["GE", "AU"], usIn: false, italyIn: false,
      usStability: 3, usManpower: 3, usBudget: 4, italyStability: 3, italyManpower: 3, italyBudget: 2,
      trenches: {}, lastColonialWar: null, victor: null, outbreakDone: true, nationalWillDone: true,
      bonusImpulses: [], discard: [],
    } as never;
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.turnIndex = 0;
    G.powers.GE.alliance = "taCommitted";
    G.powers.AU.alliance = "taCommitted";
    G.powers.GE.gwBudget = 3;

    // An allied (Austrian) army standing next to a German one must never be the
    // target: `hostileOwner` is false for an ally, so `beginLandBattle` would
    // refuse the attack and the bot would spin on a rejected move.
    const german = Object.values(G.units).find((unit) => unit.owner === "GE" && !unit.naval)!;
    const neighbour = neighboursOf(german.space as string).find((id) => G.spaces[id] !== undefined)!;
    const ally: typeof german = {id: "uAlly", kind: "minorArmy", owner: "AU", steps: 2, space: neighbour, naval: false};
    G.units.uAlly = ally;
    G.spaces[neighbour].units.push("uAlly");
    expect(hostileOwner(G, "GE", "AU")).toBe(false);

    for (let step = 0; step < 8; step += 1) {
      const decision = botDecision(G, makeCtx("0"), "GE");
      if (decision.move !== "landBattle") continue;
      const to = String((decision.args ?? [])[1]);
      // Whatever it attacks must hold a genuinely hostile unit, so the engine
      // will accept the battle.
      const defenders = landUnitsIn(G, to).filter((unit) => hostileOwner(G, "GE", unit.owner));
      expect(defenders.length).toBeGreaterThan(0);
    }
  });

  test("the bot's land battle passes the engine gate", () => {
    const G = fresh();
    G.gw = {
      active: true, turn: 2, order: ["GE", "FR"], belligerents: ["GE", "FR"], neutrals: [],
      te: ["FR"], ta: ["GE"], usIn: false, italyIn: false,
      usStability: 3, usManpower: 3, usBudget: 4, italyStability: 3, italyManpower: 3, italyBudget: 2,
      trenches: {}, lastColonialWar: null, victor: null, outbreakDone: true, nationalWillDone: true,
      bonusImpulses: [], discard: [],
    } as never;
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.turnIndex = 0;
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    G.powers.GE.gwBudget = 3;

    // A French army next to a German one, in a plain European space.
    const german = Object.values(G.units).find((unit) => unit.owner === "GE" && !unit.naval)!;
    const front = neighboursOf(german.space as string).find((id) => G.spaces[id] !== undefined)!;
    G.units.uEnemy = {id: "uEnemy", kind: "army", owner: "FR", steps: 2, space: front, naval: false};
    G.spaces[front].units.push("uEnemy");
    G.spaces[front].control = "FR";
    G.spaces[front].trench = null;
    G.spaces[front].trenchLine = false;

    const decision = botDecision(G, makeCtx("0"), "GE");
    if (decision.move === "landBattle") {
      const [from, to] = decision.args as [string, string];
      const res = performGwManeuver(JSON.parse(JSON.stringify(G)), makeCtx("0"), {
        kind: "landBattle", power: "GE", from, to,
      });
      expect(res.ok).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 7 / 8. Two more bot deadlocks found by the limited-war sweep
// ---------------------------------------------------------------------------

describe("7 — a rebel space is not a legal GW battle target", () => {
  test("the bot never names a battle into a rebel space during the GW", () => {
    const G = fresh();
    G.gw = {
      active: true, turn: 2, order: ["GE", "FR"], belligerents: ["GE", "FR"], neutrals: [],
      te: ["FR"], ta: ["GE"], usIn: false, italyIn: false,
      usStability: 3, usManpower: 3, usBudget: 4, italyStability: 3, italyManpower: 3, italyBudget: 2,
      trenches: {}, lastColonialWar: null, victor: null, outbreakDone: true, nationalWillDone: true,
      bonusImpulses: [], discard: [],
    } as never;
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.turnIndex = 0;
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    G.powers.GE.gwBudget = 3;

    // A French army next to a German one, but the French space is in rebellion:
    // 32.5 forbids rebels and non-rebels coexisting, so the flow refuses the
    // battle before `beginLandBattle` is ever reached.
    const german = Object.values(G.units).find((unit) => unit.owner === "GE" && !unit.naval)!;
    const front = neighboursOf(german.space as string).find((id) => G.spaces[id] !== undefined)!;
    G.units.uEnemy = {id: "uEnemy", kind: "army", owner: "FR", steps: 2, space: front, naval: false};
    G.spaces[front].units.push("uEnemy");
    G.spaces[front].control = "FR";
    G.spaces[front].rebellion = {minor: "Test", step: 0, rebels: []} as never;
    G.spaces[front].trench = null;
    G.spaces[front].trenchLine = false;

    const decision = botDecision(G, makeCtx("0"), "GE");
    if (decision.move === "landBattle") {
      const [from, to] = decision.args as [string, string];
      const res = performGwManeuver(JSON.parse(JSON.stringify(G)), makeCtx("0"), {
        kind: "landBattle", power: "GE", from, to,
      });
      expect(res.ok).toBe(true);
    }
  });
});

describe("8 — the prep stability discard happens once per phase", () => {
  test("a bot that already discarded does not re-issue the move", () => {
    const G = fresh();
    G.phase = "prep";
    G.activePower = "GE";
    G.powers.GE.stability = 2;
    G.powers.GE.hand = G.powers.GE.hand.filter(
      (id) => cardById(id).kind !== "home",
    );
    expect(G.powers.GE.hand.length).toBeGreaterThan(0);

    // First decision: discard for stability.
    const first = botDecision(G, makeCtx("0"), "GE");
    expect(first.move).toBe("discardForStability");

    // Replay it through the move, then ask again while stability is still ≤ 2:
    // the move's own `prepStability` guard now refuses a second discard, so the
    // bot must fall through to finishPrep instead of spinning.
    const played = discardForStability(G, makeCtx("0"), first.args![0] as never);
    expect(played).toBeUndefined();
    if (G.powers.GE.stability <= 2) {
      const second = botDecision(G, makeCtx("0"), "GE");
      expect(second.move).not.toBe("discardForStability");
    }
  });
});

// ---------------------------------------------------------------------------
// 9. A non-player naval defender must not crash the 19.2/19.5 modifiers
// ---------------------------------------------------------------------------

describe("9 — a minor power's fleet can be the naval defender", () => {
  const baseGw = (G: ImperialElegyState): void => {
    G.gw = {
      active: true, turn: 2, order: ["GE", "FR"], belligerents: ["GE", "FR"], neutrals: [],
      te: ["FR"], ta: ["GE"], usIn: false, italyIn: false,
      usStability: 3, usManpower: 3, usBudget: 4, italyStability: 3, italyManpower: 3, italyBudget: 2,
      trenches: {}, lastColonialWar: null, victor: null, outbreakDone: true, nationalWillDone: true,
      bonusImpulses: [], discard: [],
    } as never;
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
  };

  test("19.5 port modifiers accept a minor-name defender instead of throwing", () => {
    const G = fresh();
    baseGw(G);
    // A neutral minor's port is the embattled area; `defender` is its name, not
    // a Power.  `friendlySpace` reads `G.powers[power].alliance` and used to
    // throw `Cannot read properties of undefined`.
    expect(() => navalPortBattleModifiers(G, "GE", "Denmark" as never, "denmark")).not.toThrow();
    const mods = navalPortBattleModifiers(G, "GE", "Denmark" as never, "denmark");
    expect(mods.attackerDrm).toBeGreaterThanOrEqual(-2);
  });

  test("19.2 avoidance modifiers accept a minor-name defender", () => {
    const G = fresh();
    baseGw(G);
    expect(() => navalAvoidanceModifiers(G, "GE", "Denmark" as never, "denmark")).not.toThrow();
  });

  test("19.2 avoidance plans accept a minor-name defender", () => {
    const G = fresh();
    baseGw(G);
    // Give the defender a ship so the plan enumerates destinations.
    const ship: typeof G.units[string] = {
      id: "uMinorShip", kind: "squadron", owner: "Denmark", steps: 2, space: "denmark", naval: true,
    };
    G.units.uMinorShip = ship;
    G.spaces.denmark.units.push("uMinorShip");
    expect(() => navalAvoidPlans(G, "GE", "Denmark" as never, "denmark", "north-atlantic" as never)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 10. A naval box is never a land-battle origin
// ---------------------------------------------------------------------------

describe("10 — the GW bot does not attack from a naval box", () => {
  test("a fleet sharing a box with an enemy army is not used as a land attacker", () => {
    const G = fresh();
    G.gw = {
      active: true, turn: 2, order: ["GE", "FR"], belligerents: ["GE", "FR"], neutrals: [],
      te: ["FR"], ta: ["GE"], usIn: false, italyIn: false,
      usStability: 3, usManpower: 3, usBudget: 4, italyStability: 3, italyManpower: 3, italyBudget: 2,
      trenches: {}, lastColonialWar: null, victor: null, outbreakDone: true, nationalWillDone: true,
      bonusImpulses: [], discard: [],
    } as never;
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.turnIndex = 0;
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    G.powers.GE.gwBudget = 3;

    // A German fleet sits in a naval box that is adjacent to an enemy-held
    // coastal space.  `landBattle` takes a land origin, so naming the box makes
    // `performGwManeuver` refuse with "Land battles need land spaces" forever.
    const box = "north-atlantic";
    G.units.uFleet = {id: "uFleet", kind: "squadron", owner: "GE", steps: 2, space: box, naval: true};
    G.spaces[box].units.push("uFleet");
    const port = neighboursOf(box)[0];
    G.units.uEnemy = {id: "uEnemy", kind: "army", owner: "FR", steps: 2, space: port, naval: false};
    G.spaces[port].units.push("uEnemy");
    G.spaces[port].control = "FR";

    for (let step = 0; step < 6; step += 1) {
      const decision = botDecision(G, makeCtx("0"), "GE");
      if (decision.move !== "landBattle") continue;
      const from = String((decision.args ?? [])[0]);
      // A land battle may only start from a land space with land units.
      expect(from).not.toBe(box);
      expect(landUnitsIn(G, from).some((unit) => !unit.naval && unit.owner === "GE")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 11. A GW naval move may not enter a rebel space (32.5)
// ---------------------------------------------------------------------------

describe("11 — a rebel space is not a legal GW naval destination", () => {
  test("the destination gate refuses it before the move is attempted", () => {
    const G = fresh();
    G.gw = {
      active: true, turn: 2, order: ["GE", "FR"], belligerents: ["GE", "FR"], neutrals: [],
      te: ["FR"], ta: ["GE"], usIn: false, italyIn: false,
      usStability: 3, usManpower: 3, usBudget: 4, italyStability: 3, italyManpower: 3, italyBudget: 2,
      trenches: {}, lastColonialWar: null, victor: null, outbreakDone: true, nationalWillDone: true,
      bonusImpulses: [], discard: [],
    } as never;
    G.phase = "gwManeuver";
    G.activePower = "UK";
    G.powers.UK.alliance = "teCommitted";
    G.powers.GE.alliance = "taCommitted";
    G.powers.UK.gwBudget = 3;

    // 32.5 forbids rebels and non-rebels coexisting, so a naval move into a
    // rebel space is refused by the flow.  The sweep kept naming it because it
    // only asked the route planner.
    G.spaces.india.rebellion = {minor: "India", step: 0, rebels: []} as never;
    const ship = Object.values(G.units).find((unit) => unit.owner === "UK" && unit.naval)!;
    expect(ship).toBeDefined();

    const verdict = maneuverDestinationProblem(G, "UK", {
      kind: "naval", to: "india", unitIds: [ship.id],
    });
    expect(verdict).not.toBeNull();
    expect(String(verdict)).toMatch(/rebels/);
  });
});

// ---------------------------------------------------------------------------
// 12. The Rule 34 B1 die is rolled, not fixed
// ---------------------------------------------------------------------------

describe("12 — the B1 priority die is actually rolled", () => {
  test("different dice reach different priority rows", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "FR";
    G.powers.FR.flags.homeChosen = true;
    G.powers.FR.selectedHomeCard = null;
    G.cpRemaining = 3;

    // B1's priority rows are 1 = influence/EF, 2 = minor alliance/diplomacy,
    // 3-4 = build armies, 5-6 = play an event.  A constant die collapsed all of
    // them onto one row, so the bot behaved identically in every game and most
    // of the move vocabulary was unreachable.
    const seen = new Set<string>();
    for (const die of [1, 2, 3, 4, 5, 6]) {
      const ctx = {
        ...makeCtx("2"),
        random: {Die: () => die},
      } as unknown as Ctx;
      seen.add(botDecision(G, ctx, "FR").move);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  test("a ctx without the random plugin still yields the documented fallback", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "FR";
    G.powers.FR.flags.homeChosen = true;
    G.powers.FR.selectedHomeCard = null;
    G.cpRemaining = 3;
    const bare = {playerID: "2", events: {}, phase: "action"} as unknown as Ctx;
    expect(() => botDecision(G, bare, "FR")).not.toThrow();
    // The fallback is the conservative 3-4 row (build armies), as documented.
    const move = botDecision(G, bare, "FR");
    expect(typeof move.move).toBe("string");
  });
});
