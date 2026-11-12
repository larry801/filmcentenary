import {setupImperialElegy} from "./engine/setup";
import {ACTION_CARDS} from "./constant/cards.data";
import {playCard, resolvePending, declinePending} from "./moves";

const ctx: any = {playerID: "0", random: {Die: () => 3}, events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}}};
const seats = ["GE","UK","FR","AU","RU","OT"];

test("every action card event can resolve without throwing", () => {
  const failures: string[] = [];
  for (const card of ACTION_CARDS) {
    const G = setupImperialElegy({...ctx});
    G.phase = "action";
    G.activePower = "GE";
    G.powers.GE.hand.push(card.id);
    try {
      playCard(G, ctx, card.id, "event");
      let guard = 0;
      while (G.pending && guard++ < 20) {
        const pending = G.pending;
        const option = pending.options[0];
        if (!option) { declinePending(G, ctx); break; }
        resolvePending(G, {...ctx, playerID: String(seats.indexOf(pending.power))}, option.id);
      }
      if (G.pending) failures.push(`${card.number} ${card.title}: still pending after 20 decisions`);
    } catch (error) {
      failures.push(`${card.number} ${card.title}: ${String(error)}`);
    }
  }
  expect(failures).toEqual([]);
});

import {GREAT_WAR_CARDS, HOME_CARDS} from "./constant/cards.data";
import {crisisRoll} from "./engine/greatWar";
import {playGwCardMove} from "./moves";

test("every home card event resolves", () => {
  const failures: string[] = [];
  for (const card of HOME_CARDS) {
    const G = setupImperialElegy({...ctx});
    G.phase = "action";
    G.activePower = card.power!;
    G.powers[card.power!].hand.push(card.id);
    G.powers[card.power!].selectedHomeCard = card.id;
    try {
      playCard(G, {...ctx, playerID: String(seats.indexOf(card.power!))}, card.id, "event");
      let guard = 0;
      while (G.pending && guard++ < 20) {
        const pending = G.pending;
        const option = pending.options[0];
        if (!option) { declinePending(G, ctx); break; }
        resolvePending(G, {...ctx, playerID: String(seats.indexOf(pending.power))}, option.id);
      }
    } catch (error) {
      failures.push(`${card.id}: ${String(error)}`);
    }
  }
  expect(failures).toEqual([]);
});

test("every Great War card event resolves", () => {
  const failures: string[] = [];
  for (const card of GREAT_WAR_CARDS) {
    const G = setupImperialElegy({...ctx});
    G.powers.GE.alliance = "taCommitted";
    G.powers.AU.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    G.powers.UK.alliance = "teCommitted";
    crisisRoll(G, {...ctx, random: {Die: () => 1}}, "GE", "test");
    G.gw!.turn = 2;
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.powers.GE.gwCard = card.id;
    try {
      playGwCardMove(G, {...ctx, playerID: "0"}, "event");
      let guard = 0;
      while (G.pending && guard++ < 20) {
        const pending = G.pending;
        const option = pending.options[0];
        if (!option) { declinePending(G, ctx); break; }
        resolvePending(G, {...ctx, playerID: String(seats.indexOf(pending.power))}, option.id);
      }
    } catch (error) {
      failures.push(`${card.id}: ${String(error)}`);
    }
  }
  expect(failures).toEqual([]);
});
