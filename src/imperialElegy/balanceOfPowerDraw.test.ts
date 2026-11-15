/** UK home-card text: the UK chooses ONE invited joiner for a post-war draw. */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {ImperialElegyState, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {redactForView} from "./engine/privacy";
import {
  BALANCE_OF_POWER_CARD, callWarAlly, chooseWarAim, declareWar,
  declinePending, playBalanceOfPower, resolvePending, resolveWar,
} from "./moves";

const ctxFor = (power: Power = "GE") => ({
  playerID: String(POWERS.indexOf(power)), random: {Die: () => 3},
  events: {setPhase: jest.fn(), setActivePlayers: jest.fn(), endTurn: jest.fn(), endGame: jest.fn()},
}) as unknown as Ctx;

const intervention = (): ImperialElegyState => {
  const G = setupImperialElegy(ctxFor());
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 4;
  G.powers.GE.alliance = "taAligned";
  expect(declareWar(G, ctxFor(), "FR", "conquest", ["alsace-lorraine"], 2)).toBeUndefined();
  expect(chooseWarAim(G, ctxFor(), "conquest")).toBeUndefined();
  G.powers.UK.hand = [BALANCE_OF_POWER_CARD];
  expect(playBalanceOfPower(G, ctxFor("UK"))).toBeUndefined();
  expect(resolvePending(G, ctxFor("FR"), "accept")).toBeUndefined();
  return G;
};

const invite = (G: ImperialElegyState, power: Power, accept = true) => {
  G.powers[power].hand = ["IE-A019"];
  expect(callWarAlly(G, ctxFor("UK"), power)).toBeUndefined();
  const option = accept ? G.pending!.options.find((o) => o.id.startsWith("accept"))!.id : "refuse";
  expect(resolvePending(G, ctxFor(power), option)).toBeUndefined();
};

const hands = (G: ImperialElegyState) => Object.fromEntries(POWERS.map((power) => [power, G.powers[power].hand.length]));
const expectDraws = (G: ImperialElegyState, before: Record<string, number>, chosen?: Power) => {
  for (const power of POWERS) expect(G.powers[power].hand.length).toBe(before[power] + (power === "UK" || power === chosen ? 1 : 0));
};

test.each(["interactive", "explicit"])("%s settlement lets the UK choose its second invitee", (mode) => {
  let G = intervention();
  invite(G, "AU");
  invite(G, "RU");
  expect(G.war!.postWarDrawCandidates).toEqual(["AU", "RU"]);
  expect(G.war!.postWarDraws).toEqual(["UK"]);
  G.spaces.london.occupiedBy = "GE";
  const before = hands(G);
  const stability = G.powers.GE.stability;
  expect(resolveWar(G, ctxFor(), mode === "explicit" ? [] : undefined)).toBeUndefined();
  if (mode === "interactive") {
    expect(G.pending?.kind).toBe("treatyOption");
    expect(resolvePending(G, ctxFor(), "done")).toBeUndefined();
  }
  expect(G.pending?.context?.special).toBe("balanceOfPowerDraw");
  expect(G.pending?.power).toBe("UK");
  expect(G.pending?.options.map((o) => o.id)).toEqual(["AU", "RU"]);
  expect(hands(G)).toEqual(before);
  // Includes the complete explicit/interactive continuation and original ledger.
  G = JSON.parse(JSON.stringify(G));
  expect(resolvePending(G, ctxFor("UK"), "RU")).toBeUndefined();
  expectDraws(G, before, "RU");
  expect(G.war).toBeNull();
  expect(G.wars[0].postWarDraws).toEqual(["UK", "RU"]);
  expect(G.wars[0].postWarDrawChoice).toBe("RU");
  expect(G.powers.GE.stability).toBe(stability + 1);
});

test("one actual invitee draws automatically; a refusal and the original defender do not qualify", () => {
  const G = intervention();
  invite(G, "AU");
  invite(G, "RU", false);
  expect(G.war!.defenderAllies).toContain("FR");
  const before = hands(G);
  expect(resolveWar(G, ctxFor(), [])).toBeUndefined();
  expectDraws(G, before, "AU");
  expect(G.wars[0].postWarDrawChoice).toBe("AU");
});

test("with no accepted invitations only the UK draws", () => {
  const G = intervention();
  const before = hands(G);
  resolveWar(G, ctxFor(), []);
  expectDraws(G, before);
  expect(G.wars[0].postWarDraws).toEqual(["UK"]);
});

test("the required choice is private and cannot be answered by another seat or silently declined", () => {
  const G = intervention();
  invite(G, "AU");
  invite(G, "RU");
  resolveWar(G, ctxFor(), []);
  const before = JSON.stringify(G);
  expect(resolvePending(G, ctxFor("AU"), "RU")).toBe(INVALID_MOVE);
  expect(resolvePending(G, ctxFor("UK"), "FR")).toBe(INVALID_MOVE);
  expect(declinePending(G, ctxFor("UK"))).toBe(INVALID_MOVE);
  expect(JSON.stringify(G)).toBe(before);
  expect(redactForView(G, "1", ctxFor()).pending?.options).toHaveLength(2);
  expect(redactForView(G, "0", ctxFor()).pending?.options).toEqual([]);
  expect(redactForView(G, null, ctxFor()).pending?.context).toEqual({});
});

test("legacy saves with several draw recipients are converted to a choice rather than over-drawing", () => {
  const G = intervention();
  invite(G, "AU");
  invite(G, "RU");
  delete G.war!.postWarDrawCandidates;
  G.war!.postWarDraws = ["UK", "AU", "RU"];
  const before = hands(G);
  resolveWar(G, ctxFor(), []);
  expect(G.pending?.context?.special).toBe("balanceOfPowerDraw");
  expect(resolvePending(G, ctxFor("UK"), "AU")).toBeUndefined();
  expectDraws(G, before, "AU");
  expect(G.wars[0].postWarDraws).toEqual(["UK", "AU"]);
});

test("plain Status Quo invitations without Balance of Power create no post-war draws", () => {
  const G = intervention();
  G.war!.postWarDraws = [];
  invite(G, "AU");
  invite(G, "RU");
  const before = hands(G);
  resolveWar(G, ctxFor(), []);
  expect(hands(G)).toEqual(before);
  expect(G.wars[0].postWarDrawCandidates).toBeUndefined();
});

test("an eliminated invitee is excluded from the award", () => {
  const G = intervention();
  invite(G, "AU");
  invite(G, "RU");
  G.powers.RU.eliminated = true;
  const before = hands(G);
  resolveWar(G, ctxFor(), []);
  expectDraws(G, before, "AU");
  expect(G.wars[0].postWarDraws).toEqual(["UK", "AU"]);
});
