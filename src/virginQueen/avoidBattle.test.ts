import {Ctx} from "boardgame.io";
import {VQGame, landCount} from "./constant/general";
import {moveLand} from "./moves";
import {setupGame} from "./util";

const context = (values: number[] = [6]): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), numPlayers: 6} as Ctx);

const prepare = (G: VQGame): void => {
    G.spaces.amiens.control = "england";
    G.spaces.amiens.land = {england: {regular: 2, merc: 0, cav: 0}};
    G.spaces.amiens.unrest = false;
    G.spaces.rouen.control = "england";
    G.spaces.rouen.land = {};
    G.spaces.rouen.unrest = false;
    G.spaces.paris.land.france = {regular: 2, merc: 0, cav: 0};
    G.powers.france.cp = 2;
};

describe("land avoid battle (rule 13.3)", () => {
    it("moves the defenders to a legal adjacent space on a successful roll", () => {
        const G = game();
        prepare(G);

        expect(moveLand(G, context([6, 6]), {
            from: "paris", to: "amiens", units: {regular: 2}, leaders: [],
        })).toBeUndefined();

        expect(G.log.join("\n")).toContain("avoids battle and moves to Rouen");
        expect(landCount(G.spaces.amiens.land.england)).toBe(0);
        expect(landCount(G.spaces.rouen.land.england)).toBe(2);
        expect(landCount(G.spaces.amiens.land.france)).toBe(2);
    });

    it("fights normally when the avoid roll fails", () => {
        const G = game();
        prepare(G);

        expect(moveLand(G, context([1, 1, 1, 1, 1, 1]), {
            from: "paris", to: "amiens", units: {regular: 2}, leaders: [],
        })).toBeUndefined();

        expect(G.log.join("\n")).toContain("avoid-battle at Amiens");
        expect(G.log.join("\n")).not.toContain("avoids battle and moves");
        expect(landCount(G.spaces.amiens.land.england)).toBe(2);
        expect(landCount(G.spaces.amiens.land.france)).toBe(0);
    });

    it("does not attempt avoid battle without a legal adjacent destination", () => {
        const G = game();
        G.spaces.amiens.control = "england";
        G.spaces.amiens.land = {england: {regular: 2, merc: 0, cav: 0}};
        G.spaces.amiens.unrest = false;
        for (const id of ["rouen", "calais", "brussels", "metz", "reims"]) {
            G.spaces[id].control = "independent";
            G.spaces[id].land = {};
            G.spaces[id].unrest = true;
        }
        G.spaces.paris.land.france = {regular: 2, merc: 0, cav: 0};
        G.powers.france.cp = 2;

        expect(moveLand(G, context([6, 6, 6, 6, 6, 6]), {
            from: "paris", to: "amiens", units: {regular: 2}, leaders: [],
        })).toBeUndefined();

        expect(G.log.join("\n")).not.toContain("avoid-battle at Amiens");
    });
});
