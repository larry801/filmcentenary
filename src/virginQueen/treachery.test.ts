import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Treachery! (card #31)", () => {
    it("starts an immediate assault on a besieged fortress", () => {
        const G = game();
        G.powers.france.cards = ["vq-031"];
        G.spaces.rotterdam.control = "spain";
        G.spaces.rotterdam.siege = {by: "france", sinceImpulse: 1};
        G.spaces.rotterdam.land.spain = {regular: 1, merc: 0, cav: 0};

        expect(playCard(G, context(), {cardId: "vq-031", asEvent: true, target: "rotterdam"})).toBeUndefined();

        expect(G.pendingBattle?.phase).toBe("assault");
        expect(G.pendingBattle?.attacker).toBe("france");
        expect(G.pendingBattle?.treachery).toBe(true);
    });
});
