import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {patronById} from "./scenario";
import {resolvePatronage, setupGame} from "./util";

const context = (values: number[]): Ctx => ({
    currentPlayer: "4",
    playerID: "4",
    phase: "winter",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context([]), phase: "action"} as Ctx);

describe("Prague Cultural Center (+2 patronage)", () => {
    it("adds +2 to the marked patron's roll", () => {
        const G = game();
        const patron = G.patronsAvailable.map((id) => patronById(G, id)).find((candidate) => candidate?.rating !== null);
        expect(patron).toBeDefined();
        G.pendingPatronage = [{power: "hre", patronId: patron!.id, cp: 3}];
        G.pragueCulturalCenter = patron!.id;

        resolvePatronage(G, context([3, 3]));

        expect(G.lastRolls).toContain("bonus 3");
    });
});
