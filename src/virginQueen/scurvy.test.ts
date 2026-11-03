import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {navigationCheck, setupGame} from "./util";

const context = (values: number[] = []): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Scurvy (card #45)", () => {
    it("applies -1 Navigation to the next check", () => {
        const G = game();
        if (!G.powers.england.cards.includes("vq-045")) G.powers.england.cards.push("vq-045");
        G.worldCaptains.frobisher = {power: "england", location: "chileanCoast", damaged: false, colony: false};

        expect(playCard(G, context(), {cardId: "vq-045", asEvent: true, target: "frobisher"})).toBeUndefined();
        expect(G.worldCaptains.frobisher.navigationPenalty).toBe(1);

        // Frobisher N2, dice 3+2, penalty 1: 3+2+2-1 = 6 -> eliminated.
        expect(navigationCheck(G, context([3, 2]), "frobisher")).toBe(false);
        expect(G.worldCaptains.frobisher).toBeUndefined();
        expect(G.lastRolls).toContain("= 6");
    });
});
