import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {moveLand} from "./moves";
import {setupGame} from "./util";

const context = (values: number[] = [1]): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), numPlayers: 6} as Ctx);

/**
 * Rule 13.1: "One or more army leaders may move without accompanying land
 * units as long as they don't enter a space controlled by an enemy power or
 * containing enemy units. If an army leader is ever alone in an unfortified
 * space when enemy land units enter ... that leader is captured."
 */
describe("lone army leaders (rule 13.1)", () => {
    it("moves a leader without any land units", () => {
        const G = game();
        G.powers.france.cp = 2;
        G.spaces.paris.land = {};
        G.spaces.paris.control = "france";
        G.spaces.paris.unrest = false;
        G.spaces.paris.leaders = ["guise"];
        G.leaders.guise = {id: "guise", location: "paris"};
        G.spaces.rouen.control = "france";
        G.spaces.rouen.unrest = false;
        G.spaces.rouen.land = {};
        G.spaces.rouen.leaders = [];

        // Use a friendly French space (Guise cannot leave the French area).
        expect(moveLand(G, context(), {
            from: "paris", to: "rouen", units: {}, leaders: ["guise"],
        })).toBeUndefined();
        expect(G.spaces.rouen.leaders).toContain("guise");
        expect(G.leaders.guise.location).toBe("rouen");
    });

    it("refuses to walk a lone leader into an enemy-occupied space", () => {
        const G = game();
        G.powers.france.cp = 2;
        G.powers.france.wars = ["england"];
        G.powers.england.wars = ["france"];
        G.spaces.paris.land = {};
        G.spaces.paris.control = "france";
        G.spaces.paris.unrest = false;
        G.spaces.paris.leaders = ["guise"];
        G.leaders.guise = {id: "guise", location: "paris"};
        G.spaces.rouen.control = "england";
        G.spaces.rouen.unrest = false;
        G.spaces.rouen.land = {england: {regular: 1, merc: 0, cav: 0}};
        G.spaces.rouen.leaders = [];

        expect(moveLand(G, context(), {
            from: "paris", to: "rouen", units: {}, leaders: ["guise"],
        })).toBe(INVALID_MOVE);
        expect(G.spaces.paris.leaders).toContain("guise");
    });

    it("captures a lone enemy leader when land units enter its unfortified space", () => {
        const G = game();
        G.powers.france.cp = 2;
        G.powers.france.wars = ["england"];
        G.powers.england.wars = ["france"];
        G.spaces.paris.land.france = {regular: 2, merc: 0, cav: 0};
        G.spaces.paris.control = "france";
        G.spaces.paris.unrest = false;
        // England's leader stands alone in the unfortified Amiens.
        G.spaces.amiens.control = "england";
        G.spaces.amiens.unrest = false;
        G.spaces.amiens.land = {};
        G.spaces.amiens.leaders = ["norreys"];
        G.leaders.norreys = {id: "norreys", location: "amiens"};

        expect(moveLand(G, context([1, 1, 1, 1]), {
            from: "paris", to: "amiens", units: {regular: 2}, leaders: [],
        })).toBeUndefined();

        expect(G.spaces.amiens.leaders).not.toContain("norreys");
        expect(G.leaders.norreys.location).toBe("captured");
        expect(G.leaders.norreys.capturedBy).toBe("france");
    });
});
