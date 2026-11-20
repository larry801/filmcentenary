import {Ctx} from "boardgame.io";
import {POWERS, TREASURE_TABLE, Treasure, VQGame} from "./constant/general";
import {VirginQueenGameDef} from "./game";
import {playTreasure} from "./moves";
import {
    addTreasure,
    dealYear,
    discardTreasure,
    drawTreasure,
    ensureTreasurePool,
    freshTreasurePool,
    mixTreasureDiscards,
    setupGame,
    treasuresInPlay,
    winter,
} from "./util";

/**
 * Rule 6.3: "supplemented by a pool of 30 treasure counters... Treasures are
 * drawn from this pile as needed... As treasures are spent during play, set
 * them aside with their values revealed to form a discard pile of treasures
 * expended that turn. These counters are mixed back into the treasure pool as
 * part of the final step of the Card Draw Phase."
 *
 * The pool is therefore finite: a draw removes a counter, a spent counter waits
 * in the discard pile, and only the Card Draw returns it.
 */

const context = (values: number[] = [], player = "0", phase = "action"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 1, Shuffle: (cards: unknown[]) => [...cards].reverse()},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

/** All physical counters, wherever they currently are: pool, discard and play. */
const everyCounter = (G: VQGame): number =>
    (G.treasurePool ?? []).length +
    (G.treasureDiscard ?? []).length +
    treasuresInPlay(G).length;

/**
 * Move an existing counter from the pool into a power's hand, so a test can
 * name a specific value without duplicating a counter.
 */
const give = (G: VQGame, power: (typeof POWERS)[number], value: Treasure): void => {
    const index = (G.treasurePool ?? []).indexOf(value);
    expect(index).toBeGreaterThanOrEqual(0);
    G.treasurePool!.splice(index, 1);
    G.powers[power].treasures.push(value);
};

describe("the treasure pool is physical and exhaustible (rule 6.3)", () => {
    it("starts from exactly the official 30-counter mix", () => {
        const G = game();
        const all = [...(G.treasurePool ?? []), ...treasuresInPlay(G)].sort();
        expect(all).toHaveLength(TREASURE_TABLE.length);
        expect(all).toEqual([...TREASURE_TABLE].sort());
        expect(G.treasureDiscard).toEqual([]);
    });

    it("takes one counter per draw and never creates a new one", () => {
        const G = game();
        const before = G.treasurePool!.length;
        const drawn = drawTreasure(G, context([1]));
        expect(drawn).toBeDefined();
        expect(G.treasurePool).toHaveLength(before - 1);
        // A drawn counter is in a hand, not duplicated: the total is unchanged.
        G.powers.england.treasures.push(drawn!);
        expect(everyCounter(G)).toBe(30);
    });

    it("goes empty once every counter is held, then stops yielding draws", () => {
        const G = game();
        G.powers.france.treasures.push(...(G.treasurePool ?? []));
        G.treasurePool = [];

        expect(drawTreasure(G, context([1]))).toBeUndefined();
        expect(everyCounter(G)).toBe(30);
    });

    it("moves a spent counter to the revealed discard pile, not back to the pool", () => {
        const G = game();
        give(G, "ottoman", 4);
        G.powers.ottoman.cards = [];
        G.powers.ottoman.cardPlayed = true;
        const poolBefore = G.treasurePool!.length;

        expect(playTreasure(G, context([], "0"), {index: 0})).toBeUndefined();

        expect(G.powers.ottoman.treasures).toEqual([]);
        expect(G.treasureDiscard).toEqual([4]);
        expect(G.treasurePool).toHaveLength(poolBefore);
        expect(everyCounter(G)).toBe(30);
    });

    it("keeps the 1 VP treasure out of the discard pile (rule 11)", () => {
        const G = game();
        G.powers.ottoman.cards = [];
        give(G, "ottoman", "vp");
        G.powers.ottoman.cardPlayed = true;

        expect(playTreasure(G, context([], "0"), {index: 0})).toBeUndefined();

        expect(G.powers.ottoman.bonusVp).toBe(1);
        expect(G.treasureDiscard).toEqual([]);
        // The 1 VP counter is out of play for good, so the physical total drops.
        expect(everyCounter(G)).toBe(29);
    });

    it("mixes spent counters back in only at the final Card Draw step", () => {
        const G = game();
        give(G, "france", 2);
        give(G, "protestant", "drawCard");
        discardTreasure(G, ...G.powers.france.treasures.splice(0), ...G.powers.protestant.treasures.splice(0));
        expect(G.treasureDiscard).toEqual([2, "drawCard"]);
        const poolBefore = G.treasurePool!.length;

        // Rows are filled after the mix, so the pool first grows by the 2
        // discards and then shrinks by the 4 Spanish + 3 Portuguese boxes.
        dealYear(G, context(Array.from({length: 10}, () => 1), "0", "cardDraw"));

        expect(G.treasureDiscard).toEqual([]);
        expect(G.spanishTreasureRow).toHaveLength(4);
        // Spanish row only: Portugal has not entered play in this setup.
        expect(G.spanishTreasureRow).toHaveLength(4);
        expect(G.treasurePool).toHaveLength(poolBefore + 2 - 4);
        // Four row treasures plus Spain's starting hand treasure stay in play.
        expect(treasuresInPlay(G)).toHaveLength(5);
        expect(everyCounter(G)).toBe(30);
    });

    it("leaves row boxes unfilled when the pool is too small", () => {
        const G = game();
        G.powers.spain.treasures = [];
        G.spanishTreasureRow = [];
        G.portugueseTreasures = [];
        G.treasureDiscard = [];
        G.treasurePool = [1, 2];

        dealYear(G, context(Array.from({length: 4}, () => 1), "0", "cardDraw"));

        // Only two counters existed, so only two boxes can be filled.
        expect(G.spanishTreasureRow).toHaveLength(2);
        expect(G.treasurePool).toEqual([]);
        expect(G.log.join("\n")).toContain("treasure pool holds only 2");
    });

    it("adds treasures from the pool, or nothing when it is empty", () => {
        const G = game();
        G.treasurePool = [5];
        addTreasure(G, context([1]), "england", 2);
        expect(G.powers.england.treasures).toEqual([5]);
        expect(G.treasurePool).toEqual([]);
    });

    it("discards at Winter and returns everything at the next Card Draw", () => {
        const G = game();
        give(G, "spain", 3);
        give(G, "spain", 4);
        winter(G, context([1, 1]));
        expect(G.powers.spain.treasures).toEqual([]);
        expect(G.treasureDiscard).toEqual(expect.arrayContaining([3, 4]));
        expect(everyCounter(G)).toBe(30);
    });

    it("never lets held + pool + discard exceed the 30-counter mix", () => {
        const G = game();
        expect(everyCounter(G)).toBe(30);
        G.philippinesSpanish = true;
        dealYear(G, context(Array.from({length: 20}, () => 1), "0", "cardDraw"));
        expect(everyCounter(G)).toBe(30);
    });

    it("mixes a hand's discards back without duplicating a counter", () => {
        const G = game();
        give(G, "france", 1);
        give(G, "france", 2);
        const before = [...(G.treasurePool ?? []), ...G.powers.france.treasures].sort();
        discardTreasure(G, ...G.powers.france.treasures.splice(0));
        mixTreasureDiscards(G, context());
        expect([...(G.treasurePool ?? [])].sort()).toEqual(before);
        expect(G.treasureDiscard).toEqual([]);
    });
});

describe("pre-pool saves migrate without inventing counters", () => {
    it("rebuilds the pool from the mix minus everything already held", () => {
        const G = game();
        const held = treasuresInPlay(G).length;
        delete G.treasurePool;
        delete G.treasureDiscard;

        ensureTreasurePool(G);

        expect(G.treasurePool).toHaveLength(30 - held);
        expect(G.treasureDiscard).toEqual([]);
        expect(everyCounter(G)).toBe(30);
    });
});

describe("setup draws starting treasures from the same pool", () => {
    it("accounts for every scenario starting treasure inside the 30", () => {
        const G = game();
        const held = POWERS.reduce((total, p) => total + G.powers[p].treasures.length, 0);
        expect(held).toBeGreaterThan(0);
        expect(everyCounter(G)).toBe(30);
        expect(G.treasurePool).toHaveLength(30 - held);
        // The pool is a subset of the official mix, never a fresh copy.
        expect(freshTreasurePool()).toHaveLength(30);
    });
});

describe("the face-down pool is hidden from clients", () => {
    it("exposes only the pool count in playerView", () => {
        const G = game();
        const view = VirginQueenGameDef.playerView!(G, context(), "0") as VQGame;
        expect(view.treasurePool).toBeUndefined();
        expect(view.treasurePoolCount).toBe((G.treasurePool ?? []).length);
        // The revealed discard pile stays public.
        discardTreasure(G, 2);
        expect((VirginQueenGameDef.playerView!(G, context(), "0") as VQGame).treasureDiscard).toEqual([2]);
    });
});
