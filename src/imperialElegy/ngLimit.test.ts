/**
 * 2.4 / 20.11 / A22 — "if a player has more than 3 NG cards, they choose one
 * and return it to their NG deck."
 *
 * A22 auto-returned the oldest Goal, and the end-phase draw did not return one
 * at all, so a fourth Goal could be kept permanently.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {GOALS} from "./constant/goals";
import {chooseGoal, playCard, resolvePending} from "./moves";

const makeCtx = (playerID = "0"): Ctx => ({
  playerID,
  random: {Die: () => 3},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "action",
} as unknown as Ctx);

const seat = (power: Power): string => String(POWERS.indexOf(power));

const begin = (power: Power = "GE"): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = 0;
  G.pending = null;
  G.battle = null;
  G.war = null;
  G.powers[power].flags.homeChosen = true;
  G.powers[power].hand = ["IE-A022"];
  G.powers[power].goals = GOALS.slice(0, 3).map((goal) => goal.id);
  G.powers[power].goalDeck = GOALS.slice(3).map((goal) => goal.id);
  return G;
};

const options = (G: ImperialElegyState): string[] => G.pending?.options.map((o) => o.id) ?? [];

describe("NG limit of three", () => {
  test("A22 asks which Goal to return after drawing a fourth", () => {
    const G = begin();
    const ctx = makeCtx(seat("GE"));
    playCard(G, ctx, "IE-A022", "event");
    expect(G.pending?.kind).toBe("goalChoice");
    const drawn = options(G);
    expect(drawn).toHaveLength(3);

    expect(resolvePending(G, ctx, drawn[0])).toBeUndefined();
    // Four Goals: the player now chooses one of the four to return.
    expect(G.pending?.kind).toBe("goalChoice");
    expect(G.pending?.context?.mode).toBe("return");
    expect(options(G)).toHaveLength(4);

    const returned = options(G)[1];
    expect(resolvePending(G, ctx, returned)).toBeUndefined();
    expect(G.powers.GE.goals).toHaveLength(3);
    expect(G.powers.GE.goals).not.toContain(returned);
    expect(G.powers.GE.goalDeck).toContain(returned);
    expect(G.log.some((entry) => entry.key === "goalRemoved" && entry.args?.goal === returned)).toBe(true);
  });

  test("the end-phase NG draw also returns the chosen Goal", () => {
    const G = begin();
    G.phase = "end";
    G.powers.GE.flags.ngChoices = G.powers.GE.goalDeck.slice(0, 3).join(",");
    const ctx = makeCtx(seat("GE"));
    const chosen = String(G.powers.GE.flags.ngChoices).split(",")[0];
    expect(chooseGoal(G, ctx, chosen)).toBeUndefined();
    expect(G.pending?.kind).toBe("goalChoice");
    expect(G.pending?.context?.mode).toBe("return");
    expect(options(G)).toHaveLength(4);

    const returned = options(G)[0];
    expect(resolvePending(G, ctx, returned)).toBeUndefined();
    expect(G.powers.GE.goals).toHaveLength(3);
    expect(G.powers.GE.goalDeck).toContain(returned);
  });
});
