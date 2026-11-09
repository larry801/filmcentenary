import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (values: number[] = []): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const prepare = (G: VQGame): void => {
    if (!G.powers.england.cards.includes("vq-036")) G.powers.england.cards.push("vq-036");
    G.powers.england.cardPlayed = false;
    const elizabeth = G.royals.find((r) => r.id === "elizabeth");
    if (elizabeth !== undefined) {
        elizabeth.alive = true;
        elizabeth.married = false;
    }
};

describe("Virgin Queen home card (rule 21.3)", () => {
    it("jilts Elizabeth's suitor and applies the Jilted Table", () => {
        const G = game();
        prepare(G);
        G.betrothals = [{male: "philip", female: "elizabeth"}];
        const handBefore = G.powers.england.cards.length;

        expect(playCard(G, context([6]), {cardId: "vq-036", asEvent: true})).toBeUndefined();

        expect(G.betrothals).toEqual([]);
        expect(G.powers.spain.marriageCardModifier).toBe(2);
        expect(G.powers.england.cards).not.toContain("vq-036");
        expect(G.powers.england.cards.length).toBe(handBefore);
    });

    it("gives the jilted power CP on a 2-4", () => {
        const G = game();
        prepare(G);
        G.betrothals = [{male: "philip", female: "elizabeth"}];
        const cp = G.powers.spain.cp;

        expect(playCard(G, context([4]), {cardId: "vq-036", asEvent: true})).toBeUndefined();

        // Rule 23.3: the CP is restricted to influence / mercenary actions.
        expect(G.powers.spain.cp).toBe(cp);
        expect(G.powers.spain.jiltedCp).toBe(4);
        expect(G.powers.spain.marriageCardModifier).toBe(0);
    });

    it("retrieves a card from the discard pile when not betrothed", () => {
        const G = game();
        prepare(G);
        G.betrothals = [];
        G.discard = ["vq-020"];

        expect(playCard(G, context([]), {cardId: "vq-036", asEvent: true})).toBeUndefined();

        expect(G.powers.england.cards).toContain("vq-020");
        expect(G.discard).not.toContain("vq-020");
    });

    it("cannot be played as an event after Elizabeth dies", () => {
        const G = game();
        prepare(G);
        G.royals.find((r) => r.id === "elizabeth")!.alive = false;

        expect(playCard(G, context([]), {cardId: "vq-036", asEvent: true})).toBe(INVALID_MOVE);
        expect(G.powers.england.cards).toContain("vq-036");
    });
});
