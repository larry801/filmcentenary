/**
 * H-FR-5 The City of Light — the printed pre-roll purchase.
 *
 * "Gain 1 stability and 3 CP to spend.  Roll a die; if the result is less than
 * or equal to the current turn gain 1 City of Light point.  Before rolling you
 * may forgo X CP to apply a -X DRM to the die roll."
 *
 * The handler used to bank its 3 CP and roll in the same breath, so the "forgo
 * X CP" clause never reached the table.  These checks pin the decision, the CP
 * charge and the modified result.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {playCard, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID = "0", turn = 1): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: () => dice[Math.min(index++, Math.max(0, dice.length - 1))] ?? 3},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn,
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

/** France holds the home card on turn `turn` with no banked CP. */
const begin = (turn = 1): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = "FR";
  G.turn = turn;
  G.cpRemaining = 0;
  G.pending = null;
  G.battle = null;
  G.war = null;
  G.powers.FR.flags.homeChosen = true;
  G.powers.FR.hand = ["IE-H-FR-5"];
  G.powers.FR.selectedHomeCard = "IE-H-FR-5";
  G.powers.FR.cityOfLight = 2;
  return G;
};

describe("H-FR-5 The City of Light", () => {
  test("opening the event asks how much CP to forgo before the roll", () => {
    const G = begin(3);
    playCard(G, makeCtx([], seat("FR"), 3), "IE-H-FR-5", "event");
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.power).toBe("FR");
    // The card's own 3 CP are on the table, untouched until the seat answers.
    expect(G.cpRemaining).toBe(3);
    expect(G.pending?.options.map((entry) => entry.id)).toEqual(["x0", "x1", "x2", "x3"]);
    // Nothing is rolled while the decision is open.
    expect(G.powers.FR.cityOfLight).toBe(2);
  });

  test("forgoing X CP spends X and applies the -X DRM to the roll", () => {
    const G = begin(3);
    // A raw 5 misses on turn 3; discounted by 3 it becomes 2 and scores.
    playCard(G, makeCtx([5], seat("FR"), 3), "IE-H-FR-5", "event");
    expect(resolvePending(G, makeCtx([5], seat("FR"), 3), "x3")).toBeUndefined();
    expect(G.cpRemaining).toBe(0);
    expect(G.powers.FR.cityOfLight).toBe(3);
    expect(G.pending).toBeNull();
  });

  test("a plain roll still follows the printed turn comparison", () => {
    const miss = begin(2);
    playCard(miss, makeCtx([5], seat("FR"), 2), "IE-H-FR-5", "event");
    expect(resolvePending(miss, makeCtx([5], seat("FR"), 2), "x0")).toBeUndefined();
    expect(miss.cpRemaining).toBe(3);
    expect(miss.powers.FR.cityOfLight).toBe(2);

    const hit = begin(5);
    playCard(hit, makeCtx([5], seat("FR"), 5), "IE-H-FR-5", "event");
    expect(resolvePending(hit, makeCtx([5], seat("FR"), 5), "x0")).toBeUndefined();
    expect(hit.powers.FR.cityOfLight).toBe(3);
  });

  test("the purchased CP remain part of the impulse's spendable budget", () => {
    const G = begin(1);
    playCard(G, makeCtx([1], seat("FR"), 1), "IE-H-FR-5", "event");
    expect(resolvePending(G, makeCtx([1], seat("FR"), 1), "x1")).toBeUndefined();
    // 3 CP were banked, 1 was forgone for the DRM.
    expect(G.cpRemaining).toBe(2);
  });

  test("the point count is capped at the printed six", () => {
    const G = begin(6);
    G.powers.FR.cityOfLight = 6;
    playCard(G, makeCtx([1], seat("FR"), 6), "IE-H-FR-5", "event");
    expect(resolvePending(G, makeCtx([1], seat("FR"), 6), "x0")).toBeUndefined();
    expect(G.powers.FR.cityOfLight).toBe(6);
  });

  test("declining the open decision takes the printed no-DRM roll", () => {
    const G = begin(4);
    playCard(G, makeCtx([4], seat("FR"), 4), "IE-H-FR-5", "event");
    const pending = G.pending!;
    // The generic decline path picks the first option, which is the plain roll.
    expect(resolvePending(G, makeCtx([4], seat("FR"), 4), pending.options[0].id)).toBeUndefined();
    expect(G.cpRemaining).toBe(3);
    expect(G.powers.FR.cityOfLight).toBe(3);
  });
});
