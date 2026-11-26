/**
 * 27.1/27.2: a Great War card is played from its own slot, and the play is
 * announced at the table like any other card (12.0/12.1, and RULES_COVERAGE's
 * "response, combat and Great War cards are played openly").  Reported as
 * "大战卡牌打出记录里面没有显示": the log showed the action a card-funded bonus
 * paid for but never the card, so the seat's GW slot emptied silently.
 */
import {Ctx} from "boardgame.io";
import {ImperialElegyState, Power, POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {outbreakGreatWar} from "./engine/greatWar";
import {placeUnit} from "./engine/effects";
import {startGwManeuver} from "./engine/greatWarFlow";
import {gwRefit, playGwCardMove} from "./moves";
import {redactForView} from "./engine/privacy";
import {logSegments, logText} from "./components/logText";
import {cardDisplayName} from "./components/cardDisplay";
import {cardById} from "./engine/deck";
import type {LogEntry} from "./types";

const ctx = (power: Power): Ctx => ({
  playerID: String(POWERS.indexOf(power)), random: {Die: () => 3, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: jest.fn(), setPhase: jest.fn(), endGame: jest.fn()},
}) as unknown as Ctx;

const game = (): ImperialElegyState => {
  const G = setupImperialElegy(ctx("GE"));
  for (const p of POWERS) G.powers[p].alliance = p === "GE" ? "taCommitted" : p === "FR" ? "teCommitted" : "neutral";
  outbreakGreatWar(G, ctx("GE"), "GE", "GW card log");
  G.units = {};
  for (const space of Object.values(G.spaces)) space.units = [];
  G.gw!.turn = 2;
  G.phase = "gwPlanning";
  for (const p of POWERS) {
    G.powers[p].gwCard = null;
    G.powers[p].gwBudget = 5;
    G.powers[p].reserves = [];
  }
  startGwManeuver(G, ctx("GE"));
  return G;
};

const lastEntry = (G: ImperialElegyState): LogEntry => G.log[G.log.length - 1];

test("a card played for its bonus action is announced, with its turn and actor", () => {
  const G = game();
  G.powers.GE.gwCard = "IE-GW-04";
  expect(playGwCardMove(G, ctx("GE"), "cp")).toBeUndefined();

  const entry = lastEntry(G);
  expect(entry.key).toBe("gwCardPlayed");
  expect(entry.args).toEqual({card: "IE-GW-04", mode: "bonus"});
  expect(entry.power).toBe("GE");
  // `G.turn` is frozen at the outbreak; the entry carries the GW turn instead.
  expect(entry.gwTurn).toBe(G.gw!.turn);
  // The card is the log's own chip, so a reader can open it from the record.
  expect(logSegments(entry, "zh_CN")).toContainEqual({kind: "card", id: "IE-GW-04"});
  const titleZh = cardDisplayName(cardById("IE-GW-04"), "zh_CN");
  const titleEn = cardDisplayName(cardById("IE-GW-04"), "en");
  expect(logText(entry, "zh_CN")).toBe(`德国将 ${titleZh} 作为大战奖励行动打出。`);
  expect(logText(entry, "en")).toBe(`Germany played ${titleEn} for its Great War bonus action.`);
  // 27.2 asks for an immediate distinct action from the same card.
  expect(G.powers.GE.gwCard).toBeNull();
});

test("a card played as its event is announced as an event", () => {
  const G = game();
  const army = placeUnit(G, "GE", "army", "berlin", 1);
  // 27.1: an event needs the impulse's budget action first, so take it, then
  // play the card (the printed order).
  expect(gwRefit(G, ctx("GE"), army.id)).toBeUndefined();
  G.powers.GE.gwCard = "IE-GW-01";
  expect(playGwCardMove(G, ctx("GE"), "event")).toBeUndefined();

  const entry = lastEntry(G);
  expect(entry.key).toBe("gwCardPlayed");
  expect(entry.args).toEqual({card: "IE-GW-01", mode: "event"});
  expect(logText(entry, "zh_CN")).toBe(`德国将 ${cardDisplayName(cardById("IE-GW-01"), "zh_CN")} 作为大战事件打出。`);
});

test("every seat reads the played card, while this seat's own copy stays private until it is played", () => {
  const G = game();
  G.powers.GE.gwCard = "IE-GW-07";
  const held = redactForView(G, "2");
  expect(held.powers.GE.gwCard).toBeNull();
  expect(JSON.stringify(held.log)).not.toContain("IE-GW-07");

  expect(playGwCardMove(G, ctx("GE"), "cp")).toBeUndefined();
  const seen = redactForView(G, "2").log.find((entry) => entry.key === "gwCardPlayed");
  expect(seen?.args?.card).toBe("IE-GW-07");
  // The play is public, and the ledger names the same card from now on.
  expect(redactForView(G, "2").gw!.impulse!.cardId).toBe("IE-GW-07");
});
