/**
 * 4.2 — a reserve army is listed twice: in `G.units` and in its owner's reserve
 * box.  The two listings have to move together, or the board ends up with a
 * reserve id that resolves to nothing (A03) and every later invariant pass
 * reports it.
 */
import {setupImperialElegy} from "./engine/setup";
import {addReserve, removeUnit} from "./engine/effects";
import {removeAllUnitsOf} from "./engine/rules";
import {checkAll} from "./testing/invariants";
import {ImperialElegyState, Power} from "./types";

const ctx: any = {
  random: {Die: () => 1, Number: () => 1, Shuffle: (a: unknown[]) => a},
  events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "prep",
  playerID: "0",
  numPlayers: 6,
};

const a03 = (G: ImperialElegyState): string[] =>
  checkAll(G, {level: "full"}).filter((violation) => violation.code === "A03")
    .map((violation) => violation.msg);

test("a destroyed reserve army leaves the reserve box", () => {
  const G = setupImperialElegy(ctx);
  const power: Power = "AU";
  addReserve(G, power, 2);
  const [first, second] = G.powers[power].reserves;
  expect(first).toBeDefined();
  expect(a03(G)).toEqual([]);

  removeUnit(G, first as string);
  expect(G.powers[power].reserves).not.toContain(first);
  expect(G.powers[power].reserves).toContain(second);
  expect(a03(G)).toEqual([]);
});

test("removing a board unit an owner never reserved leaves the box alone", () => {
  const G = setupImperialElegy(ctx);
  const power: Power = "FR";
  addReserve(G, power, 1);
  const reserved = [...G.powers[power].reserves];
  const onBoard = Object.values(G.units).find(
    (unit) => unit.owner === power && unit.space !== null && unit.space !== undefined,
  );
  expect(onBoard).toBeDefined();
  removeUnit(G, (onBoard as {id: string}).id);
  expect(G.powers[power].reserves).toEqual(reserved);
  expect(a03(G)).toEqual([]);
});


test("30.1 a power leaving the game takes its reserve box with it", () => {
  const G = setupImperialElegy(ctx);
  const power: Power = "AU";
  addReserve(G, power, 2);
  expect(G.powers[power].reserves.length).toBe(2);
  removeAllUnitsOf(G, power);
  expect(G.powers[power].reserves).toEqual([]);
  expect(Object.values(G.units).some((unit) => unit.owner === power)).toBe(false);
  expect(a03(G)).toEqual([]);
});
