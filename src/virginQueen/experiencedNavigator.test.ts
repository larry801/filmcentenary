import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {moveExpedition, playCard} from "./moves";
import {setupGame} from "./util";

const context = (values: number[] = []): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Experienced Navigator (card #43)", () => {
    it("adds +1 Navigation to a captain and changes a navigation result", () => {
        const G = game();
        if (!G.powers.england.cards.includes("vq-043")) G.powers.england.cards.push("vq-043");
        G.worldCaptains.frobisher = {power: "england", location: "chileanCoast", damaged: false, colony: false};
        G.powers.england.cp = 1;

        expect(playCard(G, context(), {cardId: "vq-043", asEvent: true, target: "frobisher"})).toBeUndefined();
        expect(G.worldCaptains.frobisher.navigationBonus).toBe(3);

        // Frobisher's printed Navigation is 2; with the bonus, 2+2+3 = 7 damages instead of eliminating him.
        expect(moveExpedition(G, context([2, 2]), {captain: "frobisher", zone: "southAtlantic"})).toBeUndefined();
        expect(G.worldCaptains.frobisher.damaged).toBe(true);
    });
});
