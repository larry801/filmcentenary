import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {SPACE_BY_ID} from "./mapData";
import {arriveLeaders, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "spring",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("naval leader arrival", () => {
    it("places a returning naval leader in a home port", () => {
        const G = game();
        G.leaders.santaCruz = {id: "santaCruz", location: "pool", returnTurn: G.year};
        G.spaces.madrid.control = "spain";

        arriveLeaders(G);

        expect(G.leaders.santaCruz.location).not.toBe("madrid");
        expect(SPACE_BY_ID[G.leaders.santaCruz.location].ports).toBeDefined();
    });
});
