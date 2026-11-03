import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {scurvyNavigation} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Scurvy navigation option (card #45)", () => {
    it("forces a navigation check and discards the card", () => {
        const G = game();
        G.powers.england.cards = ["vq-045"];
        G.worldCaptains.drake = {power: "england", location: "northAtlantic", damaged: false, colony: false};

        expect(scurvyNavigation(G, context(), {captain: "drake"})).toBeUndefined();

        expect(G.powers.england.cards).not.toContain("vq-045");
        expect(G.lastRolls).toContain("Navigation");
    });
});
