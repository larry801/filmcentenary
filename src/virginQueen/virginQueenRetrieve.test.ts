import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Virgin Queen retrieve option (card #36)", () => {
    it("retrieves a card instead of jilting", () => {
        const G = game();
        G.powers.england.cards = ["vq-036"];
        G.betrothals = [{male: "charlesIX", female: "elizabeth"}];
        G.discard = ["vq-021", "vq-020"];

        expect(playCard(G, context(), {cardId: "vq-036", asEvent: true, target: "retrieve:vq-020"})).toBeUndefined();

        expect(G.powers.england.cards).toContain("vq-020");
        expect(G.discard).toContain("vq-021");
        expect(G.betrothals).toHaveLength(1);
    });
});
