import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {SPACES} from "./mapData";
import {setupGame} from "./util";

const context = (player: string): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context("1"), phase: "action"} as Ctx);

describe("Tenth Penny (card #69)", () => {
    it("only rebels in the Netherlands, never in an eligible French space", () => {
        const G = game();
        G.powers.protestant.cards = ["vq-069"];
        for (const space of SPACES.filter((def) => def.area === "france")) {
            G.spaces[space.id].religion = "catholic";
        }
        for (const space of SPACES.filter((def) => def.area === "netherlands")) {
            G.spaces[space.id].religion = "catholic";
        }
        G.spaces.paris.control = "france";
        G.spaces.paris.religion = "protestant";
        G.spaces.paris.siege = undefined;
        G.spaces.paris.land = {};

        expect(playCard(G, context("5"), {cardId: "vq-069", asEvent: true})).toBeUndefined();

        expect(G.spaces.paris.control).toBe("france");
        expect(G.spaces.paris.religion).toBe("protestant");
        expect(G.powers.protestant.wars).not.toContain("france");
    });

    it("chooses a Netherlands target when one is available", () => {
        const G = game();
        G.powers.protestant.cards = ["vq-069"];
        for (const space of SPACES.filter((def) => def.area === "france")) {
            G.spaces[space.id].religion = "catholic";
        }
        for (const space of SPACES.filter((def) => def.area === "netherlands")) {
            G.spaces[space.id].religion = "catholic";
        }
        G.spaces.brussels.control = "spain";
        G.spaces.brussels.religion = "protestant";
        G.spaces.brussels.siege = undefined;
        G.spaces.brussels.land = {};

        expect(playCard(G, context("5"), {cardId: "vq-069", asEvent: true})).toBeUndefined();

        expect(G.spaces.brussels.control).toBe("protestant");
    });

    it("lets Spain take a random Protestant card", () => {
        const G = game();
        G.powers.spain.cards = ["vq-069"];
        G.powers.protestant.cards = ["vq-020"];

        expect(playCard(G, context("1"), {cardId: "vq-069", asEvent: true})).toBeUndefined();

        expect(G.powers.protestant.cards).toHaveLength(0);
        expect(G.powers.spain.cards).toContain("vq-020");
        expect(G.lockedCards?.spain).toContain("vq-020");
        G.powers.spain.cardPlayed = false;
        expect(playCard(G, context("1"), {cardId: "vq-020", asEvent: true, target: "venice"})).toBe("INVALID_MOVE");
    });
});
