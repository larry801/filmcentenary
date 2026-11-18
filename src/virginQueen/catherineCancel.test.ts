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
    it("cancels Sack! when the captured space is in France", () => {
        const G = game();
        G.powers.ottoman.cards = ["vq-044"];
        G.powers.england.cards = ["vq-042"];
        G.spaces.rouen.control = "ottoman";
        G.lastCapture = {space: "rouen", attacker: "ottoman", impulse: G.impulse};

        expect(playCard(G, context("0"), {cardId: "vq-044", asEvent: true, target: "rouen"})).toBeUndefined();
        expect(G.pendingCardEvent?.kind).toBe("cancelEvent");
        expect(chooseCardEvent(G, context("2"), {choice: "cancel"})).toBeUndefined();
        expect(G.powers.england.cards).not.toContain("vq-042");
    });

    it("cancels City State Rebels when the fortress is in France", () => {
        const G = game();
        // Metz is an independent key inside the French religious area, so it is
        // both a legal #18 target and a "target is France" space for #42.
        G.spaces.metz.control = "france";
        G.spaces.metz.fortress = true;
        G.spaces.metz.land = {france: {regular: 2, merc: 0, cav: 0}};
        G.powers.ottoman.cards = ["vq-018"];
        G.powers.england.cards = ["vq-042"];

        expect(playCard(G, context("0"), {cardId: "vq-018", asEvent: true, target: "metz"})).toBeUndefined();
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

    it("cancels Huguenot Lent too, as the printed card table lists it", () => {
        const G = game();
        G.powers.ottoman.cards = ["vq-054"];
        G.powers.england.cards = ["vq-042"];

        expect(playCard(G, context("0"), {cardId: "vq-054", asEvent: true})).toBeUndefined();

        expect(G.pendingCardEvent?.kind).toBe("cancelEvent");
        expect(G.pendingCardEvent?.responding).toBe("england");
        expect(G.powers.england.cards).toContain("vq-042");
    });

    it("does not cancel a France-only event whose target is outside France", () => {
        const G = game();
        // City State Rebels against Dublin, an occupied home fortress outside
        // the France area, so #42's "target is France" condition is not met.
        G.spaces.dublin.control = "england";
        G.spaces.dublin.fortress = true;
        G.spaces.dublin.land = {};
        G.powers.ottoman.cards = ["vq-018"];
        G.powers.england.cards = ["vq-042"];

        expect(playCard(G, context("0"), {cardId: "vq-018", asEvent: true, target: "dublin"})).toBeUndefined();

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
