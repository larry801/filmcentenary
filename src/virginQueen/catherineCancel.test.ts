import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {chooseCardEvent, playCard} from "./moves";
import {setupGame} from "./util";

const context = (player: string): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context("0"), phase: "action"} as Ctx);

describe("Catherine's Flying Squadron (card #42)", () => {
    it("cancels Sack!", () => {
        const G = game();
        G.powers.ottoman.cards = ["vq-044"];
        G.powers.england.cards = ["vq-042"];

        expect(playCard(G, context("0"), {cardId: "vq-044", asEvent: true, target: "rotterdam"})).toBeUndefined();
        expect(G.pendingCardEvent?.kind).toBe("cancelEvent");
        expect(chooseCardEvent(G, context("2"), {choice: "cancel"})).toBeUndefined();
        expect(G.powers.england.cards).not.toContain("vq-042");
    });

    it("cancels City State Rebels", () => {
        const G = game();
        G.powers.ottoman.cards = ["vq-018"];
        G.powers.england.cards = ["vq-042"];

        expect(playCard(G, context("0"), {cardId: "vq-018", asEvent: true, target: "rotterdam"})).toBeUndefined();
        expect(G.pendingCardEvent?.kind).toBe("cancelEvent");
        expect(chooseCardEvent(G, context("2"), {choice: "cancel"})).toBeUndefined();
        expect(G.powers.england.cards).not.toContain("vq-042");
    });

    it("cancels a listed event", () => {
        const G = game();
        G.powers.ottoman.cards = ["vq-052"];
        G.powers.england.cards = ["vq-042"];
        G.spaces.london.religion = "catholic";
        G.spaces.york.religion = "catholic";

        expect(playCard(G, context("0"), {cardId: "vq-052", asEvent: true})).toBeUndefined();
        expect(G.pendingCardEvent?.kind).toBe("cancelEvent");
        expect(G.pendingCardEvent?.responding).toBe("england");

        expect(chooseCardEvent(G, context("2"), {choice: "cancel"})).toBeUndefined();

        expect(G.powers.england.cards).not.toContain("vq-042");
        expect(G.spaces.london.religion).toBe("catholic");
        expect(G.spaces.york.religion).toBe("catholic");
    });

    it("does not cancel Huguenot Lent, which is not on the printed list", () => {
        const G = game();
        G.powers.ottoman.cards = ["vq-054"];
        G.powers.england.cards = ["vq-042"];

        expect(playCard(G, context("0"), {cardId: "vq-054", asEvent: true})).toBeUndefined();

        expect(G.pendingCardEvent).toBeUndefined();
        expect(G.powers.england.cards).toContain("vq-042");
    });

    it("still cancels Jeanne of Navarre", () => {
        const G = game();
        G.powers.ottoman.cards = ["vq-058"];
        G.powers.england.cards = ["vq-042"];

        expect(playCard(G, context("0"), {cardId: "vq-058", asEvent: true})).toBeUndefined();
        expect(G.pendingCardEvent?.kind).toBe("cancelEvent");
        expect(G.pendingCardEvent?.responding).toBe("england");

        expect(chooseCardEvent(G, context("2"), {choice: "cancel"})).toBeUndefined();
        expect(G.powers.england.cards).not.toContain("vq-042");
    });
});
