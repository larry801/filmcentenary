/**
 * 12.1 Construct Fort — placement, level and the 1 CP upgrade.
 *
 * The action printed on the player aid is "Construct Fort: 1–2 CP; fort level =
 * CP spent, max 3 forts per player, a fort can be upgraded for 1 CP (not to
 * level 3)".  This suite pins the three clauses the engine used to miss:
 *
 *  - a fort is built only where the power controls the space or stands in it,
 *    so a great power cannot drop one into another power's capital;
 *  - a new fort may be level 1 (1 CP) or level 2 (2 CP);
 *  - an existing fort of your own is upgraded one level for 1 CP, never to 3.
 *
 * Plus 20.1's Militarism benefit, which protects a fort — the player's own.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {militarismOptions} from "./engine/endPhase";
import {buildFort} from "./moves";
import {spaceActions} from "./components/actionAvailability";
import * as moves from "./moves";

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

const beginAction = (G: ImperialElegyState, active: Power = "GE", cp = 4): void => {
  G.phase = "action";
  G.activePower = active;
  G.cpRemaining = cp;
  G.pending = null;
  G.battle = null;
  G.war = null;
};

describe("12.1 buildFort — placement", () => {
  test("a great power cannot fortify another power's capital", () => {
    const G = fresh();
    beginAction(G, "GE");
    // Vienna is AU's capital, controlled by AU and holding an AU army.
    expect(G.spaces.vienna.control).toBe("AU");
    expect(buildFort(G, makeCtx([], seat("GE")), "vienna", 1)).toBe(INVALID_MOVE);
    expect(G.spaces.vienna.fort ?? null).toBeNull();
    expect(G.cpRemaining).toBe(4);
  });

  test("a neutral minor's space refuses a fort as well", () => {
    const G = fresh();
    beginAction(G, "GE");
    // Saxony is an independent minor next to Berlin.
    expect(buildFort(G, makeCtx([], seat("GE")), "saxony", 1)).toBe(INVALID_MOVE);
    expect(G.spaces.saxony.fort ?? null).toBeNull();
  });

  test("a controlled home key accepts the fort and charges its level", () => {
    const G = fresh();
    beginAction(G, "GE");
    expect(buildFort(G, makeCtx([], seat("GE")), "berlin", 1)).toBeUndefined();
    expect(G.spaces.berlin.fort).toEqual({power: "GE", level: 1});
    expect(G.cpRemaining).toBe(3);

    const H = fresh();
    beginAction(H, "GE");
    expect(buildFort(H, makeCtx([], seat("GE")), "berlin", 2)).toBeUndefined();
    expect(H.spaces.berlin.fort).toEqual({power: "GE", level: 2});
    expect(H.cpRemaining).toBe(2);
  });

  test("a space your army stands in accepts the fort even when another power controls it", () => {
    const G = fresh();
    beginAction(G, "GE");
    placeUnit(G, "GE", "army", "vienna", 2);
    expect(buildFort(G, makeCtx([], seat("GE")), "vienna", 1)).toBeUndefined();
    expect(G.spaces.vienna.fort).toEqual({power: "GE", level: 1});
  });
});

describe("12.1 buildFort — the 1 CP upgrade", () => {
  test("an existing fort of your own is upgraded one level for 1 CP", () => {
    const G = fresh();
    beginAction(G, "GE");
    G.spaces.berlin.fort = {power: "GE", level: 1};
    expect(buildFort(G, makeCtx([], seat("GE")), "berlin", 1)).toBeUndefined();
    expect(G.spaces.berlin.fort).toEqual({power: "GE", level: 2});
    expect(G.cpRemaining).toBe(3);
  });

  test("a level 2 fort cannot be upgraded to level 3", () => {
    const G = fresh();
    beginAction(G, "GE");
    G.spaces.berlin.fort = {power: "GE", level: 2};
    expect(buildFort(G, makeCtx([], seat("GE")), "berlin", 1)).toBe(INVALID_MOVE);
    expect(buildFort(G, makeCtx([], seat("GE")), "berlin", 2)).toBe(INVALID_MOVE);
    expect(G.spaces.berlin.fort).toEqual({power: "GE", level: 2});
    expect(G.cpRemaining).toBe(4);
  });

  test("another power's fort cannot be touched", () => {
    const G = fresh();
    beginAction(G, "GE");
    G.spaces.berlin.fort = {power: "AU", level: 1};
    expect(buildFort(G, makeCtx([], seat("GE")), "berlin", 1)).toBe(INVALID_MOVE);
    expect(G.spaces.berlin.fort).toEqual({power: "AU", level: 1});
  });
});

describe("12.1 fort rows and 20.1 Militarism read the same rules", () => {
  const rows = (G: ImperialElegyState, power: Power, space: string) => {
    G.phase = "action";
    G.activePower = power;
    return spaceActions({
      G,
      viewer: power,
      space: space as never,
      phase: "action",
      selectedUnit: null,
      cp: G.cpRemaining,
      canAct: true,
      canActionCard: true,
      war: null,
      me: G.powers[power],
      moves: moves as unknown as Record<string, (...args: any[]) => void>,
      doAction: (fn) => fn(),
      myOnMapArmies: 1,
      myForts: Object.values(G.spaces).filter((s) => s.fort?.power === power).length,
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
      locale: "en",
    } as never);
  };
  const row = (list: ReturnType<typeof rows>, id: string) => list.find((entry) => entry.id === id);

  test("Berlin offers a 1 CP build, a 2 CP build and no upgrade", () => {
    const G = fresh();
    beginAction(G, "GE");
    const list = rows(G, "GE", "berlin");
    expect(row(list, "buildFort")?.enabled).toBe(true);
    expect(row(list, "buildFort")?.cost).toBe(1);
    expect(row(list, "buildFort2")?.enabled).toBe(true);
    expect(row(list, "buildFort2")?.cost).toBe(2);
    expect(row(list, "upgradeFort")?.enabled).toBe(false);
  });

  test("a level 1 fort of your own switches the rows to the 1 CP upgrade", () => {
    const G = fresh();
    beginAction(G, "GE");
    G.spaces.berlin.fort = {power: "GE", level: 1};
    const list = rows(G, "GE", "berlin");
    expect(row(list, "buildFort")?.enabled).toBe(false);
    expect(row(list, "buildFort2")?.enabled).toBe(false);
    expect(row(list, "upgradeFort")?.enabled).toBe(true);
    expect(row(list, "upgradeFort")?.cost).toBe(1);
  });

  test("Vienna offers no fort row to GE", () => {
    const G = fresh();
    beginAction(G, "GE");
    const list = rows(G, "GE", "vienna");
    expect(row(list, "buildFort")?.enabled).toBe(false);
    expect(row(list, "buildFort2")?.enabled).toBe(false);
    expect(row(list, "upgradeFort")?.enabled).toBe(false);
  });

  test("the Indian Fort offers no upgrade row: its home card upgrades it", () => {
    const G = fresh();
    beginAction(G, "UK");
    G.spaces.india.fort = {power: "UK", level: 1, indian: true};
    const list = rows(G, "UK", "india");
    expect(row(list, "upgradeFort")?.enabled).toBe(false);
    expect(row(list, "upgradeFort")?.reason).toMatch(/home-card/);
    // The move refuses it too, so the panel and the engine agree.
    expect(buildFort(G, makeCtx([], seat("UK")), "india", 1)).toBe(INVALID_MOVE);
    expect(G.spaces.india.fort).toEqual({power: "UK", level: 1, indian: true});
  });

  test("20.1 Militarism offers only the power's own fort", () => {
    const G = fresh();
    G.spaces.berlin.fort = {power: "GE", level: 1};
    G.spaces.vienna.fort = {power: "AU", level: 1};
    expect(militarismOptions(G, "GE").some((option) => option.id === "fort:berlin")).toBe(true);
    expect(militarismOptions(G, "GE").some((option) => option.id === "fort:vienna")).toBe(false);
    expect(militarismOptions(G, "UK").some((option) => option.benefit === "fort")).toBe(false);
  });
});
