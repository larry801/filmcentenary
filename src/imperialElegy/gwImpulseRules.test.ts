import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {ImperialElegyState, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {outbreakGreatWar} from "./engine/greatWar";
import {placeUnit} from "./engine/effects";
import {advanceGwImpulse, performGwManeuver, startGwManeuver, transferGwBudget} from "./engine/greatWarFlow";
import {beginGwImpulse, gwActionAllowance, gwCardProblem, gwFinishImpulseProblem} from "./engine/gwImpulse";
import {gwEliteCorps, gwEndTurn, gwMarch, gwPass, gwRefit, gwRefitFleet, playGwCardMove, resolvePending} from "./moves";
import {redactForView} from "./engine/privacy";

const ctx = (power: Power): Ctx => ({
  playerID: String(POWERS.indexOf(power)), random: {Die: () => 3, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: jest.fn(), setPhase: jest.fn(), endGame: jest.fn()},
}) as unknown as Ctx;

const game = (): ImperialElegyState => {
  const G = setupImperialElegy(ctx("GE"));
  for (const p of POWERS) G.powers[p].alliance = p === "GE" ? "taCommitted" : p === "FR" ? "teCommitted" : "neutral";
  outbreakGreatWar(G, ctx("GE"), "GE", "impulse rules");
  G.units = {};
  for (const space of Object.values(G.spaces)) space.units = [];
  G.gw!.turn = 1;
  G.phase = "gwPlanning";
  for (const p of POWERS) {
    G.powers[p].gwCard = null;
    G.powers[p].gwBudget = 5;
    G.powers[p].reserves = [];
  }
  startGwManeuver(G, ctx("GE"));
  return G;
};

test("one budget action, no arbitrary winter skip, and completion does not record a pass", () => {
  const G = game();
  const army = placeUnit(G, "GE", "army", "berlin", 1);
  expect(gwPass(G, ctx("GE"))).toBe(INVALID_MOVE);
  expect(gwEndTurn(G, ctx("GE"))).toBe(INVALID_MOVE);
  expect(gwRefit(G, ctx("GE"), army.id)).toBeUndefined();
  const before = JSON.stringify(G);
  expect(gwMarch(G, ctx("GE"), army.id, "pomerania")).toBe(INVALID_MOVE);
  expect(JSON.stringify(G)).toBe(before);
  expect(G.powers.GE.gwBudget).toBe(4);
  expect(gwPass(G, ctx("GE"))).toBeUndefined();
  expect(G.activePower).toBe("FR");
  expect(G.powers.GE.flags.passedGw).toBe(false);
});

test("a card funds one immediate different action, cannot be banked or used for a land battle", () => {
  const G = game();
  const army = placeUnit(G, "GE", "army", "berlin", 1);
  G.powers.GE.gwCard = "IE-GW-03";
  expect(playGwCardMove(G, ctx("GE"), "cp")).toBeUndefined();
  expect(G.powers.GE.gwBudget).toBe(5);
  expect(gwPass(G, ctx("GE"))).toBe(INVALID_MOVE);
  expect(gwRefit(G, ctx("GE"), army.id)).toBeUndefined();
  expect(G.powers.GE.gwBudget).toBe(5);
  expect(gwActionAllowance(G, "GE", "refit")).toMatchObject({ok: false, reason: "repeatAction"});
  expect(gwActionAllowance(G, "GE", "landBattle")).toMatchObject({ok: false, reason: "bonusLandBattle"});
  expect(gwMarch(G, ctx("GE"), army.id, "pomerania")).toBeUndefined();
  expect(G.powers.GE.gwBudget).toBe(4);
  expect(gwActionAllowance(G, "GE", "rail")).toMatchObject({ok: false, reason: "actionUsed"});
  // 27.1/27.2: the card is faceup at the table once played, and the log
  // announces it (`gwCardPlayed`), so the ledger may name it from then on.  A
  // card still in hand is private because `cardId` is only written at the play.
  const seen = redactForView(G, "2").gw!.impulse!;
  expect(seen.cardPlayed).toBe(true);
  expect(seen.cardId).toBe("IE-GW-03");
});

test("card bonus after the last ordinary CP works and survives JSON saves", () => {
  let G = game();
  G.powers.GE.gwBudget = 1;
  G.powers.GE.gwCard = "IE-GW-03";
  const army = placeUnit(G, "GE", "army", "berlin", 1);
  expect(gwRefit(G, ctx("GE"), army.id)).toBeUndefined();
  expect(playGwCardMove(G, ctx("GE"), "cp")).toBeUndefined();
  G = JSON.parse(JSON.stringify(G));
  expect(gwMarch(G, ctx("GE"), army.id, "pomerania")).toBeUndefined();
  expect(G.powers.GE.gwBudget).toBe(0);
  expect(gwPass(G, ctx("GE"))).toBeUndefined();
});

test("Exhaustion triggers its event even in CP mode and grants a separate bonus", () => {
  const G = game();
  G.powers.GE.gwBudget = 1;
  G.powers.GE.gwCard = "IE-GW-10";
  const army = placeUnit(G, "GE", "army", "berlin", 1);
  expect(gwRefit(G, ctx("GE"), army.id)).toBe(INVALID_MOVE);
  expect(playGwCardMove(G, ctx("GE"), "cp")).toBeUndefined();
  expect(G.pending?.context?.special).toBe("gwExhaustion");
  expect(resolvePending(G, ctx("GE"), "stability")).toBeUndefined();
  expect(G.persistent.exhaustion).not.toBe("stability");
  expect(gwRefit(G, ctx("GE"), army.id)).toBeUndefined();
  expect(gwMarch(G, ctx("GE"), army.id, "pomerania")).toBeUndefined();
  expect(gwPass(G, ctx("GE"))).toBeUndefined();
  expect(G.persistent.exhaustion).toBe("stability");
});

test("normal events require the actor's action and cannot be played during planning or another seat", () => {
  const G = game();
  G.powers.GE.gwCard = "IE-GW-08";
  expect(gwCardProblem(G, "GE", "event")).toBe("mustAct");
  expect(playGwCardMove(G, ctx("FR"), "cp")).toBe(INVALID_MOVE);
  const army = placeUnit(G, "GE", "army", "berlin", 1);
  gwRefit(G, ctx("GE"), army.id);
  expect(gwCardProblem(G, "GE", "event")).toBeNull();
  G.phase = "gwPlanning";
  expect(playGwCardMove(G, ctx("GE"), "event")).toBe(INVALID_MOVE);
});

test("an action resets all earlier passes; an unused budget <=2 may pass", () => {
  const G = game();
  G.powers.GE.gwBudget = 2;
  expect(gwPass(G, ctx("GE"))).toBeUndefined();
  expect(G.powers.GE.flags.passedGw).toBe(true);
  const army = placeUnit(G, "FR", "army", "paris", 1);
  expect(gwRefit(G, ctx("FR"), army.id)).toBeUndefined();
  expect(G.powers.GE.flags.passedGw).toBe(false);
  expect(gwPass(G, ctx("FR"))).toBeUndefined();
  expect(G.activePower).toBe("GE");
});

test("neutral event-only impulses run in seat order before winter, with saved continuation", () => {
  let G = game();
  G.powers.GE.gwBudget = G.powers.FR.gwBudget = 0;
  expect(gwPass(G, ctx("GE"))).toBeUndefined();
  expect(G.activePower).toBe("UK");
  expect(G.gw!.neutralImpulses).toMatchObject({order: ["UK", "AU", "RU", "OT"], index: 0});
  G.powers.UK.gwCard = "IE-GW-08";
  expect(gwCardProblem(G, "UK", "cp")).toBe("battleCard");
  expect(playGwCardMove(G, ctx("UK"), "event")).toBeUndefined();
  expect(G.phase).toBe("gwManeuver");
  G = JSON.parse(JSON.stringify(G));
  for (const power of ["UK", "AU", "RU", "OT"] as Power[]) {
    expect(G.activePower).toBe(power);
    expect(gwPass(G, ctx(power))).toBeUndefined();
  }
  expect(G.phase).toBe("gwWinter");
});

test("a neutral impulse cannot open GW #2 on GW turn 0, and GW #5 needs a facedown card", () => {
  const G = game();
  G.gw!.turn = 0;
  G.powers.GE.gwBudget = G.powers.FR.gwBudget = 0;
  expect(gwPass(G, ctx("GE"))).toBeUndefined();
  expect(G.gw!.neutralImpulses).toMatchObject({order: ["UK", "AU", "RU", "OT"], index: 0});
  // GW #2 is printed "cannot be played on GW turn 0": without a side there is
  // no major to bring in, and without a unified Italy there is no offer.
  G.powers.UK.gwCard = "IE-GW-02";
  expect(gwCardProblem(G, "UK", "event")).toBe("cardWindow");
  expect(playGwCardMove(G, ctx("UK"), "event")).toBe(INVALID_MOVE);
  G.gw!.neutralImpulses = {order: ["OT"], index: 0};
  G.activePower = "OT";
  G.powers.OT.gwCard = "IE-GW-02";
  expect(gwCardProblem(G, "OT", "event")).toBe("cardWindow");
  // GW #5's normal event flips a facedown card; with none the UI and the
  // engine must both refuse it.
  G.powers.OT.gwCard = "IE-GW-05";
  G.gw!.combatCardsInFront = [];
  expect(gwCardProblem(G, "OT", "event")).toBe("cardWindow");
  expect(playGwCardMove(G, ctx("OT"), "event")).toBe(INVALID_MOVE);
});

test("a major acts every cycle on its own budget and cannot move the commanding player's army", () => {
  const G = game();
  G.gw!.usIn = true;
  G.flags.usSide = "te";
  G.gw!.usBudget = 4;
  G.gw!.order.push("US");
  const us = placeUnit(G, "US", "usArmy", "the-south", 2);
  const fr = placeUnit(G, "FR", "army", "paris", 2);
  G.turnIndex = 1;
  G.activePower = "FR";
  expect(advanceGwImpulse(G, ctx("FR"))).toMatchObject({kind: "ally", slot: "US"});
  expect(gwMarch(G, ctx("FR"), fr.id, "champagne")).toBe(INVALID_MOVE);
  const destination = "mexico";
  G.spaces[destination].control = "US";
  const move = performGwManeuver(G, ctx("FR"), {kind: "rail", power: "FR", unitId: us.id, to: destination});
  expect(move.ok).toBe(true);
  expect(G.gw!.usBudget).toBe(3);
  expect(G.powers.FR.gwBudget).toBe(5);
  expect(gwPass(G, ctx("FR"))).toBeUndefined();
  G.turnIndex = 1;
  G.activePower = "FR";
  expect(advanceGwImpulse(G, ctx("FR"))).toMatchObject({kind: "ally", slot: "US"});
  expect(gwFinishImpulseProblem(G, "FR")).toBe("mustAct");
});

test("fleet refit needs a port; an EC joins a supplied friendly army outside home territory", () => {
  const G = game();
  const fleet = placeUnit(G, "GE", "squadron", "london", 1);
  expect(gwRefitFleet(G, ctx("GE"), fleet.id)).toBe(INVALID_MOVE);
  G.spaces.london.units = [];
  fleet.space = "pomerania";
  G.spaces.pomerania.units.push(fleet.id);
  expect(gwRefitFleet(G, ctx("GE"), fleet.id)).toBeUndefined();
  beginGwImpulse(G, "GE");
  G.spaces.saxony.control = "GE";
  const army = placeUnit(G, "GE", "army", "saxony", 2);
  expect(gwEliteCorps(G, ctx("GE"), army.id)).toBeUndefined();
  expect(Object.values(G.units).find((u) => u.kind === "eliteCorps")).toMatchObject({space: "saxony", attachedTo: army.id});
});

test("planning transfer is exactly one CP and requires a real LoC", () => {
  const G = game();
  G.phase = "gwPlanning";
  G.gw!.ta.push("AU");
  G.gw!.belligerents.push("AU");
  expect(transferGwBudget(G, ctx("GE"), "GE", "AU", 2).ok).toBe(false);
  expect(transferGwBudget(G, ctx("GE"), "GE", "AU", 1).ok).toBe(true);
  expect(transferGwBudget(G, ctx("GE"), "GE", "AU", 1).ok).toBe(false);
});
