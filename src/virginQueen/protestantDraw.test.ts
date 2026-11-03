import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {DUTCH_KEYS, KEY_SPACES} from "./mapData";
import {drawCount, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "5",
    playerID: "5",
    phase: "cardDraw",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const clearKeys = (G: VQGame): void => {
    for (const id of KEY_SPACES) {
        G.spaces[id].control = "spain";
        G.spaces[id].unrest = false;
    }
};

const setKeys = (G: VQGame, ids: string[]): void => {
    for (const id of ids) G.spaces[id].control = "protestant";
};

describe("Protestant Dutch/Huguenot card draw (23.6)", () => {
    it("uses the lower of the two key rows", () => {
        const G = game();
        clearKeys(G);
        expect(drawCount(G, "protestant")).toBe(4);

        setKeys(G, [DUTCH_KEYS[0]]);
        expect(drawCount(G, "protestant")).toBe(4);

        setKeys(G, [KEY_SPACES.find((id) => !DUTCH_KEYS.includes(id))!]);
        expect(drawCount(G, "protestant")).toBe(5);

        setKeys(G, [DUTCH_KEYS[1], KEY_SPACES.filter((id) => !DUTCH_KEYS.includes(id))[1]]);
        expect(drawCount(G, "protestant")).toBe(6);

        setKeys(G, [DUTCH_KEYS[2], KEY_SPACES.filter((id) => !DUTCH_KEYS.includes(id))[2]]);
        expect(drawCount(G, "protestant")).toBe(7);
    });
});
