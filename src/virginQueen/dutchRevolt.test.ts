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

const resolve = (spanish: number): {protestant: number; england: number; spain: number} => {
    const G = game();
    if (!G.powers.spain.cards.includes("vq-083")) G.powers.spain.cards.push("vq-083");
    const netherlands = SPACES.filter((space) => space.area === "netherlands");
    netherlands.forEach((space, index) => {
        G.spaces[space.id].control = index < spanish ? "spain" : "protestant";
        G.spaces[space.id].unrest = false;
    });
    const before = {protestant: G.powers.protestant.bonusVp, england: G.powers.england.bonusVp, spain: G.powers.spain.bonusVp};
    playCard(G, context(), {cardId: "vq-083", asEvent: true});
    return {
        protestant: G.powers.protestant.bonusVp - before.protestant,
        england: G.powers.england.bonusVp - before.england,
        spain: G.powers.spain.bonusVp - before.spain,
    };
};

describe("Dutch Revolt (card #83)", () => {
    it("uses the Spanish-controlled Netherlands VP table", () => {
        expect(resolve(0)).toEqual({protestant: 3, england: 0, spain: 0});
        expect(resolve(1)).toEqual({protestant: 2, england: 1, spain: 0});
        expect(resolve(8)).toEqual({protestant: 1, england: 1, spain: 1});
        expect(resolve(12)).toEqual({protestant: 0, england: 0, spain: 2});
        expect(resolve(19)).toEqual({protestant: 0, england: 0, spain: 2});
    });
});
