import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {moveLand} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

/** Paris can march into the friendly, empty fortress of Rouen without interception. */
const prepare = (G: VQGame): void => {
    G.spaces.paris.land.france = {regular: 0, merc: 0, cav: 0};
    G.spaces.paris.leaders = [];
    G.spaces.rouen.control = "france";
    G.spaces.rouen.land = {};
    G.spaces.rouen.unrest = false;
    G.powers.france.cp = 3;
};

describe("land formation limits (rule 5.2)", () => {
    it("caps a leaderless formation at four land units", () => {
        const G = game();
        prepare(G);
        G.spaces.paris.land.france = {regular: 5, merc: 0, cav: 0};

        expect(moveLand(G, context(), {from: "paris", to: "rouen", units: {regular: 5}, leaders: []})).toBe(INVALID_MOVE);
        expect(G.powers.france.cp).toBe(3);
        expect(G.spaces.rouen.land.france).toBeUndefined();

        expect(moveLand(G, context(), {from: "paris", to: "rouen", units: {regular: 4}, leaders: []})).toBeUndefined();
        expect(G.spaces.rouen.land.france).toEqual({regular: 4, merc: 0, cav: 0});
    });

    it("uses the command rating of a single moving leader", () => {
        const G = game();
        prepare(G);
        G.spaces.paris.land.france = {regular: 7, merc: 0, cav: 0};
        G.spaces.paris.leaders = ["guise"];

        // A leader who stays behind does not enlarge the formation.
        expect(moveLand(G, context(), {from: "paris", to: "rouen", units: {regular: 5}, leaders: []})).toBe(INVALID_MOVE);
        expect(moveLand(G, context(), {from: "paris", to: "rouen", units: {regular: 7}, leaders: ["guise"]})).toBe(INVALID_MOVE);

        // Guise has Command Rating 6.
        expect(moveLand(G, context(), {from: "paris", to: "rouen", units: {regular: 6}, leaders: ["guise"]})).toBeUndefined();
        expect(G.spaces.rouen.land.france).toEqual({regular: 6, merc: 0, cav: 0});
        expect(G.spaces.rouen.leaders).toContain("guise");
    });

    it("uses the two highest command ratings when more than one leader marches", () => {
        const G = game();
        prepare(G);
        G.spaces.paris.land.france = {regular: 14, merc: 0, cav: 0};
        G.spaces.paris.leaders = ["guise", "montmorency"];

        // Guise 6 + Montmorency 7 = 13.
        expect(moveLand(G, context(), {
            from: "paris", to: "rouen", units: {regular: 14}, leaders: ["guise", "montmorency"],
        })).toBe(INVALID_MOVE);
        expect(moveLand(G, context(), {
            from: "paris", to: "rouen", units: {regular: 13}, leaders: ["guise", "montmorency"],
        })).toBeUndefined();
        expect(G.spaces.rouen.land.france).toEqual({regular: 13, merc: 0, cav: 0});
    });
});
