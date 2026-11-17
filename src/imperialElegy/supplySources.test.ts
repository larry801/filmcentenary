/** 3.2, 4.9.4 and 5.6: supply uses held home keys and actual wartime allies. */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {createWarState} from "./engine/limitedWar";
import {placeUnit} from "./engine/effects";
import {pass, resolvePending} from "./moves";
import {
  beginImpulseUpkeep, hasLoc, isHomeSpace, isSupplySource,
  italianFriendlySpace, italianHasLoc, italianSupplySource, locFriendlySpace, minorSupplySource,
} from "./engine/rules";

const ctx = {
  playerID: "0", random: {Die: () => 3},
  events: {setPhase: jest.fn(), setActivePlayers: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx;

const blank = (): ImperialElegyState => {
  const G = setupImperialElegy(ctx);
  G.phase = "action";
  G.units = {};
  for (const state of Object.values(G.spaces)) {
    state.control = null;
    state.occupiedBy = null;
    state.ally = null;
    state.influence = null;
    state.homeOverride = null;
    state.units = [];
  }
  for (const power of POWERS) G.powers[power].alliance = "neutral";
  return G;
};

const own = (G: ImperialElegyState, power: Power, ...spaces: string[]) => {
  for (const space of spaces) G.spaces[space].control = power;
};

const war = (G: ImperialElegyState, attacker: Power = "GE", defender: Power = "FR") => {
  G.phase = "wartime";
  G.war = createWarState(G, attacker, defender, "conquest", [], 2);
};

test("a home territory is neither a source nor a second home key", () => {
  const G = blank();
  own(G, "RU", "moscow", "orel");
  expect(isSupplySource(G, "RU", "orel", false)).toBe(false);
  expect(isSupplySource(G, "RU", "moscow")).toBe(false);
  own(G, "RU", "smolensk");
  expect(isSupplySource(G, "RU", "moscow")).toBe(true);
  expect(hasLoc(G, "RU", "orel")).toBe(true);
});

test("a naval base cannot serve as a home key", () => {
  const G = blank();
  own(G, "UK", "london", "malta");
  expect(isSupplySource(G, "UK", "malta", false)).toBe(false);
  expect(isSupplySource(G, "UK", "london")).toBe(false);
});

test("a permanent German home key with no printed track type supplies Germany", () => {
  const G = blank();
  own(G, "GE", "berlin", "saxony");
  G.spaces.saxony.homeOverride = "GE";
  expect(isSupplySource(G, "GE", "saxony")).toBe(true);
});

test("German unification does not turn a foreign-controlled German key into a foreign home", () => {
  const G = blank();
  G.powers.GE.unified = true;
  own(G, "FR", "saxony", "bavaria");
  expect(isHomeSpace(G, "saxony", "FR")).toBe(false);
  expect(isSupplySource(G, "FR", "saxony")).toBe(false);
});

test("a minor supply source must also be a home key, not any home territory", () => {
  const G = blank();
  G.spaces.sinai.control = "Egypt";
  G.spaces.egypt.control = "Egypt";
  expect(minorSupplySource(G, "Egypt", "sinai")).toBe(false);
  expect(minorSupplySource(G, "Egypt", "egypt")).toBe(true);
});

test("peace cannot trace through an ally's land or an influence-only corridor", () => {
  const G = blank();
  own(G, "GE", "berlin", "silesia");
  own(G, "AU", "saxony");
  G.powers.GE.alliance = G.powers.AU.alliance = "teAligned";
  expect(isSupplySource(G, "GE", "berlin")).toBe(false);
  G.spaces.saxony.control = null;
  G.spaces.saxony.influence = "GE";
  expect(isSupplySource(G, "GE", "berlin")).toBe(false);
  own(G, "GE", "saxony");
  expect(isSupplySource(G, "GE", "berlin")).toBe(true);
});

test("a non-participating diplomatic ally is neutral for wartime supply", () => {
  const G = blank();
  war(G);
  own(G, "GE", "berlin", "silesia");
  own(G, "AU", "saxony");
  G.powers.GE.alliance = G.powers.AU.alliance = "teAligned";
  expect(hasLoc(G, "GE", "berlin")).toBe(false);
  G.war!.attackerAllies.push("AU");
  expect(hasLoc(G, "GE", "berlin")).toBe(true);
});

test("a neutral-chit ally who actually joined the war provides a friendly route", () => {
  const G = blank();
  war(G);
  own(G, "GE", "berlin", "silesia");
  own(G, "AU", "saxony");
  G.war!.attackerAllies.push("AU");
  expect(G.powers.AU.alliance).toBe("neutral");
  expect(hasLoc(G, "GE", "berlin")).toBe(true);
});

test("enemy occupation cuts a controlled corridor, friendly occupation opens enemy land", () => {
  const G = blank();
  war(G);
  own(G, "GE", "berlin", "silesia", "saxony");
  G.spaces.saxony.occupiedBy = "FR";
  expect(isSupplySource(G, "GE", "berlin")).toBe(false);
  G.spaces.saxony.control = "FR";
  G.spaces.saxony.occupiedBy = "GE";
  expect(isSupplySource(G, "GE", "berlin")).toBe(true);
});

test("an enemy-occupied or rebel-held home key cannot be a source", () => {
  const G = blank();
  war(G);
  own(G, "GE", "berlin", "pomerania", "prussia");
  G.spaces.berlin.occupiedBy = "FR";
  expect(isSupplySource(G, "GE", "berlin", false)).toBe(false);
  G.spaces.berlin.occupiedBy = null;
  placeUnit(G, "REBEL:Germans", "rebelArmy", "berlin", 1);
  expect(isSupplySource(G, "GE", "berlin")).toBe(false);
});

test("an occupied minor home cannot supply its army despite retained formal control", () => {
  const G = blank();
  war(G);
  G.spaces.saxony.control = "Saxony";
  G.spaces.saxony.ally = "GE";
  G.spaces.saxony.occupiedBy = "FR";
  expect(minorSupplySource(G, "Saxony", "saxony")).toBe(false);
});

test("a land-only trace excludes direct port-to-port sea edges", () => {
  const G = blank();
  own(G, "OT", "greece", "dardanelles", "izmir", "ankara");
  expect(hasLoc(G, "OT", "greece")).toBe(true);
  expect(hasLoc(G, "OT", "greece", {landOnly: true})).toBe(false);
});

test("a closed Suez blocks both the supply trace and the second-home-key connection", () => {
  const G = blank();
  war(G, "UK", "FR");
  own(G, "UK", "london", "india");
  placeUnit(G, "FR", "squadron", "south-atlantic", 2);
  expect(isSupplySource(G, "UK", "london")).toBe(false);
  expect(hasLoc(G, "UK", "india")).toBe(false);
  G.persistent.suezCanal = true;
  expect(isSupplySource(G, "UK", "london")).toBe(true);
  expect(hasLoc(G, "UK", "india")).toBe(true);
});

test("Dardanelles permission also governs the second-key sea trace", () => {
  const G = blank();
  war(G, "RU", "FR");
  own(G, "RU", "sevastopol", "egypt");
  G.spaces.egypt.homeOverride = "RU";
  G.spaces.dardanelles.control = "OT";
  expect(isSupplySource(G, "RU", "sevastopol")).toBe(false);
  G.dardanellesPassages = [{requesting: "RU", granting: "OT", turn: G.turn}];
  expect(isSupplySource(G, "RU", "sevastopol")).toBe(true);
});

test("capital-only traces cannot substitute a pair of overseas home keys", () => {
  const G = blank();
  own(G, "UK", "india", "bengal");
  expect(hasLoc(G, "UK", "india")).toBe(true);
  expect(hasLoc(G, "UK", "india", {capitalOnly: true})).toBe(false);
  own(G, "UK", "london");
  expect(hasLoc(G, "UK", "india", {capitalOnly: true})).toBe(true);
});

test("a severed source pair charges the live impulse loss", () => {
  const G = blank();
  war(G, "RU", "FR");
  G.activePower = "RU";
  own(G, "RU", "moscow", "orel");
  const army = placeUnit(G, "RU", "army", "moscow", 2);
  beginImpulseUpkeep(G, {...ctx, playerID: "4"}, "RU");
  expect(G.units[army.id].steps).toBe(1);
});

test("the last active player still pays upkeep at the next impulse, but not twice within it", () => {
  const G = blank();
  own(G, "GE", "berlin", "pomerania");
  G.activePower = "GE";
  for (const power of POWERS) G.powers[power].hand = power === "GE" ? ["IE-A019"] : [];
  const armies = [0, 1, 2, 3].map(() => placeUnit(G, "GE", "army", "berlin", 2).id);
  beginImpulseUpkeep(G, ctx, "GE");
  expect(G.pending?.kind).toBe("impulseLoss");
  expect(resolvePending(G, ctx, armies[0])).toBeUndefined();
  expect(G.units[armies[0]].steps).toBe(1);
  beginImpulseUpkeep(G, ctx, "GE");
  expect(G.pending).toBeNull();
  // Handing an impulse over without recording a pass (12.0) is only legal once
  // the seat has acted; the flag is what playing a card sets.
  G.powers.GE.flags.actionCpSpentThisImpulse = true;
  expect(pass(G, ctx)).toBeUndefined();
  expect(G.activePower).toBe("GE");
  expect(G.pending?.kind).toBe("impulseLoss");
  expect(resolvePending(G, ctx, armies[1])).toBeUndefined();
  expect(G.units[armies[1]].steps).toBe(1);
});

const italianState = (): ImperialElegyState => {
  const G = blank();
  G.gw = {
    active: true, turn: 1, te: ["FR"], ta: ["GE"], belligerents: ["FR", "GE"],
    neutrals: ["AU", "RU", "UK", "OT"], order: ["FR", "GE", "IT"],
    italyIn: true, usIn: false, italyStability: 3, italyManpower: 3, italyBudget: 2,
    usStability: 3, usManpower: 3, usBudget: 4, trenches: {}, lastColonialWar: null,
    victor: null, outbreakDone: true, nationalWillDone: true, bonusImpulses: [],
  } as GreatWarState;
  G.flags.italySide = "te";
  G.persistent.italyUnified = true;
  G.spaces.rome.control = G.spaces.piedmont.control = "IT";
  return G;
};

test("a neutral GW player's land cannot join Italy's separated home keys", () => {
  const G = italianState();
  own(G, "AU", "tuscany");
  expect(italianFriendlySpace(G, "tuscany")).toBe(false);
  expect(italianSupplySource(G, "rome")).toBe(false);
  expect(italianHasLoc(G, "rome")).toBe(false);
  own(G, "FR", "tuscany");
  expect(italianHasLoc(G, "rome")).toBe(true);
});

test("Italian supply uses the occupying side before the underlying control", () => {
  const G = italianState();
  own(G, "FR", "tuscany");
  G.spaces.rome.occupiedBy = "GE";
  expect(italianSupplySource(G, "rome")).toBe(false);
  G.spaces.tuscany.occupiedBy = "GE";
  expect(italianFriendlySpace(G, "tuscany")).toBe(false);
  G.spaces.tuscany.control = "GE";
  G.spaces.tuscany.occupiedBy = "FR";
  expect(italianFriendlySpace(G, "tuscany")).toBe(true);
  expect(locFriendlySpace(G, "tuscany", "FR")).toBe(true);
});
