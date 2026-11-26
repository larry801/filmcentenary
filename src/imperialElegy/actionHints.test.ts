/**
 * The dock's "what now" lines (components/actionHints.ts).
 *
 * The solo Historical Great War stalled because the board named the rule but
 * not the control: "play Exhaustion" never said where the card is, and "spend a
 * war-budget CP" never said an action starts with a map click.  These tests
 * pin the control paths, the live numbers, and the order of priority between an
 * owed decision and an available action.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {beginGwImpulse} from "./engine/gwImpulse";
import {EXHAUSTION_CARD} from "./engine/characteristics";
import {actionHints} from "./components/actionHints";
import {ieStringsFor} from "./components/i18n";

const makeCtx = (die = 3): Ctx =>
  ({
    playerID: "0",
    random: {Die: (_sides: number) => die},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "prep",
  }) as unknown as Ctx;

const en = ieStringsFor("en");
const zh = ieStringsFor("zh_CN");

const gwState = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx(), {scenario: "gwTutorial"});
  G.phase = "gwManeuver";
  G.gw!.active = true;
  G.gw!.turn = 0;
  G.gw!.belligerents = ["GE", "AU", "FR", "UK", "RU"];
  G.gw!.neutralImpulses = 0;
  G.gw!.order = ["GE", "RU", "AU", "FR", "bonus", "UK"];
  G.turnIndex = 0;
  G.activePower = "GE";
  beginGwImpulse(G, "GE");
  G.powers.GE.gwBudget = 7;
  return G;
};

const keys = (hints: {key: string}[]): string[] => hints.map((h) => h.key);
const words = (hints: {text: string}[]): string => hints.map((h) => h.text).join(" | ");

test("an unused impulse with budget above 2 names the map click and the Orders actions", () => {
  const G = gwState();
  const hints = actionHints(G, "GE", "zh_CN", zh);
  expect(keys(hints)).toEqual(["gwAct", "gwActBudget"]);
  expect(words(hints)).toContain("行军");
  expect(words(hints)).toContain("战争预算 7");
});

test("Exhaustion in hand names the hand tray and its event button, not just the card", () => {
  const G = gwState();
  G.powers.GE.gwCard = EXHAUSTION_CARD;
  const hints = actionHints(G, "GE", "zh_CN", zh);
  expect(keys(hints)).toEqual(["gwExhaustion", "gwExhaustionBudget"]);
  expect(words(hints)).toContain("手牌区");
  expect(words(hints)).toContain("打出事件");
});

test("a completed action points at the end-impulse button", () => {
  const G = gwState();
  G.gw!.impulse = {...G.gw!.impulse!, acted: true, budgetAction: "march"};
  const hints = actionHints(G, "GE", "en", en);
  expect(keys(hints)).toEqual(["gwDone"]);
  expect(words(hints)).toContain("End impulse");
});

test("an unused impulse at budget 2 offers the pass", () => {
  const G = gwState();
  G.powers.GE.gwBudget = 2;
  const hints = actionHints(G, "GE", "en", en);
  expect(keys(hints)).toEqual(["gwPass"]);
  expect(words(hints)).toContain("Pass");
});

test("a card bonus that is still owed names the non-land-battle restriction", () => {
  const G = gwState();
  G.gw!.impulse = {...G.gw!.impulse!, bonusPending: true, acted: true};
  const hints = actionHints(G, "GE", "zh_CN", zh);
  expect(keys(hints)).toEqual(["gwBonus"]);
  expect(words(hints)).toContain("非陆战");
});

test("another seat's impulse, and a neutral window, print no action lines", () => {
  const G = gwState();
  expect(actionHints(G, "FR", "en", en)).toEqual([]);
  G.gw!.neutralImpulses = 1;
  expect(keys(actionHints(G, "GE", "en", en))).toEqual(["gwNeutral"]);
});

test("planning and winter each describe what happens next", () => {
  const G = gwState();
  G.phase = "gwPlanning";
  expect(keys(actionHints(G, "GE", "en", en))).toEqual(["gwPlanning"]);
  G.phase = "gwWinter";
  expect(keys(actionHints(G, "GE", "en", en))).toEqual(["gwWinter"]);
});

test("an owed decision outranks every action line and is only shown to its owner", () => {
  const G = gwState();
  G.pending = {
    kind: "gwBonusImpulse",
    power: "GE",
    prompt: "Choose the bonus-impulse player",
    options: [{id: "GE", label: "GE"}, {id: "AU", label: "AU"}],
  } as ImperialElegyState["pending"];
  expect(keys(actionHints(G, "GE", "zh_CN", zh))).toEqual(["decision"]);
  expect(actionHints(G, "FR", "zh_CN", zh)).toEqual([]);
});

test("the campaign action phase names the card or the CP spend", () => {
  const G = gwState();
  G.phase = "action";
  G.gw = undefined;
  G.cpRemaining = 0;
  expect(keys(actionHints(G, "GE", "en", en))).toEqual(["actionPlayCard"]);
  G.cpRemaining = 2;
  const hints = actionHints(G, "GE", "zh_CN", zh);
  expect(keys(hints)).toEqual(["actionSpendCp"]);
  expect(words(hints)).toContain("剩余 2 点 CP");
});

test("the campaign action phase adds one opportunity line after the CP line", () => {
  const G = setupImperialElegy(makeCtx(), {});
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 2;
  G.pending = null;
  G.battle = null;
  // GE holds five German keys at setup; two more leave it one short of the
  // printed eight.
  G.spaces.hanover.control = "GE";
  G.spaces.saxony.control = "GE";
  const hints = actionHints(G, "GE", "zh_CN", zh);
  expect(keys(hints)).toEqual(["actionSpendCp", "flashpointOpportunity"]);
  expect(words(hints)).toContain("再取 1 个德意志关键区");

  // With no flashpoint in reach, the projection chase fills the same slot.
  const P = setupImperialElegy(makeCtx(), {});
  P.phase = "action";
  P.activePower = "FR";
  P.cpRemaining = 1;
  P.pending = null;
  P.battle = null;
  P.powers.FR.flags.powerProjection = 7; // UK leads at 8
  const projection = actionHints(P, "FR", "en", en);
  expect(keys(projection)).toEqual(["actionSpendCp", "projectionOpportunity"]);
  expect(words(projection)).toContain("one behind United Kingdom");
});

test("a finished game prints no prompt", () => {
  const G = gwState();
  G.result = {reason: "endOfTurn7", winners: ["GE" as Power], vp: {}} as ImperialElegyState["result"];
  expect(actionHints(G, "GE", "en", en)).toEqual([]);
});

test("the diplomacy hint follows the step the seat actually owes", () => {
  const campaign = (): ImperialElegyState => {
    const G = setupImperialElegy(makeCtx(), {});
    G.phase = "diplomacy";
    G.activePower = "GE";
    for (const power of ["GE", "UK", "FR", "AU", "RU", "OT"] as Power[]) {
      G.powers[power].flags.negotiationDone = false;
      G.powers[power].flags.homeChosen = false;
      G.powers[power].selectedHomeCard = null;
    }
    return G;
  };
  // 9.1: a seat still at the table is told to end its negotiation.
  const open = campaign();
  expect(keys(actionHints(open, "GE", "zh_CN", zh))).toEqual(["diplomacy"]);
  expect(words(actionHints(open, "GE", "zh_CN", zh))).toContain("结束谈判");

  // Once its own negotiation is done but another seat's is not, the seat waits
  // instead of repeating a button it has already pressed.
  const waiting = campaign();
  waiting.powers.GE.flags.negotiationDone = true;
  expect(keys(actionHints(waiting, "GE", "zh_CN", zh))).toEqual(["diplomacyWaiting"]);
  expect(words(actionHints(waiting, "GE", "zh_CN", zh))).toContain("5 个席位未结束谈判");

  // 11.2: with the table closed, the owed click is the home card, not a
  // negotiation that no longer exists.
  const homeCard = campaign();
  for (const power of ["GE", "UK", "FR", "AU", "RU", "OT"] as Power[]) {
    homeCard.powers[power].flags.negotiationDone = true;
  }
  homeCard.powers.GE.homeCards = ["IE-H-GE-1"];
  const owed = actionHints(homeCard, "GE", "zh_CN", zh);
  expect(keys(owed)).toEqual(["diplomacyHomeCard"]);
  expect(words(owed)).toContain("选择本土牌");
  expect(words(owed)).not.toContain("结束谈判");

  // A seat that has chosen is only waiting for the rest of the table.
  homeCard.powers.GE.selectedHomeCard = "IE-H-GE-1";
  homeCard.powers.GE.flags.homeChosen = true;
  expect(keys(actionHints(homeCard, "GE", "en", en))).toEqual(["diplomacyDone"]);
});
