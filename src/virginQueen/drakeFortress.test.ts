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

describe("Drake expedition fortress destruction", () => {
    it("destroys a Spanish fortress on a pirate 6", () => {
        const G = game();
        G.worldCaptains.drake = {power: "england", location: "northAtlantic", damaged: false, colony: false};
        G.worldControls.atlanticCoast = "spain";
        G.worldFortresses = {atlanticCoast: "spain"};
        G.powers.england.cp = 10;

        expect(worldPiracy(G, context(), {captain: "drake"})).toBeUndefined();

        expect(G.worldFortresses.atlanticCoast).toBeUndefined();
    });
});
