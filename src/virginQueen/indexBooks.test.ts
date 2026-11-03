import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {SPACES} from "./mapData";
import {patronById} from "./scenario";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Index of Prohibited Books (card #56)", () => {
    it("can cancel a patron's work", () => {
        const G = game();
        G.powers.spain.cards = ["vq-056"];
        const patron = G.patronsAvailable.map((id) => patronById(G, id)).find((candidate) => candidate?.rating !== null);
        expect(patron).toBeDefined();
        G.pendingPatronage = [{power: "spain", patronId: patron!.id, cp: 3}];

        expect(playCard(G, context(), {cardId: "vq-056", asEvent: true, target: patron!.id})).toBeUndefined();

        expect(G.pendingPatronage).toEqual([]);
        expect(G.patronReturn?.[patron!.id]).toBe(G.year + 1);
    });

    it("makes six Catholic conversion attempts", () => {
        const G = game();
        if (!G.powers.spain.cards.includes("vq-056")) G.powers.spain.cards.push("vq-056");
        for (const area of ["france", "netherlands", "scotland"] as const) {
            for (const space of SPACES.filter((def) => def.area === area).slice(0, 3)) {
                G.spaces[space.id].religion = "protestant";
            }
        }

        expect(playCard(G, context(), {cardId: "vq-056", asEvent: true})).toBeUndefined();

        expect(G.log.filter((line) => line.includes("conversions in")).length).toBe(6);
    });
});
