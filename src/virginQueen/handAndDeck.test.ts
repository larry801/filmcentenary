import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {ransom, setTreasureFleetEscorts} from "./moves";
import {availableHomeCards, dealYear, drawRandomMixedFromHand, setupGame} from "./util";

const context = (values: number[] = [6], playerID = "3", phase = "diplomacy"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase,
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => [...cards].reverse()},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), numPlayers: 6} as Ctx);

describe("random hand draw follows the mixed-hand rule (rule 6.3)", () => {
    it("draws a treasure when treasures outnumber cards", () => {
        const G = game();
        G.powers.spain.cards = ["vq-054"];
        G.powers.spain.treasures = [2, 3, 4];
        const drawn = drawRandomMixedFromHand(G, context([1]), "spain");
        expect(drawn?.kind).toBe("treasure");
        expect(G.powers.spain.treasures).toHaveLength(2);
        expect(G.powers.spain.cards).toContain("vq-054");
    });

    it("draws a card when cards outnumber treasures", () => {
        const G = game();
        G.powers.spain.cards = ["vq-054", "vq-055", "vq-056"];
        G.powers.spain.treasures = [2];
        const drawn = drawRandomMixedFromHand(G, context([1]), "spain");
        expect(drawn?.kind).toBe("card");
        expect(G.powers.spain.treasures).toHaveLength(1);
    });

    it("draws a treasure when the counts are equal", () => {
        const G = game();
        G.powers.spain.cards = ["vq-054"];
        G.powers.spain.treasures = [2];
        expect(drawRandomMixedFromHand(G, context([1]), "spain")?.kind).toBe("treasure");
    });

    it("never draws a Home card", () => {
        const G = game();
        G.powers.spain.cards = ["vq-003"]; // Spanish Road, a Home card
        G.powers.spain.treasures = [];
        expect(drawRandomMixedFromHand(G, context([1]), "spain")).toBeUndefined();
    });
});

describe("ransom honours the mixed-hand rule (rules 9.3 / 6.3)", () => {
    it("takes a treasure when the payer holds only treasures", () => {
        const G = game();
        G.powers.france.cards = [];
        G.powers.france.treasures = [3];
        G.leaders.montmorency = {id: "montmorency", location: "captured", capturedBy: "spain"};
        const before = G.powers.france.treasures.length;
        expect(ransom(G, context([3], "3"), {leaderId: "montmorency"})).toBeUndefined();
        expect(G.powers.france.treasures.length).toBe(before - 1);
        expect(G.powers.spain.treasures).toContain(3);
    });
});

describe("Treasure Fleet escorts move one way per Spring (rule 10.1)", () => {
    it("bars reversing direction in the same Spring", () => {
        const G = game();
        G.spaces.seville.naval.spain = {galley: 0, galleon: 2, racebuilt: 0, corsair: 0};
        expect(setTreasureFleetEscorts(G, context([], "1", "spring"), {count: 2})).toBeUndefined();
        expect(setTreasureFleetEscorts(G, context([], "1", "spring"), {count: 0})).toBe("INVALID_MOVE");
        // A new Spring clears the restriction.
        dealYear(G, context([6], "1", "cardDraw"));
        expect(setTreasureFleetEscorts(G, context([], "1", "spring"), {count: 0})).toBeUndefined();
    });
});

describe("conditional cards wait for the Catholic League (rule 6.2)", () => {
    it("keeps the 'When Catholic League Forms' home card out of the hand beforehand", () => {
        const G = game();
        G.scenario = "campaign";
        G.catholicLeagueFormed = undefined;
        expect(availableHomeCards(G, "protestant")).not.toContain("vq-111");
    });

    it("adds it after the League forms", () => {
        const G = game();
        G.scenario = "campaign";
        G.catholicLeagueFormed = true;
        expect(availableHomeCards(G, "protestant")).toContain("vq-111");
    });
});

describe("card markers expire after one deal (rule 6.2)", () => {
    it("clears a Topcliffe +1 Card marker at the next Card Draw", () => {
        const G = game();
        G.powers.spain.cardModifier = 1;
        dealYear(G, context([6], "3", "cardDraw"));
        expect(G.powers.spain.cardModifier).toBe(0);
    });

    it("keeps the Suez +1 Card marker", () => {
        const G = game();
        G["suez" + "Done"] = true;
        dealYear(G, context([6], "0", "cardDraw"));
        expect(G.powers.ottoman.cardModifier).toBe(1);
    });
});

describe("the Spanish treasure row is refilled every Card Draw (rule 6.3)", () => {
    it("deals a fresh row even when Spain holds treasures in hand", () => {
        const G = game();
        G.powers.spain.treasures = [1, 2, 3];
        G.spanishTreasureRow = [];
        dealYear(G, context([6], "1", "cardDraw"));
        expect(G.spanishTreasureRow).toHaveLength(4);
    });
});
