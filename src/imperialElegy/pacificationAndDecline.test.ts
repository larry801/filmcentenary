/**
 * Two small rule-surfacing fixes found by hotseat play:
 *
 *  - 12.1's pacification is not a flat 1 CP (GE pays 2 CP until it unifies and
 *    AU always pays 2), so the Orders row must quote the price the move charges;
 *  - a decision that prints its own decline option must not also get the
 *    panel's generic one, or the seat sees the same 拒绝 twice.
 */
jest.mock("./components/imperial-elegy.css", () => ({}));

import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {pacificationCost} from "./engine/characteristics";
import {declareWar, pacify} from "./moves";
import * as moves from "./moves";
import {spaceActions, type SpaceActionsInput} from "./components/actionAvailability";
import {pendingDeclinesItself} from "./components/PendingPanel";

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

const input = (G: ImperialElegyState, viewer: Power, space: string): SpaceActionsInput => ({
  G,
  viewer,
  space: space as never,
  phase: "action",
  selectedUnit: null,
  cp: G.cpRemaining,
  canAct: true,
  canActionCard: true,
  war: null,
  me: G.powers[viewer],
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
  describeRow: (candidate: {label: string; reason?: string}) => ({label: candidate.label, reason: candidate.reason}),
  locale: "en",
} as never);

describe("12.1 pacification cost", () => {
  test("AU's row quotes 2 CP and the move charges 2 CP", () => {
    const G = fresh();
    beginAction(G, "AU", 4);
    G.spaces.saxony.influence = "AU";
    expect(pacificationCost(G, "AU").cost).toBe(2);
    const row = spaceActions(input(G, "AU", "saxony")).find((entry) => entry.id === "pacify");
    expect(row?.cost).toBe(2);
    expect(row?.enabled).toBe(true);
    const before = G.cpRemaining;
    expect(pacify(G, makeCtx([3, 3], seat("AU")), "saxony")).toBeUndefined();
    expect(before - G.cpRemaining).toBe(2);
  });

  test("a unified Germany pays 1 CP, an ununified one pays 2", () => {
    const G = fresh();
    beginAction(G, "GE", 4);
    G.spaces.saxony.influence = "GE";
    G.powers.GE.unified = false;
    const ununified = spaceActions(input(G, "GE", "saxony")).find((entry) => entry.id === "pacify");
    expect(ununified?.cost).toBe(2);

    const H = fresh();
    beginAction(H, "GE", 4);
    H.spaces.saxony.influence = "GE";
    H.powers.GE.unified = true;
    const unified = spaceActions(input(H, "GE", "saxony")).find((entry) => entry.id === "pacify");
    expect(unified?.cost).toBe(1);
  });
});

describe("pending decisions that print their own decline", () => {
  test("13.4.2's aid search offers exactly one decline", () => {
    const G = fresh();
    beginAction(G, "GE", 4);
    expect(declareWar(G, makeCtx([3], seat("GE")), {minor: "Saxony"}, "conquest", ["saxony"], 2)).toBeUndefined();
    expect(G.pending?.kind).toBe("minorAid");
    expect(G.pending?.options.map((option) => option.id)).toEqual(["aid", "decline"]);
    expect(pendingDeclinesItself(G.pending)).toBe(true);
  });

  test("a decision with no printed decline keeps the generic button", () => {
    expect(pendingDeclinesItself({options: [{id: "aid"}]})).toBe(false);
    expect(pendingDeclinesItself(null)).toBe(false);
  });
});
