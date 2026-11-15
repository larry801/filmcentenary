/** A100: both printed WTT increases obey rule 23.1's interruption order. */
import type {Ctx} from "boardgame.io";
import {setupImperialElegy} from "./engine/setup";
import {playCard, resolvePending} from "./moves";
import {placeUnit} from "./engine/effects";
import {POWERS} from "./types";

const scripted = (dice: number[] = []) => {
  let cursor = 0;
  const Die = jest.fn(() => dice[cursor++] ?? 3);
  const ctx = {playerID: "0", random: {Die}, events: {setPhase: jest.fn(), setActivePlayers: jest.fn(), endTurn: jest.fn(), endGame: jest.fn()}} as unknown as Ctx;
  return {ctx, Die};
};

const fresh = (wtt = 3) => {
  const G = setupImperialElegy(scripted().ctx);
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  G.wtt = wtt;
  G.powers.GE.hand = ["IE-A100"];
  for (const power of POWERS) G.powers[power].alliance = ["GE", "AU", "RU"].includes(power) ? "taCommitted" : "teCommitted";
  return G;
};

test("independence resolves before the second crisis, and Macedonia waits until after conference", () => {
  const G = fresh();
  const {ctx} = scripted([6, 6]);
  expect(playCard(G, ctx, "IE-A100", "event")).toBeUndefined();
  expect(G.wtt).toBe(4);
  expect(G.pending?.kind).toBe("eventTargetSpace");
  expect(G.resolvingCard).toBe("IE-A100");
  expect(G.discard).not.toContain("IE-A100");
  expect(resolvePending(G, ctx, "serbia")).toBeUndefined();
  expect(G.wtt).toBe(4);
  expect(resolvePending(G, ctx, "bulgaria")).toBeUndefined();
  expect(G.spaces.serbia.control).toBe("Serbia");
  expect(G.spaces.bulgaria.control).toBe("Bulgaria");
  expect(G.wtt).toBe(5);
  expect(G.pending?.kind).toBe("crisis");
  expect(G.pending?.context?.inciting).toBe("IE-A100");
  expect(G.spaces.macedonia.control).toBe("OT");
  expect(resolvePending(G, ctx, "roll")).toBeUndefined();
  expect(G.wtt).toBe(4);
  expect(G.pending?.context?.stage).toBe("award");
  expect(resolvePending(G, ctx, "greece")).toBeUndefined();
  expect(G.spaces.macedonia.control).toBe("Greece");
  expect(G.discard.filter((id) => id === "IE-A100")).toHaveLength(1);
  expect(G.pending).toBeNull();
  expect(G.pendingStack).toEqual([]);
});

test("a second-increase outbreak preserves preceding independence but skips the Macedonia award", () => {
  const G = fresh();
  const {ctx} = scripted([6, 1, 3, 4, 6, 1]);
  playCard(G, ctx, "IE-A100", "event");
  resolvePending(G, ctx, "serbia");
  resolvePending(G, ctx, "bulgaria");
  expect(G.pending?.kind).toBe("crisis");
  expect(resolvePending(G, ctx, "roll")).toBeUndefined();
  expect(G.gw?.active).toBe(true);
  expect(G.spaces.serbia.control).toBe("Serbia");
  expect(G.spaces.bulgaria.control).toBe("Bulgaria");
  expect(G.spaces.macedonia.control).toBe("OT");
  expect(G.pending?.context?.stage).not.toBe("award");
});

test("a first-increase conference does not suppress the card's second printed increase", () => {
  const G = fresh(4);
  const {ctx} = scripted([6, 6, 1, 3, 4, 6, 1]);
  playCard(G, ctx, "IE-A100", "event");
  expect(G.pending?.kind).toBe("crisis");
  resolvePending(G, ctx, "roll");
  expect(G.persistent.conferenceUsed).toBe(true);
  expect(G.wtt).toBe(4);
  resolvePending(G, ctx, "serbia");
  resolvePending(G, ctx, "bulgaria");
  expect(G.pending?.kind).toBe("crisis");
  expect(G.wtt).toBe(5);
  expect(resolvePending(G, ctx, "roll")).toBeUndefined();
  expect(G.gw?.active).toBe(true);
  expect(G.log.filter((entry) => entry.key === "wttMax")).toHaveLength(2);
});

test("the low-roll losses precede the crisis and the award stays suspended", () => {
  const G = fresh();
  const rebel = placeUnit(G, "REBEL:Serbia", "rebelArmy", "serbia", 2);
  const {ctx} = scripted([1, 6]);
  playCard(G, ctx, "IE-A100", "event");
  expect(G.units[rebel.id].steps).toBe(1);
  expect(G.pending?.kind).toBe("crisis");
  expect(G.spaces.macedonia.control).toBe("OT");
  resolvePending(G, ctx, "roll");
  expect(G.pending?.context?.stage).toBe("award");
});

test("forced independence with only two targets continues through the second increase", () => {
  const G = fresh(0);
  G.spaces["bosnia-herzegovina"].control = "Bosnia";
  G.spaces.macedonia.control = "Greece";
  const {ctx} = scripted([6]);
  playCard(G, ctx, "IE-A100", "event");
  expect(G.spaces.serbia.control).toBe("Serbia");
  expect(G.spaces.bulgaria.control).toBe("Bulgaria");
  expect(G.wtt).toBe(2);
  expect(G.pending?.context?.stage).toBe("award");
  expect(G.discard).not.toContain("IE-A100");
  resolvePending(G, ctx, "OT");
  expect(G.discard.filter((id) => id === "IE-A100")).toHaveLength(1);
});

test("no Ottoman Balkan target preserves Ottoman allies and rolls no independence die", () => {
  const G = fresh(0);
  for (const space of ["bosnia-herzegovina", "serbia", "bulgaria", "macedonia"]) G.spaces[space].control = "Serbia";
  G.spaces.greece.ally = "OT";
  const {ctx, Die} = scripted();
  playCard(G, ctx, "IE-A100", "event");
  expect(G.spaces.greece.ally).toBe("OT");
  expect(Die).not.toHaveBeenCalled();
  expect(G.wtt).toBe(2);
  expect(G.pending?.context?.stage).toBe("award");
});

test("army DRMs include Istanbul and independent minors outside Ottoman target spaces", () => {
  const G = fresh(0);
  // Greece's existing army and an additional independent Greek army give +2;
  // the two OT armies (Istanbul/Macedonia) give -2, so a 5 succeeds.
  placeUnit(G, "Greece", "minorArmy", "greece", 2);
  playCard(G, scripted([5]).ctx, "IE-A100", "event");
  expect(G.pending?.kind).toBe("eventTargetSpace");
  expect(G.wtt).toBe(1);
});

test("a legacy independence pending does not lose its award or charge WTT twice", () => {
  const G = fresh(0);
  const {ctx} = scripted([6]);
  playCard(G, ctx, "IE-A100", "event");
  // Old saves charged both increases before opening independence and had no
  // explicit WTT/award continuation in the pending context.
  G.wtt = 2;
  G.pending!.context!.resume = [];
  resolvePending(G, ctx, "serbia");
  resolvePending(G, ctx, "bulgaria");
  expect(G.pending?.context?.stage).toBe("award");
  expect(G.wtt).toBe(2);
  resolvePending(G, ctx, "greece");
  expect(G.spaces.macedonia.control).toBe("Greece");
  expect(G.pending).toBeNull();
});
