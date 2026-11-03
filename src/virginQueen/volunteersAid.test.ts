import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {SPACES} from "./mapData";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Foreign Volunteers / A Small Aid", () => {
    it("places three foreign volunteer regulars", () => {
        const G = game();
        G.powers.france.cards = ["vq-021"];
        for (const space of SPACES.filter((def) => def.home === "france")) {
            G.spaces[space.id].control = "france";
            G.spaces[space.id].land.france = {regular: 0, merc: 0, cav: 0};
            G.spaces[space.id].siege = undefined;
            G.spaces[space.id].unrest = false;
        }

        expect(playCard(G, context(), {cardId: "vq-021", asEvent: true})).toBeUndefined();

        expect(SPACES.filter((space) => space.home === "france" && (G.spaces[space.id].land.france?.regular ?? 0) === 1)).toHaveLength(3);
    });

    it("adds a regular to a small besieged fortress", () => {
        const G = game();
        G.powers.france.cards = ["vq-026"];
        G.spaces.brussels.control = "spain";
        G.spaces.brussels.siege = {by: "france", sinceImpulse: 1};
        G.spaces.brussels.land.spain = {regular: 2, merc: 0, cav: 0};

        expect(playCard(G, context(), {cardId: "vq-026", asEvent: true, target: "brussels"})).toBeUndefined();

        expect(G.spaces.brussels.land.spain?.regular).toBe(3);
    });
});
