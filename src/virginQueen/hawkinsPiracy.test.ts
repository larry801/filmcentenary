import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {worldPiracy} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("John Hawkins piracy rating", () => {
    it("uses piracy 2 on the Guinea Coast", () => {
        const G = game();
        G.worldCaptains.hawkins = {power: "england", location: "guineaCoast", damaged: false, colony: false};
        G.worldControls.guineaCoastColony = "spain";
        G.powers.england.cp = 10;

        expect(worldPiracy(G, context(), {captain: "hawkins"})).toBeUndefined();

        const dice = G.lastRolls.match(/\[([^\]]+)\]/)?.[1].split(",") ?? [];
        expect(dice).toHaveLength(3);
    });
});
