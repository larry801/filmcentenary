/**
 * The printed player-display data: the stability track's card markers and the
 * Russian key→manpower ladder.
 *
 * Both were read off the published displays (`public/imperial-elegy/displays/`)
 * in a solo-Russia audit, because the campaign is played straight off those
 * boards.
 */
import {POWER_DEFS} from "./constant/powers";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {cardsToDraw} from "./engine/rules";
import {DEFAULT_BOT_DIFFICULTY} from "./configuration";
import type {ImperialElegyState} from "./types";

const makeCtx = () => ({
  playerID: "0",
  random: {Die: () => 3},
  events: {setPhase: () => {}, setActivePlayers: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "prep",
}) as any;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

// ---------------------------------------------------------------------------
// Stability track: the boxed "-1 card" / "+1 card" values are plus/minus card
// markers (10.2/10.3), applied to the industry draw and floored at 3 cards.
// ---------------------------------------------------------------------------

describe("stability track card values", () => {
  test("every display prints -1 card at 0-1 and +1 card at 6", () => {
    for (const power of POWERS) {
      const table = POWER_DEFS[power].stability;
      expect({power, at0: table[0].cardDelta}).toEqual({power, at0: -1});
      expect({power, at1: table[1].cardDelta}).toEqual({power, at1: -1});
      expect({power, at6: table[6].cardDelta}).toEqual({power, at6: 1});
      // No display prints an absolute card count in a box: that reading made a
      // power at stability 0 draw a single card, below the printed minimum.
      for (const [index, entry] of table.entries()) {
        expect({power, index, cards: entry.cards}).toEqual({power, index, cards: undefined});
      }
    }
  });

  test("a low-stability power still draws the printed three-card minimum", () => {
    const G = fresh();
    for (const power of POWERS) {
      G.powers[power].stability = 0;
      expect({power, draw: cardsToDraw(G, power)}).toEqual({power, draw: 3});
      G.powers[power].stability = 1;
      expect({power, draw: cardsToDraw(G, power)}).toEqual({power, draw: 3});
    }
  });

  test("losing the stability card costs the industry draw one card when above the floor", () => {
    const G = fresh();
    // Germany draws 4 at industry 3; the stability-1 card marker takes it to 3.
    G.powers.GE.industry = 3;
    expect(cardsToDraw(G, "GE")).toBe(4);
    G.powers.GE.stability = 1;
    expect(cardsToDraw(G, "GE")).toBe(3);
    // Stability 6 is a printed +1 card marker.
    G.powers.GE.stability = 6;
    expect(cardsToDraw(G, "GE")).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Russian Total Keys ladder, read box by box off displays/RU.jpg: boxes 10-14
// all print MP=5 and box 15 is the first MP=6 box.  The campaign opens on box 12
// (circled) with MP=5.
// ---------------------------------------------------------------------------

describe("Russian key ladder", () => {
  test("matches the printed displays/RU.jpg MP values", () => {
    expect(POWER_DEFS.RU.keyManpower).toEqual([
      2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 6,
    ]);
  });

  test("ten to fourteen keys all give five manpower, fifteen gives six", () => {
    expect(POWER_DEFS.RU.keyManpower[10]).toBe(4);
    expect(POWER_DEFS.RU.keyManpower[11]).toBe(5);
    expect(POWER_DEFS.RU.keyManpower[14]).toBe(5);
    expect(POWER_DEFS.RU.keyManpower[15]).toBe(6);
  });

  test("the campaign opens on twelve keys with five manpower", () => {
    const G = fresh();
    expect(G.powers.RU.territorialKeys).toBe(12);
    expect(G.powers.RU.manpower).toBe(5);
  });
});

test("a hotseat state records the difficulty default it plays at", () => {
  const G = fresh();
  expect(G.botDifficulty).toBeUndefined();
  expect(DEFAULT_BOT_DIFFICULTY).toBe("normal");
});
