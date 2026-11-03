import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {SPACES} from "./mapData";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "5",
    playerID: "5",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Puritans (card #65)", () => {
    it("draws a random English card", () => {
        const G = game();
        if (!G.powers.protestant.cards.includes("vq-065")) G.powers.protestant.cards.push("vq-065");
        G.powers.england.cards = ["vq-020"];

        expect(playCard(G, context(), {cardId: "vq-065", asEvent: true})).toBeUndefined();

        expect(G.powers.england.cards).toHaveLength(0);
        expect(G.powers.protestant.cards).toContain("vq-020");
    });

    it("can have England discard the drawn card", () => {
        const G = game();
        if (!G.powers.protestant.cards.includes("vq-065")) G.powers.protestant.cards.push("vq-065");
        G.powers.england.cards = ["vq-020"];

        expect(playCard(G, context(), {cardId: "vq-065", asEvent: true, target: "discard"})).toBeUndefined();

        expect(G.powers.england.cards).toHaveLength(0);
        expect(G.powers.protestant.cards).not.toContain("vq-020");
        expect(G.discard).toContain("vq-020");
    });

    it("places three unrest when England has no cards", () => {
        const G = game();
        if (!G.powers.protestant.cards.includes("vq-065")) G.powers.protestant.cards.push("vq-065");
        G.powers.england.cards = [];
        for (const space of SPACES.filter((def) => def.home === "england")) {
            G.spaces[space.id].land = {};
            G.spaces[space.id].unrest = false;
        }

        expect(playCard(G, context(), {cardId: "vq-065", asEvent: true})).toBeUndefined();

        const unrest = SPACES.filter((space) => space.home === "england" && G.spaces[space.id].unrest).length;
        expect(unrest).toBe(3);
    });
});
