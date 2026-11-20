/**
 * 13.7 Defender plays card.
 *
 * "At this point the defender may play a card to add CP to their war budget
 * [14.3].  Important: the defending player cannot play a mandatory event to add
 * to their war budget."
 *
 * The engine created every player defender's budget at 0 and offered no way to
 * spend that card.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {createWarState} from "./engine/limitedWar";
import {ALL_CARDS} from "./engine/deck";
import {playWarBudgetCard} from "./moves";

const makeCtx = (playerID: string): Ctx => ({
  playerID,
  random: {Die: () => 3},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 3,
  phase: "action",
} as unknown as Ctx);

const seat = (power: Power): string => String(POWERS.indexOf(power));

const begin = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx(seat("GE")));
  G.phase = "action";
  G.activePower = "GE";
  G.war = createWarState(G, "GE", "FR", "conquest", [], 2);
  G.war.status = "warAim";
  return G;
};

const card = (type: string, cp = 2) => {
  const found = ALL_CARDS.find((c) => c.kind === "action" && c.type === type && c.cp === cp);
  if (!found) throw new Error(`no ${type} card`);
  return found.id;
};

describe("13.7 defender war budget card", () => {
  test("a defending power adds the card's printed CP to its budget", () => {
    const G = begin();
    const id = card("event", 2);
    G.powers.FR.hand = [id];
    const before = G.war!.budgets.FR ?? 0;

    expect(playWarBudgetCard(G, makeCtx(seat("FR")), id)).toBeUndefined();
    expect(G.war!.budgets.FR).toBe(before + 2);
    expect(G.powers.FR.hand).not.toContain(id);
    expect(G.discard).toContain(id);
    expect(G.log.some((entry) => entry.key === "warBudgetCard" && entry.args?.card === id)).toBe(true);

    // One card per defending power.
    expect(playWarBudgetCard(G, makeCtx(seat("FR")), id)).toBe(INVALID_MOVE);
  });

  test("the attacker cannot use the defender's allowance", () => {
    const G = begin();
    const id = card("event", 1);
    G.powers.GE.hand = [id];
    expect(playWarBudgetCard(G, makeCtx(seat("GE")), id)).toBe(INVALID_MOVE);
  });

  test("a mandatory event cannot fund the budget", () => {
    const G = begin();
    const mandatory = ALL_CARDS.find((c) => c.kind === "action" && c.type === "mandatory")!;
    G.powers.FR.hand = [mandatory.id];
    expect(playWarBudgetCard(G, makeCtx(seat("FR")), mandatory.id)).toBe(INVALID_MOVE);
  });
});
