import {setupImperialElegy} from "./engine/setup";
import {ImperialElegyGameDef} from "./game";
import {playCard, resolvePending, declareWar, resolveWar, chooseGoal, endPhaseTurn} from "./moves";
import {beginLandBattle, chooseSupport, crt} from "./engine/combat";
import {crisisRoll} from "./engine/greatWar";
import {scoreGame, scoreGoals} from "./engine/victory";
import {GOALS_BY_ID} from "./constant/goals";
import {POWERS} from "./types";
import {SPACES} from "./constant/spaces";
import {recomputeTracks} from "./engine/rules";

const makeCtx = (playerID: string | null = "0") => ({
  playerID,
  random: {Die: (n: number) => 3},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "action",
}) as any;

const fresh = () => setupImperialElegy(makeCtx());

test("CRT matches the printed table", () => {
  expect(crt(4)).toMatchObject({attackerLosses: 0, defenderLosses: 2, victor: "attacker", decisive: true});
  expect(crt(2)).toMatchObject({attackerLosses: 1, defenderLosses: 1, victor: "attacker"});
  expect(crt(-1)).toMatchObject({attackerLosses: 1, defenderLosses: 1, victor: "defender"});
  expect(crt(-4)).toMatchObject({attackerLosses: 2, defenderLosses: 0, victor: "defender", decisive: true});
});

test("Wilhelm II #82 removes Bismarck then itself", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.powers.GE.hand.push("IE-A082");
  const ctx = makeCtx("0");
  expect(playCard(G, ctx, "IE-A082", "event")).toBeUndefined();
  expect(G.removed).toContain("IE-H-GE-1");
  expect(G.removed).toContain("IE-A082");
  expect(G.cpRemaining).toBe(2);
});

test("mandatory Assassination! opens a target power decision", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.powers.GE.hand.push("IE-A017");
  const ctx = makeCtx("0");
  playCard(G, ctx, "IE-A017", "event");
  expect(G.wtt).toBe(1);
  expect(G.pending?.kind).toBe("eventTargetPower");
  const target = G.pending!.options.find((o) => o.id === "FR")!;
  resolvePending(G, ctx, target.id);
  // A17's printed choice belongs to the victim: FR now chooses between losing
  // stability and discarding a random card.
  expect(G.pending?.kind).toBe("eventChoice");
  expect(G.pending?.power).toBe("FR");
  resolvePending(G, makeCtx(String(POWERS.indexOf("FR"))), "discard");
  expect(G.pending).toBeNull();
  expect(G.powers.FR.hand.length).toBeLessThan(4);
});

test("declaring and resolving a limited war", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 4;
  const ctx = makeCtx("0");
  expect(declareWar(G, ctx, "AU", "conquest", ["bohemia"], 2)).toBeUndefined();
  expect(G.war?.attacker).toBe("GE");
  expect(G.phase).toBe("wartime");
  G.spaces.bohemia.control = "GE";
  // [] settles immediately; the interactive treaty chooser is covered by
  // limitedWarIntegration.test.ts.
  resolveWar(G, ctx, []);
  expect(G.war).toBeNull();
  expect(G.phase).toBe("action");
  expect(G.wars).toHaveLength(1);
});

test("land battle resolves and applies losses", () => {
  const G = fresh();
  G.phase = "wartime";
  const ctx = makeCtx("0");
  G.war = {
    attacker: "GE", defender: "RU", attackerAllies: [], defenderAllies: [], attackerMinors: [], defenderMinors: [],
    warAim: "conquest", objectives: ["poland"], status: "maneuver", budgets: {}, initiative: [], treaties: [],
    victor: null, truceTurns: 2, passed: [], startedTurn: 1,
  };
  const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
  expect(battle).not.toBeNull();
  expect(battle!.mainAttack.length).toBeGreaterThan(0);
  expect(battle!.mainDefense.length).toBeGreaterThan(0);
});

test("Great War outbreak scores goals and builds the GW state", () => {
  const G = fresh();
  G.wtt = 5;
  G.powers.GE.alliance = "taCommitted";
  G.powers.AU.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.powers.UK.alliance = "teCommitted";
  G.powers.GE.goals.push("NG-06");
  const ctx = makeCtx("0");
  ctx.random.Die = () => 1;
  crisisRoll(G, ctx, "GE", "test");
  expect(G.gw?.active).toBe(true);
  expect(G.gw!.te).toEqual(["UK", "FR"]);
  expect(G.gw!.ta).toEqual(["GE", "AU"]);
  expect(G.powers.GE.vp).toBeGreaterThanOrEqual(0);
});

test("scoring awards ranked goals only to the selecting player and handles ties", () => {
  const G = fresh();
  G.powers.GE.goals.push("NG-01");
  G.powers.FR.goals.push("NG-17");
  // GE leads European keys, FR second, AU third.
  G.powers.GE.territorialKeys = 12;
  G.powers.FR.territorialKeys = 10;
  G.powers.AU.territorialKeys = 8;
  G.powers.RU.territorialKeys = 7;
  G.powers.UK.territorialKeys = 5;
  G.powers.OT.territorialKeys = 6;
  const scores = scoreGoals(G);
  expect(scores.GE.find((s) => s.goal === "NG-01")!.vp).toBe(3);
  expect(scores.FR.find((s) => s.goal === "NG-17")!.vp).toBe(2);
  // AU did not select the goal and receives no entry.
  expect(scores.AU.find((s) => s.goal === "NG-01")).toBeUndefined();
});

test("National Goal 22 is restored and scores Peace in Our Time", () => {
  const G = fresh();
  G.powers.FR.goals.push("NG-22");
  const scores = scoreGame(G);
  expect(scores.details.FR.find((s) => s.goal === "NG-22")!.vp).toBe(3);
});

test("illegal move leaves state unchanged", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  const before = JSON.stringify(G);
  const ctx = makeCtx("1"); // UK is not active
  playCard(G, ctx, G.powers.UK.hand[0], "cp");
  expect(JSON.stringify(G)).toBe(before);
});

test("playerView hides other hands and goal decks", () => {
  const G = fresh();
  const view = ImperialElegyGameDef.playerView!(G, makeCtx("0"), "0");
  expect(view.powers.GE.hand.length).toBeGreaterThan(0);
  expect(view.powers.UK.hand).toEqual([]);
  expect(view.powers.UK.goalDeck).toEqual([]);
  expect((view as any).handCounts.UK).toBe(G.powers.UK.hand.length);
});

test("pending private context and options are hidden from other seats", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.powers.GE.hand.push("IE-A017");
  const ctx = makeCtx("0");
  playCard(G, ctx, "IE-A017", "event");
  const opponentView = ImperialElegyGameDef.playerView!(G, makeCtx("1"), "1");
  expect(opponentView.pending?.options).toEqual([]);
  expect(opponentView.pending?.context).toEqual({});
  const ownerView = ImperialElegyGameDef.playerView!(G, makeCtx("0"), "0");
  expect(ownerView.pending?.options.length).toBeGreaterThan(0);
});

test("Great War planning and maneuver transitions do not throw", () => {
  const G = fresh();
  G.powers.GE.alliance = "taCommitted";
  G.powers.AU.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.powers.UK.alliance = "teCommitted";
  crisisRoll(G, {...makeCtx("0"), random: {Die: () => 1}}, "GE", "test");
  expect(G.gw?.active).toBe(true);
  const {endGwPlanningMove, gwPass} = require("./moves");
  endGwPlanningMove(G, makeCtx("0"));
  expect(G.phase).toBe("gwManeuver");
  expect(G.gw!.order.length).toBeGreaterThan(0);
  for (let i = 0; i < 6; i += 1) {
    const active = G.activePower;
    gwPass(G, {...makeCtx(String(POWERS.indexOf(active)))});
    if (G.phase === "gwWinter") break;
  }
  expect(["gwManeuver", "gwWinter"]).toContain(G.phase);
});

test("Great War winter resolves colonial war and advances the turn", () => {
  const G = fresh();
  G.powers.GE.alliance = "taCommitted";
  G.powers.AU.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.powers.UK.alliance = "teCommitted";
  crisisRoll(G, {...makeCtx("0"), random: {Die: () => 1}}, "GE", "test");
  const before = G.gw!.turn;
  const {winter} = require("./engine/greatWar");
  winter(G, makeCtx("0"));
  expect(G.gw!.turn).toBe(before + 1);
  expect(G.gw!.lastColonialWar).toBeTruthy();
});

test("the campaign ends after turn 7 without the Great War", () => {
  const G = fresh();
  G.phase = "end";
  G.turn = 8;
  G.flags.turnEnded = 7;
  G.powers.GE.vp = 6;
  G.powers.FR.vp = 4;
  const ctx = makeCtx("0");
  for (const p of POWERS) {
    G.powers[p].flags.endDone = false;
  }
  for (let i = 0; i < POWERS.length; i += 1) {
    endPhaseTurn(G, {...ctx, playerID: String(i)});
  }
  expect(G.result).not.toBeNull();
  expect(G.result!.winners).toContain("GE");
  expect(G.gw).toBeNull();
});

test("response cards can be played at the start of an impulse", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.powers.GE.hand.push("IE-A041");
  const ctx = makeCtx("0");
  const {playResponseCard} = require("./moves");
  expect(playResponseCard(G, ctx, "IE-A041")).toBeUndefined();
  expect(G.powers.GE.hand).not.toContain("IE-A041");
  expect(G.discard).toContain("IE-A041");
  expect(G.pending).toBeNull();
});

test("combat cards are offered in the battle card window", () => {
  const G = fresh();
  G.phase = "wartime";
  G.powers.GE.hand.push("IE-A043");
  const ctx = makeCtx("0");
  const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
  expect(battle).not.toBeNull();
  chooseSupport(G, ctx, "done");
  chooseSupport(G, ctx, "done");
  expect(G.pending?.kind).toBe("combatCard");
  expect(G.pending?.options.some((o) => o.id === "card:IE-A043")).toBe(true);
  resolvePending(G, ctx, "card:IE-A043");
  expect(G.powers.GE.hand).not.toContain("IE-A043");
  expect(G.battle?.attackerDrm).toBeGreaterThan(0);
});

test("Great War victory produces a result", () => {
  const G = fresh();
  G.powers.GE.alliance = "taCommitted";
  G.powers.AU.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.powers.UK.alliance = "teCommitted";
  crisisRoll(G, {...makeCtx("0"), random: {Die: () => 1}}, "GE", "test");
  const {endGreatWar} = require("./engine/greatWar");
  G.gw!.victor = "te";
  G.gw!.turn = 5;
  endGreatWar(G, makeCtx("0"), "turnLimit");
  expect(G.result).not.toBeNull();
  expect(G.result!.reason).toBe("greatWar:te");
  expect(G.result!.winners).toEqual(["UK", "FR"]);
});

test("save card marks a card for next turn", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  const {cardById} = require("./engine/deck");
  const card = G.powers.GE.hand.find((id: string) => !["mandatory", "mandatoryResponse"].includes(cardById(id).type)) ?? G.powers.GE.hand[0];
  const {saveCard} = require("./moves");
  expect(saveCard(G, makeCtx("0"), card)).toBeUndefined();
  expect(String(G.powers.GE.flags.savedCards)).toContain(card);
});

test("spending 1 CP places major power influence", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 2;
  const {placeMpit} = require("./moves");
  expect(placeMpit(G, makeCtx("0"), "RU", "te")).toBeUndefined();
  expect(G.powers.RU.mpit.te).toBe(1);
  expect(G.cpRemaining).toBe(1);
});
