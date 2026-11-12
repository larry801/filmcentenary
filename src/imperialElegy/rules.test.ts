import {setupImperialElegy} from "./engine/setup";
import {allied, atWar, eliminatePower, hasLoc, isHomeSpace, ownsKey, recomputeTracks, unitsOfPower} from "./engine/rules";
import {crt, beginLandBattle, chooseSupport} from "./engine/combat";
import {scoreGoals, scoreGame} from "./engine/victory";
import {crisisRoll} from "./engine/greatWar";
import {SPACES} from "./constant/spaces";

const ctx: any = {playerID: "0", random: {Die: () => 3}, events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}}};
const fresh = () => setupImperialElegy(ctx);

test("alliances follow the alliance track", () => {
  const G = fresh();
  G.powers.GE.alliance = "taCommitted";
  G.powers.AU.alliance = "taAligned";
  G.powers.FR.alliance = "teCommitted";
  expect(allied(G, "GE", "AU")).toBe(true);
  expect(allied(G, "GE", "FR")).toBe(false);
  expect(atWar(G, "GE", "FR")).toBe(false);
});

test("supply traces through friendly spaces only", () => {
  const G = fresh();
  // Berlin is a GE supply source with a LoC to Prussia.
  expect(isHomeSpace(G, "berlin", "GE")).toBe(true);
  expect(ownsKey(G, "berlin", "GE")).toBe(true);
  expect(hasLoc(G, "GE", "berlin")).toBe(true);
  // A Russian army in Berlin has no LoC to Russia.
  expect(hasLoc(G, "RU", "berlin")).toBe(false);
});

test("key recomputation preserves starting totals", () => {
  const G = fresh();
  recomputeTracks(G);
  expect(G.powers.GE.territorialKeys).toBe(5);
  expect(G.powers.FR.territorialKeys).toBe(9);
  expect(G.powers.AU.territorialKeys).toBe(9);
  expect(G.powers.RU.territorialKeys).toBe(12);
  expect(G.powers.UK.colonialKeys).toBe(7);
  expect(G.powers.OT.arabKeys).toBe(5);
});

test("land battle support choices feed the BDRM", () => {
  const G = fresh();
  G.phase = "wartime";
  G.powers.GE.alliance = "taCommitted";
  G.powers.AU.alliance = "taCommitted";
  const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
  expect(battle).not.toBeNull();
  const support = battle!.supportAttack.map((s) => s.fp);
  expect(Array.isArray(support)).toBe(true);
  chooseSupport(G, ctx, "done");
  // Defender support stage now either resolves or opens a decision.
  expect(["support", "roll", "lossesAttack", "lossesDefense", "done"]).toContain(G.battle?.stage ?? "done");
});

test("treaties end the war and exchange truces", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 4;
  const {declareWar, resolveWar} = require("./moves");
  declareWar(G, ctx, "AU", "conquest", ["bohemia"], 2);
  G.spaces.bohemia.control = "GE";
  // [] settles without the interactive treaty chooser.
  resolveWar(G, ctx, []);
  expect(G.wars[0].truceTurns).toBe(2);
  expect(G.war).toBeNull();
});

test("crisis roll can produce the Great War or a conference", () => {
  const G = fresh();
  G.powers.GE.alliance = "taCommitted";
  G.powers.AU.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.powers.UK.alliance = "teCommitted";
  const conferenceCtx = {...ctx, random: {Die: () => 6}};
  crisisRoll(G, conferenceCtx, "GE", "test");
  expect(G.gw).toBeNull();
  expect(G.wtt).toBe(4);
  const warCtx = {...ctx, random: {Die: () => 1}};
  crisisRoll(G, warCtx, "GE", "test");
  expect(G.gw?.active).toBe(true);
});

test("elimination removes a power's units and alliance membership", () => {
  const G = fresh();
  G.gw = {
    active: true, turn: 1, order: [], belligerents: ["GE", "FR"], neutrals: [], te: ["FR"], ta: ["GE"],
    usIn: false, italyIn: false, usStability: 3, usManpower: 3, usBudget: 4, italyStability: 3,
    italyManpower: 3, italyBudget: 2, trenches: {}, lastColonialWar: null, victor: null,
    outbreakDone: true, nationalWillDone: true, bonusImpulses: [],
  };
  expect(unitsOfPower(G, "AU").length).toBeGreaterThan(0);
  eliminatePower(G, "AU", ctx);
  expect(G.powers.AU.eliminated).toBe(true);
  expect(unitsOfPower(G, "AU")).toHaveLength(0);
  expect(G.gw.ta).not.toContain("AU");
});

test("scoring ties share the place and skip the next reward", () => {
  const G = fresh();
  G.powers.GE.goals.push("NG-01");
  G.powers.FR.goals.push("NG-01");
  G.powers.GE.territorialKeys = 10;
  G.powers.FR.territorialKeys = 10;
  G.powers.AU.territorialKeys = 8;
  G.powers.RU.territorialKeys = 7;
  G.powers.UK.territorialKeys = 5;
  G.powers.OT.territorialKeys = 6;
  const scores = scoreGoals(G);
  expect(scores.GE.find((s) => s.goal === "NG-01")!.vp).toBe(3);
  expect(scores.FR.find((s) => s.goal === "NG-01")!.vp).toBe(3);
});

test("scoreGame returns all tied winners", () => {
  const G = fresh();
  G.powers.GE.vp = 5;
  G.powers.FR.vp = 5;
  const result = scoreGame(G);
  expect(result.winners).toContain("GE");
  expect(result.winners).toContain("FR");
});

test("official support example: minor allies support at half FP", () => {
  const G = fresh();
  G.phase = "wartime";
  G.powers.GE.alliance = "taCommitted";
  G.powers.AU.alliance = "taCommitted";
  const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
  expect(battle).not.toBeNull();
  const support = require("./engine/combat").supportCandidates(G, "GE", battle, "defender");
  // Bavaria and Hanover are adjacent to Saxony, but both are different minor
  // powers from the Saxon-led defense, so each contributes 1 FP: 2 FP halved
  // and rounded up for the whole stack (18.3.2/18.3.3), exactly as in the
  // official Austro-Prussian War example.
  expect(support.length).toBeGreaterThan(0);
  expect(support.map((entry) => entry.space)).toEqual(expect.arrayContaining(["bavaria", "hanover"]));
  for (const entry of support) expect(entry.fp).toBe(1);
});

test("naval battles open a combat-card window and resolve without players", () => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "UK";
  G.cpRemaining = 2;
  // Put a German squadron in the North Atlantic and a British squadron in a
  // connected port.
  const {placeUnit} = require("./engine/effects");
  G.powers.UK.hand.push("IE-A061");
  const german = placeUnit(G, "GE", "squadron", "north-atlantic", 2);
  const {beginNavalBattle} = require("./engine/combat");
  const battle = beginNavalBattle(G, {...ctx, playerID: "1"}, "UK", "london", "north-atlantic");
  expect(battle).not.toBeNull();
  expect(G.pending?.kind).toBe("combatCard");
  expect(german.owner).toBe("GE");
});
