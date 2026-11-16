/**
 * Rule 9.2 / 34.3.4 — the printed BOT BOX on the Imperial Elegy action cards.
 *
 * The box sits under the CP value as a 2×3 grid (GE/UK, FR/AU, RU/OT).  A lit
 * cell names a power whose Rule 34 bot always plays that card for its event.
 * The transcription is keyed by printed card number in `BOT_BOX`
 * (`constant/cards.data.ts`) and copied onto `CardDef.botBox`.
 */
import {ACTION_CARDS, BOT_BOX, HOME_CARDS, GREAT_WAR_CARDS} from "./constant/cards.data";
import {botDecision} from "./engine/bot";
import {flashpointController} from "./engine/rules";
import {setupImperialElegy} from "./engine/setup";
import {POWERS} from "./types";

const ctx: any = {
  random: {Die: (n: number) => 1, Number: () => 1, Shuffle: (a: any[]) => a},
  events: {setActivePlayers: () => {}, setPhase: () => {}, endGame: () => {}, endTurn: () => {}},
  turn: 1,
  phase: "prep",
  playerID: "0",
  numPlayers: 6,
};

const byNumber = (n: number) => ACTION_CARDS.find((card) => card.number === n)!;

test("every transcribed bot box belongs to a printed action card", () => {
  for (const number of Object.keys(BOT_BOX).map(Number)) {
    const card = byNumber(number);
    expect(card).toBeDefined();
    expect(card.kind).toBe("action");
    expect(card.botBox).toEqual(BOT_BOX[number]);
  }
});

test("bot boxes name only real powers, without duplicates", () => {
  for (const [number, powers] of Object.entries(BOT_BOX)) {
    expect(powers.length).toBeGreaterThan(0);
    expect(new Set(powers).size).toBe(powers.length);
    for (const power of powers) expect(POWERS).toContain(power);
    // The box is printed on action cards only, and every list is a subset of
    // the six printed cells.
    expect(Number(number)).toBeGreaterThanOrEqual(13);
    expect(Number(number)).toBeLessThanOrEqual(112);
  }
});

test("cards printed with a full box list all six powers", () => {
  for (const number of [18, 19, 20, 57, 68, 96, 99]) {
    expect(byNumber(number).botBox).toEqual(["GE", "UK", "FR", "AU", "RU", "OT"]);
  }
});

test("home and Great War cards never carry a bot box", () => {
  for (const card of [...HOME_CARDS, ...GREAT_WAR_CARDS]) {
    expect(card.botBox).toBeUndefined();
  }
});

test("cards 21 and 82 print no bot box", () => {
  // Both cards print no BOT BOX, so neither is in BOT_BOX and no bot
  // auto-plays them; see CORRECTIONS.md §8.
  expect(byNumber(21).botBox).toBeUndefined();
  expect(byNumber(82).botBox).toBeUndefined();
  expect(BOT_BOX[21]).toBeUndefined();
  expect(BOT_BOX[82]).toBeUndefined();
});

/** A bot's action-phase state with an empty impulse and one card in hand. */
const actionState = (power: "GE" | "UK" | "FR" | "AU" | "RU" | "OT", cardId: string) => {
  const G = setupImperialElegy(ctx);
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = 0;
  G.powers[power].selectedHomeCard = null;
  G.powers[power].hand = [cardId];
  return G;
};

test("a bot plays its own boxed card for the event", () => {
  // A77 Indian Nationalism (#77) has no box; #79 Loose Grip lists GE, UK, FR.
  const G = actionState("FR", "IE-A079");
  const move = botDecision(G, ctx, "FR");
  expect(move).toEqual({move: "playCard", args: ["IE-A079", "event"]});
});

test("a bot ignores a box that does not name it", () => {
  // #40 British Trade lists UK only: the French bot may still spend it for CP,
  // but nothing may drive it to the event.
  const G = actionState("FR", "IE-A040");
  const move = botDecision(G, ctx, "FR");
  if (move.move === "playCard") expect(move.args?.[1]).toBe("cp");
});

test("a boxed event the engine would refuse is not re-sent", () => {
  // #103 Bosnian Crisis is denied while the Ottomans control the Balkans
  // flashpoint (eventPlayability "balkans-ottoman"); the AU bot may spend the
  // card for CP but must never name an event `playCard` will refuse.
  const G = actionState("AU", "IE-A103");
  expect(flashpointController(G, "balkans")).toContain("OT");
  const move = botDecision(G, ctx, "AU");
  if (move.move === "playCard") expect(move.args?.[1]).toBe("cp");
});
