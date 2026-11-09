import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Sack! (card #44)", () => {
    it("makes adjacent enemy fortresses surrender on a die above their defenders", () => {
        const G = game();
        if (!G.powers.england.cards.includes("vq-044")) G.powers.england.cards.push("vq-044");
        G.spaces.portsmouth.control = "england";
        G.spaces.portsmouth.fortress = true;
        G.spaces.dover.control = "france";
        G.spaces.dover.fortress = true;
        G.spaces.dover.land.france = {regular: 1, merc: 0, cav: 0};
        G.lastCapture = {space: "portsmouth", attacker: "england", impulse: G.impulse};

        expect(playCard(G, context(), {cardId: "vq-044", asEvent: true, target: "portsmouth"})).toBeUndefined();

        expect(G.spaces.dover.control).toBe("england");
        expect(G.powers.france.marriageCardModifier).toBe(1);
    });
});
