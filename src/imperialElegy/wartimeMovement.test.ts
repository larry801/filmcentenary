/**
 * 15.2.4 March and 15.2.5 Rail Movement — the two printed wartime land actions.
 *
 * The live wartime move used to be the peacetime 12.15 redeployment (unlimited
 * distance over controlled/influenced land).  In a war the printed actions are
 * a one- or two-space march and a half-industry rail allowance, so these tests
 * pin the distance, the pass-through rule, the neutral/enemy-stop rule and the
 * rail budget through both the pure planner and the live `redeploy` move.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {landUnitsIn} from "./engine/rules";
import {planMarch, planRail, railAllowance, wartimeRailed} from "./engine/wartimeMovement";
import {redeploy} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

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

const clear = (G: ImperialElegyState, ...spaces: string[]): void => {
  for (const space of spaces) for (const unit of [...landUnitsIn(G, space)]) removeUnit(G, unit.id);
};

/** GE vs FR, GE active, an army in Berlin and a clean board around it. */
const war = (): {G: ImperialElegyState; army: string} => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "wartime";
  G.activePower = "GE";
  G.pending = null;
  G.battle = null;
  G.war = warState("GE", "FR");
  G.war.budgets = {GE: 8, FR: 8};
  clear(G, "berlin", "saxony", "hanover", "westphalia", "bavaria", "pomerania", "prussia", "paris");
  for (const space of ["saxony", "hanover", "westphalia", "bavaria"]) {
    G.spaces[space].control = null;
    G.spaces[space].ally = null;
    G.spaces[space].influence = null;
    G.spaces[space].fort = null;
  }
  const army = placeUnit(G, "GE", "army", "berlin", 2).id;
  return {G, army};
};

// ---------------------------------------------------------------------------
// The pure planner
// ---------------------------------------------------------------------------

describe("15.2.4 march distance and pass-through", () => {
  test("one space is a march; two clear spaces are a march", () => {
    const {G, army} = war();
    G.spaces.saxony.control = "GE";
    expect(planMarch(G, "GE", army, "saxony")).toMatchObject({ok: true, kind: "march", path: ["berlin", "saxony"]});

    // Berlin → Hanover → Westphalia, both clear connections.
    G.spaces.hanover.control = "GE";
    G.spaces.westphalia.control = "GE";
    expect(planMarch(G, "GE", army, "westphalia")).toMatchObject({
      ok: true,
      kind: "march",
      path: ["berlin", "hanover", "westphalia"],
    });
  });

  test("three clear spaces are not a march", () => {
    const {G, army} = war();
    for (const space of ["hanover", "westphalia", "belgium"]) G.spaces[space].control = "GE";
    expect(planMarch(G, "GE", army, "belgium")).toMatchObject({ok: false, reason: "too-far"});
  });

  test("a difficult hop is one space only, so a two-space march over it is refused", () => {
    const {G, army} = war();
    // Berlin → Schleswig-Holstein → Denmark: the second hop is printed
    // difficult, so the march stops after one space and cannot make the second.
    for (const space of ["schleswig-holstein", "denmark"]) {
      G.spaces[space].control = "GE";
      G.spaces[space].ally = null;
    }
    clear(G, "schleswig-holstein");
    expect(planMarch(G, "GE", army, "denmark")).toMatchObject({ok: false, reason: "too-far"});
    // The single hop into Schleswig-Holstein is still a legal march.
    expect(planMarch(G, "GE", army, "schleswig-holstein")).toMatchObject({ok: true, path: ["berlin", "schleswig-holstein"]});
  });

  test("a march may pass through an enemy space that holds no enemy land unit", () => {
    const {G, army} = war();
    G.spaces.hanover.control = "FR";
    G.spaces.hanover.occupiedBy = "FR";
    G.spaces.westphalia.control = "GE";
    expect(planMarch(G, "GE", army, "westphalia")).toMatchObject({ok: true, path: ["berlin", "hanover", "westphalia"]});
  });

  test("a march cannot pass through an enemy army or fort", () => {
    const {G, army} = war();
    // Berlin → Westphalia has two printed two-space routes (through Hanover and
    // through Saxony).  Put an enemy army in both: the printed pass-through
    // exception only covers an enemy space with no enemy land unit.
    G.spaces.hanover.control = "FR";
    G.spaces.westphalia.control = "GE";
    G.spaces.saxony.control = "GE";
    placeUnit(G, "FR", "army", "hanover", 2);
    placeUnit(G, "FR", "army", "saxony", 2);
    expect(planMarch(G, "GE", army, "westphalia")).toMatchObject({ok: false, reason: "too-far"});

    // Swap one army for an enemy fort: still closed.
    removeUnit(G, landUnitsIn(G, "saxony").find((unit) => unit.owner === "FR")!.id);
    G.spaces.saxony.fort = {power: "FR", level: 1};
    expect(planMarch(G, "GE", army, "westphalia")).toMatchObject({ok: false, reason: "too-far"});
  });

  test("a march cannot enter an enemy fort or a neutral space", () => {
    const {G, army} = war();
    G.spaces.saxony.control = "FR";
    G.spaces.saxony.fort = {power: "FR", level: 1};
    expect(planMarch(G, "GE", army, "saxony")).toMatchObject({ok: false, reason: "enemy-fort"});

    G.spaces.saxony.fort = null;
    G.spaces.saxony.control = "Saxony";
    G.spaces.saxony.ally = null;
    expect(planMarch(G, "GE", army, "saxony")).toMatchObject({ok: false, reason: "neutral"});
  });

  test("a neutral space blocks a two-space march too", () => {
    const {G, army} = war();
    // Both printed two-space routes to Westphalia pass through a German minor.
    for (const space of ["hanover", "saxony"]) {
      G.spaces[space].control = space === "hanover" ? "Hanover" : "Saxony";
      G.spaces[space].ally = null;
    }
    G.spaces.westphalia.control = "GE";
    expect(planMarch(G, "GE", army, "westphalia")).toMatchObject({ok: false, reason: "too-far"});
  });
});

describe("15.2.5 rail movement", () => {
  test("the allowance is half industry rounded up, at least one", () => {
    const {G} = war();
    G.powers.GE.industry = 1;
    expect(railAllowance(G, "GE")).toBe(1);
    G.powers.GE.industry = 3;
    expect(railAllowance(G, "GE")).toBe(2);
    G.powers.GE.industry = 7;
    expect(railAllowance(G, "GE")).toBe(4);
  });

  test("an unlimited friendly land path is one rail move", () => {
    const {G, army} = war();
    for (const space of ["pomerania", "poland", "galicia", "romania", "bulgaria", "istanbul"]) {
      G.spaces[space].control = "GE";
      G.spaces[space].occupiedBy = null;
      G.spaces[space].ally = null;
    }
    expect(planRail(G, "GE", army, "istanbul")).toMatchObject({ok: true, kind: "rail"});
  });

  test("rail cannot pass through or end in enemy or neutral space", () => {
    const {G, army} = war();
    G.spaces.pomerania.control = "GE";
    G.spaces.poland.control = "RU";
    // Galicia is reachable around Poland through friendly Silesia, so close that
    // route too: then Poland is the only way and the rail must refuse it.
    for (const space of ["silesia", "bohemia", "vienna", "hungary"]) {
      G.spaces[space].control = "RU";
      G.spaces[space].occupiedBy = null;
      G.spaces[space].ally = null;
    }
    G.spaces.galicia.control = "GE";
    expect(planRail(G, "GE", army, "galicia")).toMatchObject({ok: false, reason: "no-rail-path"});

    G.spaces.pomerania.control = null;
    G.spaces.pomerania.ally = null;
    expect(planRail(G, "GE", army, "pomerania")).toMatchObject({ok: false, reason: "no-rail-path"});
  });

  test("the allowance refuses a second rail move in the same impulse", () => {
    const {G, army} = war();
    G.powers.GE.industry = 1;
    G.spaces.saxony.control = "GE";
    expect(planRail(G, "GE", army, "saxony")).toMatchObject({ok: true});
    G.powers.GE.flags.wartimeRailedThisImpulse = 1;
    expect(wartimeRailed(G, "GE")).toBe(1);
    expect(planRail(G, "GE", army, "saxony")).toMatchObject({ok: false, reason: "rail-allowance"});
  });
});

// ---------------------------------------------------------------------------
// The live move
// ---------------------------------------------------------------------------

describe("the live wartime land move", () => {
  test("an adjacent controlled space is a march, and the CP is charged once", () => {
    const {G, army} = war();
    G.spaces.saxony.control = "GE";
    const ctx = makeCtx([], seat("GE"));
    expect(redeploy(G, ctx, army, "saxony")).toBeUndefined();
    expect(G.units[army].space).toBe("saxony");
    expect(G.war!.budgets.GE).toBe(7);
    expect(G.log.some((entry) => entry.key === "wartimeMarch")).toBe(true);
  });

  test("a distant friendly space is a rail move and spends one allowance slot", () => {
    const {G, army} = war();
    G.powers.GE.industry = 5;
    for (const space of ["pomerania", "poland", "galicia", "romania", "bulgaria", "istanbul"]) {
      G.spaces[space].control = "GE";
    }
    const ctx = makeCtx([], seat("GE"));
    expect(redeploy(G, ctx, army, "istanbul")).toBeUndefined();
    expect(G.units[army].space).toBe("istanbul");
    expect(wartimeRailed(G, "GE")).toBe(1);
    expect(G.log.some((entry) => entry.key === "wartimeRail")).toBe(true);
  });

  test("the old unlimited 12.15 redeploy no longer reaches an unconnected space", () => {
    const {G, army} = war();
    G.spaces.paris.control = "GE";
    G.spaces.paris.occupiedBy = "GE";
    const ctx = makeCtx([], seat("GE"));
    expect(redeploy(G, ctx, army, "paris")).toBe(INVALID_MOVE);
    expect(G.war!.budgets.GE).toBe(8);
    expect(G.log.some((entry) => entry.key === "wartimeMoveRejected")).toBe(true);
  });

  test("the rail allowance survives into a second unit of the same action", () => {
    const {G, army} = war();
    G.powers.GE.industry = 1;
    for (const space of ["pomerania", "poland", "galicia", "romania", "bulgaria", "istanbul"]) {
      G.spaces[space].control = "GE";
    }
    const second = placeUnit(G, "GE", "army", "berlin", 2).id;
    const ctx = makeCtx([], seat("GE"));
    expect(redeploy(G, ctx, army, "istanbul")).toBeUndefined();
    // A second army cannot rail: the printed allowance is one army at
    // industry 1 (half of 1, rounded up).
    expect(redeploy(G, ctx, second, "istanbul")).toBe(INVALID_MOVE);
    // It may still march one space, which has no allowance.
    G.spaces.saxony.control = "GE";
    expect(redeploy(G, ctx, second, "saxony")).toBeUndefined();
  });

  test("peace time still uses 12.15 redeployment", () => {
    const G = setupImperialElegy(makeCtx());
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 4;
    clear(G, "berlin", "paris");
    G.spaces.paris.control = "GE";
    G.spaces.paris.occupiedBy = null;
    const army = placeUnit(G, "GE", "army", "berlin", 2).id;
    // Berlin → Hanover → Netherlands → Belgium → Picardy → Paris, all
    // controlled: 12.15 is an unlimited-distance peacetime move.
    for (const space of ["hanover", "netherlands", "belgium", "picardy"]) G.spaces[space].control = "GE";
    expect(redeploy(G, makeCtx([], seat("GE")), army, "paris")).toBeUndefined();
  });
});
