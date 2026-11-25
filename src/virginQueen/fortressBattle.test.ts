import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {moveLand} from "./moves";
import {setupGame} from "./util";

const context = (values: number[] = [], player = "3"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

/**
 * Rule 13.4: only units whose power controls the fortified space may withdraw
 * behind its walls.  An enemy stack sitting in a fortress it does not control
 * must fight a field battle instead of being besieged without one.
 */
describe("a stack in a fortress it does not control", () => {
    it("fights a field battle instead of withdrawing", () => {
        const G = game();
        G.powers.france.cp = 5;
        G.spaces.paris.land.france = {regular: 4, merc: 0, cav: 0};
        G.spaces.orleans.control = "france";
        G.spaces.orleans.land = {england: {regular: 2, merc: 0, cav: 0}};
        G.spaces.orleans.leaders = [];
        G.spaces.orleans.siege = {by: "england", besiegers: ["england"], sinceImpulse: 0, inside: ["england"]};

        expect(moveLand(G, context([6, 6, 6, 6, 6, 6]), {
            from: "paris", to: "orleans", units: {regular: 4}, leaders: [],
        })).toBeUndefined();

        expect(G.log.join("\n")).toContain("Field battle");
        // England cannot withdraw into French walls; the stack is destroyed.
        expect(G.spaces.orleans.land.england).toBeUndefined();
        // France does not end up co-besieging its own fortress.
        expect(G.spaces.orleans.siege?.besiegers ?? []).not.toContain("france");
    });
});
