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

describe("El Dorado (card #51)", () => {
    it("ends a northern South America expedition and schedules its return", () => {
        const G = game();
        G.powers.england.cards = ["vq-051"];
        G.worldCaptains.drake = {power: "england", location: "spanishMain", damaged: false, colony: false, companion: "hawkins", treasureValues: [3, 4]};

        expect(playCard(G, context(), {cardId: "vq-051", asEvent: true, target: "drake"})).toBeUndefined();

        expect(G.worldCaptains.drake).toBeUndefined();
        expect(G.seaCaptainReturn?.drake.turn).toBe(G.year + 1);
        expect(G.seaCaptainReturn?.hawkins.turn).toBe(G.year + 1);
        expect(G.log.join("\n")).toContain("2 treasure(s) are lost");
    });
});
