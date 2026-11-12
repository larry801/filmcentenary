import {setupImperialElegy} from "./engine/setup";
import {ACTION_CARDS, HOME_CARDS, GREAT_WAR_CARDS} from "./constant/cards.data";
import {GOALS} from "./constant/goals";
import {SPACES, CONNECTIONS} from "./constant/spaces";

const ctx: any = {
  random: {Die: (n: number) => 1, Number: () => 1, Shuffle: (a: any[]) => a},
  events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "prep",
};

test("setup builds the campaign", () => {
  const G = setupImperialElegy(ctx);
  expect(Object.keys(G.spaces).length).toBeGreaterThan(100);
  expect(G.powers.GE.territorialKeys).toBe(5);
  expect(G.powers.FR.territorialKeys).toBe(9);
  expect(G.powers.AU.territorialKeys).toBe(9);
  expect(G.powers.RU.territorialKeys).toBe(12);
  expect(G.powers.UK.territorialKeys).toBe(5);
  expect(G.powers.UK.colonialKeys).toBe(7);
  expect(G.powers.OT.arabKeys).toBe(5);
  expect(Object.keys(G.units).length).toBe(50);
  expect(ACTION_CARDS.length).toBe(100);
  expect(HOME_CARDS.length).toBe(12);
  expect(GREAT_WAR_CARDS.length).toBe(10);
  expect(GOALS.length).toBe(49);
  expect(CONNECTIONS.length).toBeGreaterThan(200);
});

test("every action card has a unique id and cp", () => {
  const ids = new Set(ACTION_CARDS.map((c) => c.id));
  expect(ids.size).toBe(100);
  for (const c of ACTION_CARDS) expect(c.cp).toBeGreaterThan(0);
});
