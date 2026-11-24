import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {SPACES} from "./mapData";
import {refreshJesuits} from "./espionage";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Edmund Campion (card #107)", () => {
    it("places a Jesuit and makes conversion attempts", () => {
        const G = game();
        G.year = 4;
        G.powers.spain.cards = ["vq-107"];
        // The printed event moves one Jesuit off Spain's power board.
        refreshJesuits(G);
        expect(G.espionage!.jesuitsOnCard).toBe(1);
        for (const space of SPACES.filter((def) => def.area === "england")) {
            G.spaces[space.id].land = {};
            G.spaces[space.id].unrest = false;
        }

        expect(playCard(G, context(), {cardId: "vq-107", asEvent: true, target: "york"})).toBeUndefined();

        expect(G.espionage?.jesuits).toContain("york");
        expect(G.espionage?.jesuitsOnCard).toBe(0);
        expect(G.log.join("\n")).toContain("Edmund Campion");
    });

    it("does nothing when Spain has no Jesuit left on its power board", () => {
        const G = game();
        G.year = 4;
        G.powers.spain.cards = ["vq-107"];
        G.espionage!.jesuitsOnCard = 0;
        G.espionage!.jesuits = [];
        for (const space of SPACES.filter((def) => def.area === "england")) G.spaces[space.id].land = {};

        playCard(G, context(), {cardId: "vq-107", asEvent: true, target: "york"});

        expect(G.espionage!.jesuits).toEqual([]);
        expect(G.log.join("\n")).toContain("no Jesuit remains on Spain's power board");
    });
});
