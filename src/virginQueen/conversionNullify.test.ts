import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {chooseConversionNullify, playCard, preach} from "./moves";
import {moveError} from "./movePolicy";
import {setupGame} from "./util";

const context = (values: number[], playerID = "5"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 2, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context([]), phase: "action"} as Ctx);

const unrestCount = (G: VQGame): number =>
    Object.values(G.spaces).filter((space) => space.unrest).length;

describe("rule 18.5 step 4 interactive Unrest cancellation", () => {
    it("pauses a player conversion when a 1 and a 6 are rolled", () => {
        const G = game();
        G.powers.protestant.cp = 2;
        expect(preach(G, context([1, 6, 2, 2, 2]), {area: "france"})).toBeUndefined();
        expect(G.pendingConversion?.power).toBe("protestant");
        expect(G.pendingConversion?.dice).toEqual([1, 6, 2, 2, 2]);
    });

    it("cancels the Unrest when a 6 is reduced to a 5", () => {
        const G = game();
        G.powers.protestant.cp = 2;
        const before = unrestCount(G);
        expect(preach(G, context([1, 6, 2, 2, 2]), {area: "france"})).toBeUndefined();
        const dice = G.pendingConversion!.dice;
        const index = dice.indexOf(6);

        expect(chooseConversionNullify(G, context([], "5"), {downgrade: index})).toBeUndefined();
        expect(G.pendingConversion).toBeUndefined();
        expect(unrestCount(G)).toBe(before);
        expect(G.lastRolls).toContain("5");
    });

    it("keeps the Unrest when the power declines the downgrade", () => {
        const G = game();
        G.powers.protestant.cp = 2;
        const before = unrestCount(G);
        expect(preach(G, context([1, 6, 2, 2, 2]), {area: "france"})).toBeUndefined();

        expect(chooseConversionNullify(G, context([], "5"), {downgrade: "none"})).toBeUndefined();
        expect(G.pendingConversion).toBeUndefined();
        expect(unrestCount(G)).toBe(before + 1);
    });

    it("pauses conversions triggered by an event card and drains the queue", () => {
        const G = game();
        G.powers.protestant.cards = ["vq-032"];
        // Calvinist Zeal rolls seven dice for France, then seven for the
        // Netherlands.  Only the first batch offers the Step 4 choice.
        const dice = [1, 6, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
        expect(playCard(G, context(dice), {cardId: "vq-032", asEvent: true})).toBeUndefined();
        expect(G.pendingConversion?.area).toBe("france");
        expect(G.pendingConversionQueue).toHaveLength(1);
        expect(G.pendingConversionQueue?.[0].area).toBe("netherlands");

        expect(moveError(G, "chooseConversionNullify", {downgrade: 0})).toBeUndefined();
        const index = G.pendingConversion!.dice.indexOf(6);
        expect(chooseConversionNullify(G, context([], "5"), {downgrade: index})).toBeUndefined();
        expect(G.pendingConversion).toBeUndefined();
        expect(G.pendingConversionQueue).toBeUndefined();
        // Both areas were resolved, and the France batch kept no Unrest.
        expect(G.log.filter((line) => line.includes("conversions in")).length).toBe(2);
    });

    it("lets the active seat resolve an event choice for the converting power", () => {
        const G = game();
        G.powers.protestant.cards = ["vq-032"];
        expect(playCard(G, context([1, 6, 2, 2, 2, 2, 2]), {cardId: "vq-032", asEvent: true})).toBeUndefined();
        expect(G.pendingConversion).toBeDefined();

        // Spain is the active seat; the Protestant owns the conversion.
        const index = G.pendingConversion!.dice.indexOf(6);
        expect(chooseConversionNullify(G, context([], "1"), {downgrade: index})).toBeUndefined();
        expect(G.pendingConversion).toBeUndefined();
    });

    it("only allows downgrading an actual rolled 6", () => {
        const G = game();
        G.powers.protestant.cp = 2;
        expect(preach(G, context([1, 6, 2, 2, 2]), {area: "france"})).toBeUndefined();
        expect(chooseConversionNullify(G, context([], "5"), {downgrade: 2})).toBe(INVALID_MOVE);
        expect(G.pendingConversion).toBeDefined();
    });
});
