/**
 * A71 Urabi Revolt and the Egypt key type.
 *
 * "If the UK or France wins, all Egyptian spaces become colonial home spaces."
 * The home-space half is `homeOverride`; the key-counting half is the typed
 * `keyTypeOverride`, which must move Egypt from the territorial track to the
 * winner's colonial track (and back to nothing when the Ottomans win, because
 * the Ottomans never track colonial keys).
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {effectiveKeyType, keySpaces, recomputeTracks} from "./engine/rules";
import {africaKeys, colonialKeys} from "./engine/victory";
import {CARDS} from "./constant/cards.data";
import {playCard, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (sides: number) => Math.min(sides, dice[Math.min(index++, dice.length - 1)] ?? 3)},
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
const fresh = (dice: number[] = []): ImperialElegyState => setupImperialElegy(makeCtx(dice));

/** An action event card with the requested printed CP value. */
const cardOfCp = (cp: number): string => {
  const card = CARDS.actions.find((entry) => entry.cp === cp && entry.type === "event" && entry.kind === "action");
  if (!card) throw new Error(`no event card with CP ${cp}`);
  return card.id;
};

const playUrabi = (G: ImperialElegyState, dice: number[] = []): Ctx => {
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 0;
  G.pending = null;
  G.battle = null;
  if (!G.powers.GE.hand.includes("IE-A071")) G.powers.GE.hand.push("IE-A071");
  const ctx = makeCtx(dice, seat("GE"));
  expect(playCard(G, ctx, "IE-A071", "event")).toBeUndefined();
  return ctx;
};

const EGYPT = ["egypt", "great-sand-sea", "sinai"] as const;

describe("Egypt key type — starting totals", () => {
  test("the printed campaign totals are unchanged", () => {
    const G = fresh();
    expect(G.powers.UK.territorialKeys).toBe(5);
    expect(G.powers.UK.colonialKeys).toBe(7);
    expect(G.powers.FR.territorialKeys).toBe(9);
    expect(G.powers.FR.colonialKeys).toBe(0);
    expect(G.powers.OT.territorialKeys).toBe(8);
    expect(G.powers.OT.arabKeys).toBe(5);
    expect(G.spaces.egypt.control).toBe("Egypt");
    expect(G.spaces.egypt.homeOverride).toBeUndefined();
    expect(G.spaces.egypt.keyTypeOverride).toBeUndefined();
    expect(effectiveKeyType(G, "egypt")).toBe("territorial");
  });
});

describe("Egypt key type — A71 live resolution", () => {
  test("a UK win makes the Egypt key colonial for the UK and not territorial", () => {
    const G = fresh();
    const ukCard = cardOfCp(3);
    G.powers.UK.hand = [ukCard];
    G.powers.FR.hand = [];
    G.powers.OT.hand = [];

    playUrabi(G, [4, 2, 1]);
    expect(G.pending?.kind).toBe("eventChoice");
    expect(resolvePending(G, makeCtx([4, 2, 1], seat("UK")), `card:${ukCard}`)).toBeUndefined();
    expect(G.pending).toBeNull();

    for (const id of EGYPT) {
      expect(G.spaces[id].control).toBe("UK");
      expect(G.spaces[id].homeOverride).toBe("UK");
    }
    // Only Egypt is a key; Sinai and the Great Sand Sea stay territories.
    expect(G.spaces.egypt.keyTypeOverride).toBe("colonial");
    expect(G.spaces.sinai.keyTypeOverride).toBeUndefined();
    expect(G.spaces["great-sand-sea"].keyTypeOverride).toBeUndefined();
    expect(effectiveKeyType(G, "egypt")).toBe("colonial");

    // The live track recompute moved one key from territorial to colonial.
    expect(G.powers.UK.territorialKeys).toBe(5);
    expect(G.powers.UK.colonialKeys).toBe(8);
    expect(G.powers.OT.territorialKeys).toBe(8);
    expect(G.powers.OT.arabKeys).toBe(5);
    expect(colonialKeys(G, "UK")).toBe(7);
    expect(africaKeys(G, "UK")).toBe(2);
  });

  test("a French win makes the Egypt key colonial for France", () => {
    const G = fresh();
    const frCard = cardOfCp(1);
    G.powers.UK.hand = [];
    G.powers.FR.hand = [frCard];
    G.powers.OT.hand = [];

    playUrabi(G, [1]);
    // The UK has no bid card, so France is the first (and only) bidder.
    expect(G.pending?.power).toBe("FR");
    expect(resolvePending(G, makeCtx([1], seat("FR")), `card:${frCard}`)).toBeUndefined();
    expect(G.pending).toBeNull();

    for (const id of EGYPT) {
      expect(G.spaces[id].control).toBe("FR");
      expect(G.spaces[id].homeOverride).toBe("FR");
    }
    expect(G.spaces.egypt.keyTypeOverride).toBe("colonial");
    expect(G.powers.FR.territorialKeys).toBe(9);
    expect(G.powers.FR.colonialKeys).toBe(1);
    expect(G.powers.UK.colonialKeys).toBe(7);
    expect(effectiveKeyType(G, "egypt")).toBe("colonial");
  });

  test("an Ottoman win keeps the printed territorial key and does not set an override", () => {
    const G = fresh();
    // All three bidders pass; the Ottoman diplomacy marker gives the +2.
    G.powers.UK.hand = [];
    G.powers.FR.hand = [];
    G.powers.OT.hand = [];
    G.spaces.egypt.diplomacy = "OT";

    playUrabi(G, [1, 1, 1]);
    expect(G.pending).toBeNull();

    for (const id of EGYPT) {
      expect(G.spaces[id].control).toBe("OT");
      expect(G.spaces[id].homeOverride).toBeUndefined();
    }
    expect(G.spaces.egypt.keyTypeOverride).toBeUndefined();
    expect(effectiveKeyType(G, "egypt")).toBe("territorial");
    expect(G.powers.UK.territorialKeys).toBe(5);
    expect(G.powers.UK.colonialKeys).toBe(7);
    // 33.6: with Egypt OT-controlled the land LoC Egypt - Great Sand Sea -
    // Benghazi - Tripoli exists, so Tripoli and Tunisia count as keys too.
    expect(G.powers.OT.territorialKeys).toBe(10);
    expect(G.powers.OT.arabKeys).toBe(6);
  });
});

describe("Egypt key type — display helper", () => {
  test("a manually set override is honoured without touching other spaces", () => {
    const G = fresh();
    G.spaces.egypt.control = "UK";
    G.spaces.egypt.keyTypeOverride = "colonial";
    recomputeTracks(G);
    expect(effectiveKeyType(G, "egypt")).toBe("colonial");
    expect(effectiveKeyType(G, "sinai")).toBeUndefined();
    expect(G.powers.UK.colonialKeys).toBe(8);
    expect(G.powers.UK.territorialKeys).toBe(5);
  });
});

describe("Egypt key type — dynamic legacy-save fallback", () => {
  test("a UK/FR home override without an explicit key-type field still counts as colonial", () => {
    const G = fresh();
    G.spaces.egypt.control = "FR";
    G.spaces.egypt.homeOverride = "FR";
    expect(G.spaces.egypt.keyTypeOverride).toBeUndefined();

    recomputeTracks(G);
    expect(effectiveKeyType(G, "egypt")).toBe("colonial");
    expect(keySpaces(G)).toContain("egypt");
    expect(G.powers.FR.colonialKeys).toBe(1);
    expect(G.powers.FR.territorialKeys).toBe(9);
  });

  test("a printed Egyptian control (OT or the minor) keeps the territorial key", () => {
    const G = fresh();
    G.spaces.egypt.homeOverride = "UK";
    G.spaces.egypt.control = "OT";
    expect(effectiveKeyType(G, "egypt")).toBe("territorial");
    G.spaces.egypt.control = "Egypt";
    expect(effectiveKeyType(G, "egypt")).toBe("territorial");
  });
});
