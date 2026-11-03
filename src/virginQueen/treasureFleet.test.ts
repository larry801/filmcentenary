import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {setTreasureFleetEscorts} from "./moves";
import {refreshPortugueseTreasures, setupGame, winter} from "./util";

const context = (values: number[] = [], player = "1", phase = "action"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Treasure Fleet escorts and Portuguese treasures", () => {
    it("moves up to two galleons into and out of the escort box in Spring", () => {
        const G = game();
        G.spaces.seville.naval.spain = {galley: 0, galleon: 2, racebuilt: 0, corsair: 0};

        expect(setTreasureFleetEscorts(G, context([], "1", "spring"), {count: 2})).toBeUndefined();
        expect(G.treasureFleetEscorts).toBe(2);
        expect(G.spaces.seville.naval.spain).toBeUndefined();

        expect(setTreasureFleetEscorts(G, context([], "1", "spring"), {count: 0})).toBeUndefined();
        expect(G.treasureFleetEscorts).toBe(0);
        expect(G.spaces.seville.naval.spain.galleon).toBe(2);
        expect(setTreasureFleetEscorts(G, context([], "1", "spring"), {count: 3})).toBe(INVALID_MOVE);
    });

    it("awards one Portuguese treasure to the controller of Lisbon in Winter", () => {
        const G = game();
        G.portugalEntered = true;
        G.portugueseTreasures = [2, 3, 4];
        G.spaces.lisbon.control = "england";
        G.powers.england.treasures = [];

        winter(G, context([2]));

        expect(G.portugueseTreasures).toEqual([]);
        expect(G.powers.england.treasures).toHaveLength(1);
        expect([2, 3, 4]).toContain(G.powers.england.treasures[0]);
    });

    it("discards Portuguese treasures if no major controls Lisbon", () => {
        const G = game();
        G.portugalEntered = true;
        G.portugueseTreasures = [2, 3, 4];
        G.spaces.lisbon.control = "portugal";

        winter(G, context([2]));

        expect(G.portugueseTreasures).toEqual([]);
    });

    it("refills the three-box Portuguese row at Card Draw", () => {
        const G = game();
        G.portugalEntered = true;
        G.portugueseTreasures = [];

        refreshPortugueseTreasures(G, context([2, 3, 4]));

        expect(G.portugueseTreasures).toHaveLength(3);
    });
});
