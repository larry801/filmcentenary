import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {VirginQueenGameDef} from "./game";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    activePlayers: {2: "gregorianResponse"},
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Gregorian Calendar (card #101)", () => {
    it("sets the next power and survives turn end", () => {
        const G = game();
        G.powers.england.cards = ["vq-101"];
        G.gregorianResponse = {after: "spain", responder: "england"};

        expect(playCard(G, context(), {cardId: "vq-101", asEvent: true, target: "france"})).toBeUndefined();
        expect(G.gregorianNext).toBe("france");
        expect(G.removed).toContain("vq-101");
        expect(G.gregorianResponse).toBeUndefined();

        const onEnd = VirginQueenGameDef.phases!.action!.turn!.onEnd as (g: VQGame, ctx: Ctx) => void;
        onEnd(G, context());
        expect(G.activePower).toBe("france");
        expect(G.gregorianNext).toBeUndefined();
    });

    it("cannot be played as an ordinary active event", () => {
        const G = game();
        G.powers.england.cards = ["vq-101"];

        expect(playCard(G, context(), {cardId: "vq-101", asEvent: true, target: "france"})).toBe("INVALID_MOVE");
        expect(G.powers.england.cards).toContain("vq-101");
        expect(G.gregorianNext).toBeUndefined();
    });
});
