import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {LEADER_BY_ID} from "./constant/leaders";
import {resolveUntimelyDeath} from "./cardEvents";
import {arriveLeaders, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), numPlayers: 6} as Ctx);

const removeSpanishArmyLeaders = (G: VQGame): void => {
    for (const id of Object.keys(G.leaders)) {
        if (LEADER_BY_ID[id]?.power === "spain" && LEADER_BY_ID[id]?.kind === "army") {
            delete G.leaders[id];
        }
    }
};

describe("default army leaders (rule 5.1)", () => {
    it("uses battle 0 with command 6, or 8 for the Ottoman", () => {
        expect(LEADER_BY_ID["default-spain"]).toMatchObject({battle: 0, command: 6});
        expect(LEADER_BY_ID["default-ottoman"]).toMatchObject({battle: 0, command: 8});
    });

    it("places a default leader when the last standard army leader is removed", () => {
        const G = game();
        removeSpanishArmyLeaders(G);
        G.leaders.alba = {id: "alba", location: "madrid"};
        G.spaces.madrid.leaders = ["alba"];

        resolveUntimelyDeath(G, "alba");

        expect(G.leaders["default-spain"]).toMatchObject({location: "pool", returnTurn: G.year + 1});
        expect(G.log.join("\n")).toContain("Default Leader");
    });

    it("does not create a default leader while a standard army leader is captured", () => {
        const G = game();
        removeSpanishArmyLeaders(G);
        G.leaders.alba = {id: "alba", location: "captured", capturedBy: "england"};
        G.leaders.parma = {id: "parma", location: "captured", capturedBy: "england"};

        resolveUntimelyDeath(G, "alba");

        expect(G.leaders["default-spain"]).toBeUndefined();
    });

    it("brings the default leader onto the map when no standard leader is in play", () => {
        const G = game();
        removeSpanishArmyLeaders(G);
        G.leaders["default-spain"] = {id: "default-spain", location: "pool", returnTurn: G.year};
        G.year = 5;

        arriveLeaders(G);

        expect(G.leaders["default-spain"].location).toBe("madrid");
        expect(G.spaces.madrid.leaders).toContain("default-spain");
    });

    it("removes the default leader when a standard leader is in play", () => {
        const G = game();
        G.leaders["default-spain"] = {id: "default-spain", location: "madrid"};
        G.spaces.madrid.leaders.push("default-spain");
        expect(G.leaders.alba).toBeDefined();

        arriveLeaders(G);

        expect(G.leaders["default-spain"]).toBeUndefined();
        expect(G.spaces.madrid.leaders).not.toContain("default-spain");
    });
});
