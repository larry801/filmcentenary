import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {SPACES} from "./mapData";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const resolve = (regulars: number): {england: number; spain: number} => {
    const G = game();
    if (!G.powers.spain.cards.includes("vq-100")) G.powers.spain.cards.push("vq-100");
    for (const def of SPACES.filter((space) => space.area === "england")) {
        const space = G.spaces[def.id];
        space.religion = "protestant";
        space.control = "england";
        space.unrest = false;
        delete space.land.spain;
    }
    G.spaces.london.land.spain = {regular: regulars, merc: 0, cav: 0};
    const england = G.powers.england.bonusVp;
    const spain = G.powers.spain.bonusVp;
    playCard(G, context(), {cardId: "vq-100", asEvent: true});
    return {england: G.powers.england.bonusVp - england, spain: G.powers.spain.bonusVp - spain};
};

describe("Enterprise of England (card #100)", () => {
    it("uses the 1-16+ table", () => {
        expect(resolve(0)).toEqual({england: 1, spain: -1});
        expect(resolve(3)).toEqual({england: 1, spain: 0});
        expect(resolve(5)).toEqual({england: 0, spain: 0});
        expect(resolve(7)).toEqual({england: 0, spain: 1});
        expect(resolve(11)).toEqual({england: -1, spain: 2});
        expect(resolve(16)).toEqual({england: -2, spain: 3});
    });

    it("counts Catholic and Spanish-controlled spaces even when they are in unrest", () => {
        const G = game();
        if (!G.powers.spain.cards.includes("vq-100")) G.powers.spain.cards.push("vq-100");
        const english = SPACES.filter((space) => space.area === "england");
        for (const def of english) {
            const space = G.spaces[def.id];
            space.religion = "protestant";
            space.control = "england";
            space.unrest = false;
            delete space.land.spain;
        }
        G.espionage!.jesuits = [];
        for (const def of english.slice(0, 2)) {
            G.spaces[def.id].religion = "catholic";
            G.spaces[def.id].control = "spain";
            G.spaces[def.id].unrest = true;
        }
        const england = G.powers.england.bonusVp;
        const spain = G.powers.spain.bonusVp;

        expect(playCard(G, context(), {cardId: "vq-100", asEvent: true})).toBeUndefined();

        // 2 Catholic + 2 Spanish-controlled = 4: England +1 VP, no Spanish VP.
        expect(G.powers.england.bonusVp - england).toBe(1);
        expect(G.powers.spain.bonusVp - spain).toBe(0);
    });
});
