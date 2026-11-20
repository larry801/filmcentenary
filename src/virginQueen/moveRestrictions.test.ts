import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame, landCount} from "./constant/general";
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
 * Rule 13.1 restrictions on a Move action.
 */
describe("Move action restrictions (rule 13.1)", () => {
    it("forbids the besiegers from marching away in the impulse they closed the siege", () => {
        const G = game();
        G.powers.france.cp = 4;
        G.powers.france.wars = ["england"];
        G.powers.england.wars = ["france"];
        // Amiens is an English unfortified space; Rouen is the English fortress
        // the French just besieged, so the besiegers may not move this impulse.
        G.spaces.paris.land.france = {regular: 2, merc: 0, cav: 0};
        G.spaces.paris.control = "france";
        G.spaces.paris.unrest = false;
        G.spaces.rouen.control = "england";
        G.spaces.rouen.unrest = false;
        G.spaces.rouen.land = {england: {regular: 1, merc: 0, cav: 0}};
        G.spaces.rouen.siege = {by: "france", besiegers: ["france"], sinceImpulse: G.impulse};

        expect(moveLand(G, context(), {
            from: "rouen", to: "paris", units: {regular: 2}, leaders: [],
        })).toBe(INVALID_MOVE);
    });

    it("allows the besiegers to move in a later impulse", () => {
        const G = game();
        G.powers.france.cp = 4;
        G.spaces.paris.land.france = {regular: 1, merc: 0, cav: 0};
        G.spaces.paris.control = "france";
        G.spaces.paris.unrest = false;
        G.spaces.rouen.control = "england";
        G.spaces.rouen.unrest = false;
        G.spaces.rouen.land = {france: {regular: 2, merc: 0, cav: 0}, england: {regular: 1, merc: 0, cav: 0}};
        G.spaces.rouen.siege = {by: "france", besiegers: ["france"], sinceImpulse: G.impulse - 1};

        expect(moveLand(G, context(), {
            from: "rouen", to: "paris", units: {regular: 1}, leaders: [],
        })).toBeUndefined();
        // Moving away drops the besiegers to parity, which lifts the siege and
        // retreats the remaining besieger to Paris (rule 15.3).
        expect(G.log.join("\n")).toContain("The siege of Rouen is lifted");
        expect(landCount(G.spaces.paris.land.france)).toBe(3);
    });

    it("lets a formation enter a space garrisoned only by independent regulars", () => {
        const G = game();
        G.powers.france.cp = 4;
        // Geneva is an independent unfortified space with an independent
        // garrison; rule 13.1 says such units never prevent entry.
        G.spaces.geneva.control = "independent";
        G.spaces.geneva.unrest = false;
        G.spaces.geneva.land = {independent: {regular: 1, merc: 0, cav: 0}};
        G.spaces.lyon.control = "france";
        G.spaces.lyon.unrest = false;
        G.spaces.lyon.land = {france: {regular: 2, merc: 0, cav: 0}};

        expect(moveLand(G, context([1, 1, 1, 1]), {
            from: "lyon", to: "geneva", units: {regular: 2}, leaders: [],
        })).toBeUndefined();
        expect(landCount(G.spaces.geneva.land.france)).toBe(2);
    });
});
