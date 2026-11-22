/**
 * 33.6 Ottoman Manpower in the Orders panel.
 *
 * `moves.recruit` already infers the army type from the build space, but the
 * panel used to ask `canRecruitIn` the Turkish default everywhere.  In an Arab
 * key that reported "Turkish armies need a key without a minority nationality"
 * and disabled the row, so the Arab pool could never be spent from the UI (and
 * the Rule 34 bot made the same check).  The row must ask about the same type
 * the move will build and pass that type through.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {landUnitsIn} from "./engine/rules";
import {spaceActions} from "./components/actionAvailability";
import * as moves from "./moves";

const ctxFor = (power: Power = "OT"): Ctx => ({
  playerID: String(POWERS.indexOf(power)),
  random: {Die: () => 3, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "action",
} as unknown as Ctx);

const game = (): ImperialElegyState => {
  const G = setupImperialElegy(ctxFor());
  G.phase = "action";
  G.activePower = "OT";
  G.cpRemaining = 3;
  G.pending = null;
  G.battle = null;
  G.war = null;
  return G;
};

const actions = (
  G: ImperialElegyState,
  space: string,
  moveBag: Record<string, (...args: any[]) => void> = moves as unknown as Record<string, (...args: any[]) => void>,
) => spaceActions({
  G,
  viewer: "OT",
  space: space as never,
  phase: "action",
  selectedUnit: null,
  cp: G.cpRemaining,
  canAct: true,
  canActionCard: true,
  war: null,
  me: G.powers.OT,
  moves: moveBag,
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
  describeRow: (candidate: {label: string; reason?: string}) => ({label: candidate.label, reason: candidate.reason}),
  locale: "zh_CN",
});

describe("33.6 Arab army row", () => {
  test("an Arab key offers the Arab pool, not the Turkish rule", () => {
    const G = game();
    G.powers.OT.secondaryManpower = 2;
    // The campaign starts with one Arab army in Syria; keep one spare slot.
    const arab = landUnitsIn(G, "syria").filter((unit) => unit.flags?.arab === true);
    expect(arab.length).toBe(1);
    const row = actions(G, "arabia").find((entry) => entry.id === "recruitArmy");
    expect(row?.enabled).toBe(true);
    expect(row?.label).toContain("阿拉伯");
    expect(row?.reason).toBeUndefined();
  });

  test("the click asks the engine for an Arab army", () => {
    const G = game();
    G.powers.OT.secondaryManpower = 2;
    const recruit = jest.fn();
    const moveBag = {...moves, recruit} as unknown as Record<string, (...args: any[]) => void>;
    const row = actions(G, "arabia", moveBag).find((entry) => entry.id === "recruitArmy");
    row!.run();
    expect(recruit).toHaveBeenCalledWith("arabia", "army", 1, {ottoman: "arab"});
  });

  test("a Turkish key still reports the Turkish ceiling", () => {
    const G = game();
    // The campaign starts with its three Turkish armies, so the ceiling is hit.
    expect(G.powers.OT.manpower).toBe(3);
    const row = actions(G, "ankara").find((entry) => entry.id === "recruitArmy");
    expect(row?.enabled).toBe(false);
    expect(row?.reason).toContain("土耳其人力上限");
  });
});
