/** 15.5: the defending PRIMARY can refuse the attacker's surrender. */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {BattleState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {canSurrender, classifyVictory, createWarState} from "./engine/limitedWar";
import {redactForView} from "./engine/privacy";
import {declinePending, passWarMove, resolvePending, resolveWar, surrender} from "./moves";
import {logText} from "./components/logText";

const ctxFor = (power: Power = "GE"): Ctx => ({
  playerID: String(POWERS.indexOf(power)), random: {Die: () => 3},
  events: {setPhase: jest.fn(), setActivePlayers: jest.fn(), endTurn: jest.fn(), endGame: jest.fn()},
}) as unknown as Ctx;

const fresh = (): ImperialElegyState => {
  const G = setupImperialElegy(ctxFor());
  G.phase = "wartime";
  G.activePower = "GE";
  G.war = createWarState(G, "GE", "FR", "conquest", ["alsace-lorraine"], 2);
  G.war.status = "maneuver";
  G.war.initiative = ["GE", "FR", "UK"];
  G.war.defenderAllies = ["UK"];
  G.war.budgets = {GE: 2, FR: 2, UK: 2};
  return G;
};

test("an offer preserves the war until the defending primary accepts", () => {
  const G = fresh();
  const before = JSON.stringify(G.war);
  const stability = POWERS.map((power) => G.powers[power].stability);
  const ctx = ctxFor();
  expect(surrender(G, ctx)).toBeUndefined();
  expect(JSON.stringify(G.war)).toBe(before);
  expect(POWERS.map((power) => G.powers[power].stability)).toEqual(stability);
  expect(G.pending).toMatchObject({kind: "confirm", power: "FR", context: {special: "attackerSurrender"}});
  expect(G.pending?.options.map((option) => option.id)).toEqual(["accept", "refuse"]);
  expect(ctx.events!.setActivePlayers).toHaveBeenCalledWith({all: "play"});
  expect(passWarMove(G, ctx)).toBe(INVALID_MOVE);
  expect(resolveWar(G, ctx)).toBe(INVALID_MOVE);
  expect(resolvePending(G, ctxFor("FR"), "accept")).toBeUndefined();
  expect(G.war).toMatchObject({status: "victory", victor: "defender"});
  const victory = classifyVictory(G, G.war!);
  expect(victory).toMatchObject({primary: "major", winner: "FR", loser: "GE", treatyOptions: 2});
  // Acceptance chooses the result; the existing victory/treaty step applies it.
  expect(resolveWar(G, ctxFor("FR"))).toBeUndefined();
  expect(G.pending?.kind).toBe("treatyOption");
  expect(G.pending?.power).toBe("FR");
  expect(G.powers.FR.stability).toBe(stability[2] + 1);
  expect(G.powers.GE.stability).toBe(stability[0] - 1);
});

test.each(["refuse", "decline"])("%s resumes the same impulse without spending CP or resetting passes", (answer) => {
  const G = fresh();
  G.activePower = "UK"; // surrender is legal at another player's boundary
  G.war!.passed = ["GE"];
  G.powers.UK.flags.warCpSpentThisImpulse = true;
  const warBefore = JSON.stringify(G.war);
  const powersBefore = JSON.stringify(G.powers);
  expect(surrender(G, ctxFor())).toBeUndefined();
  expect(answer === "decline" ? declinePending(G, ctxFor("FR")) : resolvePending(G, ctxFor("FR"), answer)).toBeUndefined();
  expect(G.pending).toBeNull();
  expect(G.pendingStack).toEqual([]);
  expect(G.activePower).toBe("UK");
  expect(JSON.stringify(G.war)).toBe(warBefore);
  expect(JSON.stringify(G.powers)).toBe(powersBefore);
  expect(G.log.at(-1)?.args?.result).toBe("refused");
});

test("the pending decision survives a JSON save and accepts exactly once", () => {
  let G = fresh();
  surrender(G, ctxFor());
  G = JSON.parse(JSON.stringify(G));
  expect(resolvePending(G, ctxFor("FR"), "accept")).toBeUndefined();
  const before = JSON.stringify(G);
  expect(resolvePending(G, ctxFor("FR"), "accept")).toBe(INVALID_MOVE);
  expect(surrender(G, ctxFor())).toBe(INVALID_MOVE);
  expect(surrender(G, ctxFor("FR"))).toBe(INVALID_MOVE);
  expect(JSON.stringify(G)).toBe(before);
});

test("only the defending primary can answer, with options hidden from other seats", () => {
  const G = fresh();
  surrender(G, ctxFor());
  const before = JSON.stringify(G);
  for (const power of ["GE", "UK", "AU"] as const) {
    expect(resolvePending(G, ctxFor(power), "accept")).toBe(INVALID_MOVE);
  }
  expect(resolvePending(G, ctxFor("FR"), "surrender")).toBe(INVALID_MOVE);
  expect(JSON.stringify(G)).toBe(before);
  expect(redactForView(G, "2", ctxFor()).pending?.options).toHaveLength(2);
  expect(redactForView(G, "1", ctxFor()).pending?.options).toEqual([]);
  expect(redactForView(G, null, ctxFor()).pending?.context).toEqual({});
});

test("a replaced war or changed primary cannot consume a stale surrender decision", () => {
  const G = fresh();
  surrender(G, ctxFor());
  G.war!.defender = "UK";
  const before = JSON.stringify(G);
  expect(resolvePending(G, ctxFor("FR"), "accept")).toBe(INVALID_MOVE);
  expect(JSON.stringify(G)).toBe(before);
});

test("a refusal does not prevent a later surrender offer", () => {
  const G = fresh();
  surrender(G, ctxFor());
  resolvePending(G, ctxFor("FR"), "refuse");
  expect(surrender(G, ctxFor())).toBeUndefined();
  expect(resolvePending(G, ctxFor("FR"), "accept")).toBeUndefined();
  expect(G.war!.victor).toBe("defender");
});

test("the current primary after Balance of Power, not the original defender, decides", () => {
  const G = fresh();
  G.war!.defender = "UK";
  G.war!.defenderAllies = ["FR"];
  expect(surrender(G, ctxFor())).toBeUndefined();
  expect(G.pending?.power).toBe("UK");
  expect(resolvePending(G, ctxFor("FR"), "accept")).toBe(INVALID_MOVE);
  expect(resolvePending(G, ctxFor("UK"), "refuse")).toBeUndefined();
  expect(G.war!.status).toBe("maneuver");
});

test("a defender's surrender is not subject to attacker consent", () => {
  const G = fresh();
  expect(surrender(G, ctxFor("FR"))).toBeUndefined();
  expect(G.pending).toBeNull();
  expect(G.war).toMatchObject({status: "victory", victor: "attacker"});
});

test("13.6 still permits immediate defender surrender before maneuver", () => {
  const G = fresh();
  G.war!.status = "warAim";
  expect(canSurrender(G, "GE")).toBe(false);
  expect(surrender(G, ctxFor())).toBe(INVALID_MOVE);
  expect(surrender(G, ctxFor("FR"))).toBeUndefined();
  expect(G.war!.victor).toBe("attacker");
});

test("an unaided non-player defender receives no impossible player decision", () => {
  const G = fresh();
  G.war = createWarState(G, "GE", "Denmark", "conquest", ["schleswig-holstein"], 2, {minor: {minor: "Denmark", ally: null}});
  G.war.status = "maneuver";
  expect(surrender(G, ctxFor())).toBeUndefined();
  expect(G.pending).toBeNull();
  expect(classifyVictory(G, G.war)).toMatchObject({primary: "defensive", treatyOptions: 0});
});

test("battle, pending decisions, non-wartime phases, outsiders and eliminated powers block surrender", () => {
  const G = fresh();
  expect(surrender(G, ctxFor("UK"))).toBe(INVALID_MOVE);
  expect(surrender(G, ctxFor("AU"))).toBe(INVALID_MOVE);
  G.battle = {stage: "roll"} as BattleState;
  expect(surrender(G, ctxFor())).toBe(INVALID_MOVE);
  G.battle = null;
  G.phase = "gwManeuver";
  expect(surrender(G, ctxFor())).toBe(INVALID_MOVE);
  G.phase = "wartime";
  G.powers.GE.eliminated = true;
  expect(surrender(G, ctxFor())).toBe(INVALID_MOVE);
  G.powers.GE.eliminated = false;
  G.pending = {id: "d0", kind: "confirm", power: "GE", prompt: "Existing choice", options: [], createdAt: 1};
  expect(surrender(G, ctxFor())).toBe(INVALID_MOVE);
  expect(G.war!.victor).toBeNull();
});

test("the public log explains refusal in both languages", () => {
  const G = fresh();
  surrender(G, ctxFor());
  resolvePending(G, ctxFor("FR"), "refuse");
  const entry = G.log.at(-1)!;
  expect(logText(entry, "en")).toContain("war continues");
  expect(logText(entry, "zh_CN")).toContain("战争继续");
});
