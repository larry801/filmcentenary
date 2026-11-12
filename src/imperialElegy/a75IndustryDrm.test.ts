/**
 * A75 Second Industrial Revolution — "Increase your industry by one.  This
 * does not count as the one card spent to industrialize.  Additionally, all
 * other players receive a +2 DRM to their industrialization rolls this turn."
 *
 * The delivered bug applied `industryDrm: 2` to the playing power's own flag
 * bag, so the actor (and only the actor) rolled with +2.  The card now uses
 * `scope: "others"`, and the end-phase industrialization step reads each
 * power's own flag.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {cardById} from "./engine/deck";
import {industryRollNeeded} from "./engine/economy";
import {playCard, resolveEnd} from "./moves";

const makeCtx = (dice: number[] = [3], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 1},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const playA75 = (G: ImperialElegyState, by: Power): Ctx => {
  G.phase = "action";
  G.activePower = by;
  G.cpRemaining = 0;
  G.pending = null;
  G.powers[by].hand.push("IE-A075");
  const ctx = makeCtx([3], seat(by));
  expect(playCard(G, ctx, "IE-A075", "event")).toBeUndefined();
  return ctx;
};

describe("A75 Second Industrial Revolution scope", () => {
  test("the playing power gains +1 industry and does not spend its industry card", () => {
    const G = fresh();
    // The player already chose a card for industrialization this turn.
    G.powers.UK.industryCard = "IE-A070";
    const before = G.powers.UK.industry;

    playA75(G, "UK");

    expect(G.powers.UK.industry).toBe(before + 1);
    expect(G.powers.UK.industryCard).toBe("IE-A070");

    // A75 no longer writes its own flag; it writes every other power's.
    expect(G.powers.UK.flags.industryDrm).toBeUndefined();
    for (const power of POWERS) {
      if (power === "UK") {
        expect(G.powers[power].flags.industryDrm).toBeUndefined();
        continue;
      }
      expect(G.powers[power].flags.industryDrm).toBe(2);
      // RU/OT print a target of 6, the other powers 5.
      expect(industryRollNeeded(G, power, 2)).toBe(power === "RU" || power === "OT" ? 2 : 1);
    }
    expect(industryRollNeeded(G, "UK", 2)).toBe(3);
  });

  test("the live end-phase roll gives the +2 to every other player, not the actor", () => {
    const G = fresh();
    playA75(G, "UK");

    for (const power of POWERS) G.powers[power].industryCard = "IE-A070"; // cp 2
    const before: Record<Power, number> = Object.fromEntries(
      POWERS.map((power) => [power, G.powers[power].industry]),
    ) as Record<Power, number>;

    // A constant die roll of 2: the actor needs 3 with a cp-2 card and fails,
    // while every other power needs 1 (2 for RU/OT) and succeeds.
    resolveEnd(G, makeCtx([2]));

    expect(G.powers.UK.industry).toBe(before.UK);
    for (const power of POWERS) {
      if (power === "UK") continue;
      expect(G.powers[power].industry).toBe(before[power] + 1);
      // The industrialization step consumes the turn flag after the roll.
      expect(G.powers[power].flags.industryDrm).toBe(0);
    }
    expect(G.powers.UK.flags.industryDrm).toBe(0);
  });

  test("the +2 DRM expires with the turn (cleared after the end-phase step)", () => {
    const G = fresh();
    playA75(G, "UK");

    expect(G.powers.FR.flags.industryDrm).toBe(2);
    resolveEnd(G, makeCtx([1]));
    expect(G.powers.FR.flags.industryDrm).toBe(0);
    expect(industryRollNeeded(G, "FR", 2)).toBe(3);
  });

  test("negative: the Ottomans cannot play A75", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "OT";
    G.cpRemaining = 0;
    G.pending = null;
    G.powers.OT.hand.push("IE-A075");

    expect(playCard(G, makeCtx([3], seat("OT")), "IE-A075", "event")).toBe(INVALID_MOVE);

    expect(G.powers.OT.industry).toBe(0);
    expect(G.powers.OT.flags.industryDrm).toBeUndefined();
    for (const power of POWERS) expect(G.powers[power].flags.industryDrm).toBeUndefined();
    expect(G.powers.OT.hand).toContain("IE-A075");
    expect(cardById("IE-A075").cp).toBe(4);
  });
});
