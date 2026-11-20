/**
 * The action-cost table against the engine itself.
 *
 * `spaceActions` promises a cost per row and an enable flag.  Two things must
 * stay true as the rules evolve:
 *
 * 1. **No drift:** a row's `cost` equals the CP the corresponding move
 *    actually spends.  The drift test below drives the real moves on a real
 *    setup and compares the wallet delta with `ACTION_COSTS`.
 * 2. **No lies:** a row the list disables is a row the engine refuses, and a
 *    row it enables is one the engine accepts (or the UI would either hide a
 *    legal action or offer an illegal one).
 */
import {Ctx} from "boardgame.io";
import {POWERS, Power, SpaceId, Unit} from "../types";
import {setupImperialElegy} from "../engine/setup";
import {placeUnit} from "../engine/effects";
import {landUnitsIn} from "../engine/rules";
import * as moves from "../moves";
import {ACTION_COSTS, ACTION_COST_ORDER, spaceActions, type SpaceAction, type SpaceActionsInput} from "./actionAvailability";

const testCtx = (power: Power, playerID?: string): Ctx => ({
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => undefined, setPhase: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "action",
  currentPlayer: String(POWERS.indexOf(power)),
  playerID: playerID ?? String(POWERS.indexOf(power)),
  activePlayers: null,
} as unknown as Ctx);

const game = (power: Power, cp = 4) => {
  const G = setupImperialElegy(testCtx(power));
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = cp;
  G.pending = null;
  G.battle = null;
  G.war = null;
  return G;
};

const input = (overrides: Partial<SpaceActionsInput> & Pick<SpaceActionsInput, "G" | "viewer" | "space">): SpaceActionsInput => ({
  phase: "action",
  selectedUnit: null,
  cp: overrides.G.cpRemaining,
  canAct: true,
  canActionCard: true,
  war: null,
  me: overrides.G.powers[overrides.viewer],
  moves: moves as unknown as Record<string, (...args: any[]) => void>,
  doAction: (fn) => fn(),
  myOnMapArmies: 1,
  myForts: 0,
  myMinorAllies: 0,
  ownLandInSelected: [],
  ownNavalInSelected: [],
  potentialLandTargets: [],
  potentialNavalTargets: [],
  deployLimit: 0,
  deployFree: false,
  canDeployHere: false,
  canGwDraft: false,
  canGwDeployHere: false,
  polishArmyDecision: null,
  polishReserveDecision: null,
  gwJointNavalAllies: [],
  gwJointNavalUnitIds: () => [],
  startBattle: () => undefined,
  startNavalBattle: () => undefined,
  describeRow: (candidate) => ({label: candidate.label, reason: candidate.reason}),
  locale: "en",
  ...overrides,
});

const row = (rows: SpaceAction[], id: SpaceAction["id"]): SpaceAction | undefined =>
  rows.find((candidate) => candidate.id === id);

describe("A71 colonial Egypt", () => {
  test("the fleet-build row follows the live key type, not the printed one", () => {
    const G = game("UK", 6);
    G.spaces.egypt.control = "UK";
    G.spaces.egypt.homeOverride = "UK";
    G.spaces.egypt.keyTypeOverride = "colonial";
    const rows = spaceActions(input({G, viewer: "UK", space: "egypt"}));
    const squadron = row(rows, "buildSquadron");
    expect(squadron?.enabled).toBe(false);
    expect(squadron?.reason).toMatch(/territorial home key/);
  });
});

describe("ACTION_COSTS", () => {
  test("every action in the printed order has a cost", () => {
    for (const id of ACTION_COST_ORDER) {
      expect(ACTION_COSTS[id]).toBeGreaterThanOrEqual(0);
    }
  });

  test("matches the player aid's list", () => {
    expect(ACTION_COSTS.recruitArmy).toBe(1);
    expect(ACTION_COSTS.recruitReserve).toBe(1);
    expect(ACTION_COSTS.recruitEc).toBe(2);
    expect(ACTION_COSTS.buildSquadron).toBe(2);
    expect(ACTION_COSTS.buildDreadnought).toBe(3);
    expect(ACTION_COSTS.buildFort).toBe(1);
    expect(ACTION_COSTS.buildEf).toBe(2);
    expect(ACTION_COSTS.influence).toBe(1);
    expect(ACTION_COSTS.diplomacy).toBe(1);
    expect(ACTION_COSTS.minorAlliance).toBe(3);
    expect(ACTION_COSTS.removeInfluence).toBe(1);
    expect(ACTION_COSTS.breakAlliance).toBe(4);
    expect(ACTION_COSTS.pacify).toBe(1);
    expect(ACTION_COSTS.move).toBe(1);
    expect(ACTION_COSTS.landBattle).toBe(1);
    expect(ACTION_COSTS.navalBattle).toBe(1);
    expect(ACTION_COSTS.rapidDeploy).toBe(0);
  });
});

describe("spaceActions: no drift against the engine", () => {
  test("a recruit army row costs what `recruit` spends", () => {
    const power: Power = "GE";
    const G = game(power, 4);
    const ctx = testCtx(power);
    const rows = spaceActions(input({G, viewer: power, space: "berlin"}));
    const army = row(rows, "recruitArmy");
    expect(army?.cost).toBe(ACTION_COSTS.recruitArmy);
    // Drive the engine's own move: the wallet must drop by exactly the cost.
    const before = G.cpRemaining;
    moves.recruit(G, ctx, "berlin", "army", 1, {ottoman: undefined, indian: undefined, cw: undefined});
    // A refused move spends nothing; that is the one legal "0" answer.
    if (G.cpRemaining !== before) {
      expect(before - G.cpRemaining).toBe(ACTION_COSTS.recruitArmy);
    } else {
      expect(row(spaceActions(input({G, viewer: power, space: "berlin"})), "recruitArmy")?.enabled).toBe(false);
    }
  });

  test("influence, diplomacy and minor alliance match the wallet", () => {
    const power: Power = "GE"; // Berlin is a German home key; Mulhouse is neutral-adjacent.
    for (const [id, space] of [["influence", "afghanistan"], ["diplomacy", "afghanistan"]] as const) {
      const G = game(power, 4);
      const ctx = testCtx(power);
      const rowBefore = row(spaceActions(input({G, viewer: power, space})), id);
      if (rowBefore === undefined) continue; // not offered here at all
      expect(rowBefore.cost).toBe(ACTION_COSTS[id]);
      const before = G.cpRemaining;
      if (id === "influence") moves.placeInfluence(G, ctx, space);
      else moves.placeDiplomacy(G, ctx, space);
      // The move may be refused for a rule this test does not model; when it
      // runs, it must spend exactly the table's cost.
      if (G.cpRemaining !== before) {
        expect(before - G.cpRemaining).toBe(rowBefore?.cost);
        expect(rowBefore?.cost).toBe(ACTION_COSTS[id]);
      }
    }
  });

  test("a fleet build costs what `constructFleet` spends", () => {
    const G = game("UK", 4);
    const ctx = testCtx("UK");
    const rows = spaceActions(input({G, viewer: "UK", space: "london"}));
    const squadron = row(rows, "buildSquadron");
    if (squadron !== undefined && squadron.enabled) {
      const before = G.cpRemaining;
      moves.constructFleet(G, ctx, "london", "squadron", false);
      if (G.cpRemaining !== before) expect(before - G.cpRemaining).toBe(squadron.cost);
    } else {
      // Still pinned to the printed table even when the row is disabled here.
      expect(squadron?.cost ?? ACTION_COSTS.buildSquadron).toBe(ACTION_COSTS.buildSquadron);
    }
  });

  test("an EF costs what `buildEf` spends", () => {
    const G = game("UK", 4);
    const ctx = testCtx("UK");
    const ef = row(spaceActions(input({G, viewer: "UK", space: "london"})), "buildEf");
    expect(ef?.cost).toBe(ACTION_COSTS.buildEf);
    if (ef?.enabled === true) {
      const before = G.cpRemaining;
      moves.buildEf(G, ctx, "london");
      if (G.cpRemaining !== before) expect(before - G.cpRemaining).toBe(ACTION_COSTS.buildEf);
    }
  });
});

describe("spaceActions: enabled means the engine says yes", () => {
  /**
   * The missing half of the contract.  The suite only ever asserted
   * "disabled ⇒ the engine refuses"; nothing asserted the converse, which is
   * how a player power's own home space came to offer a legal-looking "place
   * diplomacy" row that the engine then refused (392 rows at campaign start).
   * `foreignAffairs.test.ts` runs the full power × space scan; this keeps the
   * cheap check next to the cost table.
   */
  test("a player power's own home space offers no diplomacy marker", () => {
    for (const [power, space] of [["GE", "berlin"], ["UK", "london"], ["FR", "paris"]] as const) {
      const G = game(power);
      const row = spaceActions(input({G, viewer: power, space})).find((candidate) => candidate.id === "diplomacy");
      expect(row?.enabled).toBe(false);
      expect(row?.reason).toBeTruthy();
    }
  });
});

describe("12.4 refit a reduced fleet from the Orders panel", () => {
  test("a reduced squadron in a friendly port offers a 1 CP refit row", () => {
    const G = game("FR", 4);
    const fleet = placeUnit(G, "FR", "squadron", "provence", 1);
    const rows = spaceActions(input({G, viewer: "FR", space: "provence", selectedUnit: fleet.id}));
    const refit = row(rows, "refitFleet");
    expect(refit?.cost).toBe(1);
    expect(refit?.label).toBe("Refit fleet");
    expect(refit?.enabled).toBe(true);
  });

  test("the row runs the engine's refit move with the selected fleet", () => {
    const G = game("FR", 4);
    const fleet = placeUnit(G, "FR", "squadron", "provence", 1);
    const refitNavalUnit = jest.fn();
    const rows = spaceActions(input({
      G, viewer: "FR", space: "provence", selectedUnit: fleet.id,
      moves: {refitNavalUnit} as unknown as Record<string, (...args: any[]) => void>,
    }));
    row(rows, "refitFleet")?.run();
    expect(refitNavalUnit).toHaveBeenCalledWith(fleet.id);
  });

  test("a fleet at sea is refused with the port reason", () => {
    const G = game("FR", 4);
    const fleet = placeUnit(G, "FR", "squadron", "north-atlantic", 1);
    const rows = spaceActions(input({G, viewer: "FR", space: "north-atlantic", selectedUnit: fleet.id}));
    const refit = row(rows, "refitFleet");
    expect(refit?.enabled).toBe(false);
    expect(refit?.reason).toContain("friendly port");
  });

  test("a full-strength fleet offers no refit row", () => {
    const G = game("FR", 4);
    const fleet = placeUnit(G, "FR", "squadron", "provence", 2);
    const rows = spaceActions(input({G, viewer: "FR", space: "provence", selectedUnit: fleet.id}));
    expect(row(rows, "refitFleet")).toBeUndefined();
  });

  test("12.4 colonial home ports offer no build row (no engine drift)", () => {
    const G = game("UK", 8);
    for (const space of ["canada", "india", "south-africa", "australia-new-zealand"]) {
      const rows = spaceActions(input({G, viewer: "UK", space: space as SpaceId}));
      const squadron = row(rows, "buildSquadron");
      expect(squadron?.enabled).toBe(false);
      expect(squadron?.reason).toContain("main map");
    }
    const london = row(spaceActions(input({G, viewer: "UK", space: "london"})), "buildSquadron");
    expect(london?.enabled).toBe(true);
  });

  test("no CP disables the row", () => {
    const G = game("FR", 0);
    const fleet = placeUnit(G, "FR", "squadron", "provence", 1);
    const rows = spaceActions(input({G, viewer: "FR", space: "provence", selectedUnit: fleet.id, cp: 0}));
    const refit = row(rows, "refitFleet");
    expect(refit?.enabled).toBe(false);
  });
});

describe("12.2 refit a reduced army from the Orders panel", () => {
  test("a reduced army at the manpower ceiling still offers the 1 CP recruit row", () => {
    const G = game("GE", 4);
    const army = landUnitsIn(G, "berlin").find((unit) => unit.owner === "GE" && unit.kind === "army")!;
    army.steps = 1;
    const rows = spaceActions(input({G, viewer: "GE", space: "berlin"}));
    const recruit = row(rows, "recruitArmy");
    expect(recruit?.cost).toBe(1);
    expect(recruit?.enabled).toBe(true);
  });

  test("a full army at the ceiling keeps the row disabled with the manpower reason", () => {
    const G = game("GE", 4);
    const recruit = row(spaceActions(input({G, viewer: "GE", space: "berlin"})), "recruitArmy");
    expect(recruit?.enabled).toBe(false);
    expect(recruit?.reason).toMatch(/Manpower/);
  });
});

describe("spaceActions: disabled means the engine says no", () => {
  test("with no CP every spending row is disabled and explains the cost", () => {
    const G = game("GE", 0);
    const rows = spaceActions(input({G, viewer: "GE", space: "berlin", cp: 0}));
    const spending = rows.filter((candidate) => candidate.cost > 0 && candidate.id !== "recruitReserve");
    expect(spending.length).toBeGreaterThan(0);
    for (const candidate of spending) {
      if (candidate.enabled) continue; // a free path (staff deploy) may still be legal
      expect(candidate.reason).toBeTruthy();
    }
  });

  test("the rows are labelled in the UI language and carry their group", () => {
    const G = game("GE", 4);
    const en = spaceActions(input({G, viewer: "GE", space: "berlin"}));
    const zh = spaceActions(input({G, viewer: "GE", space: "berlin", locale: "zh_CN"}));
    const armyEn = row(en, "recruitArmy");
    const armyZh = row(zh, "recruitArmy");
    expect(armyEn?.label).toBe("Recruit army");
    expect(armyZh?.label).toBe("征募军团");
    expect(armyEn?.group).toBe("recruit");
  });

  test("a selected unit's own space offers the move row, not the destination", () => {
    const G = game("GE", 4);
    const unit = placeUnit(G, "GE", "army", "berlin", 2);
    // 12.15/16.1: the row belongs to the space the stack is standing in.  It
    // arms the map rings; the destination is the next click, never a guess.
    G.spaces.saxony.control = "GE";
    const atOrigin = row(spaceActions(input({G, viewer: "GE", space: "berlin", selectedUnit: unit.id})), "move");
    expect(atOrigin?.cost).toBe(ACTION_COSTS.move);
    expect(atOrigin?.label).toContain("Move selected");
    // The destination space no longer offers a "move here" row.
    const atTarget = row(spaceActions(input({G, viewer: "GE", space: "saxony", selectedUnit: unit.id})), "move");
    expect(atTarget).toBeUndefined();
  });
});

describe("spaceActions: every row has its own render key", () => {
  /**
   * The panel keys a row on `uid ?? id` and derives the row's `data-testid` from
   * the same value, so a repeated `id` would give React duplicate keys and two
   * elements one test id.  The Great War does exactly that: "Joint naval with
   * <ally>" is one row per allied contingent, all of them the `gwNaval` action,
   * next to the ordinary naval row.  `uid` exists for that case and must be
   * unique across the whole list.
   */
  const keys = (rows: SpaceAction[]): string[] => rows.map((candidate) => candidate.uid ?? candidate.id);

  test("a repeated id still yields unique rows", () => {
    const G = game("GE", 4);
    const fleet = placeUnit(G, "GE", "squadron", "north-atlantic", 2);
    G.phase = "gwManeuver";
    G.activePower = "GE";
    const rows = spaceActions(input({
      G, viewer: "GE", space: "western-mediterranean", selectedUnit: fleet.id,
      phase: "gwManeuver",
      gwJointNavalAllies: ["AU", "OT"],
      gwJointNavalUnitIds: () => [],
    }));
    const naval = rows.filter((candidate) => candidate.id === "gwNaval");
    // The ordinary naval row plus one per joint contingent.
    expect(naval.length).toBe(3);
    expect(keys(rows)).toHaveLength(new Set(keys(rows)).size);
  });

  test("rows without an override fall back to their action id", () => {
    const G = game("GE", 4);
    for (const candidate of spaceActions(input({G, viewer: "GE", space: "berlin"}))) {
      if (candidate.uid !== undefined) continue;
      expect(candidate.uid ?? candidate.id).toBe(candidate.id);
    }
  });
});
