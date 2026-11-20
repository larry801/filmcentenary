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

/**
 * Rule 13.3: "Units of a power may not avoid battle if any units of that power
 * intercepted into the battle space during this Move action."  13.2 says the
 * intercepting units "may not avoid battle or withdraw" — the bar is per power,
 * so an allied co-defender in the same space still gets its own attempt.
 */
describe("avoid battle after an interception (rules 13.2/13.3)", () => {
    it("bars only the intercepting power, not another defender", () => {
        const G = game();
        // France moves into Amiens, which holds both English and Protestant
        // units. England's own units intercepted, so England may not avoid;
        // the Protestant stack is a separate power and may still try.
        G.powers.france.wars = ["england", "protestant"];
        G.powers.england.wars = ["france"];
        G.powers.protestant.wars = ["france"];
        G.spaces.paris.land.france = {regular: 3, merc: 0, cav: 0};
        G.spaces.paris.control = "france";
        G.spaces.paris.unrest = false;
        G.spaces.amiens.control = "england";
        G.spaces.amiens.unrest = false;
        G.spaces.amiens.land = {
            england: {regular: 1, merc: 0, cav: 0},
            protestant: {regular: 2, merc: 0, cav: 0},
        };
        G.spaces.rouen.control = "protestant";
        G.spaces.rouen.unrest = false;
        G.spaces.rouen.land = {};
        G.powers.france.cp = 3;
        // England's units intercepted into Amiens during this move.
        G.interceptedByThisMove = {amiens: "england"};

        expect(moveLand(G, context([6, 6]), {
            from: "paris", to: "amiens", units: {regular: 3}, leaders: [],
        })).toBeUndefined();

        const log = G.log.join("\n");
        // England's units intercepted and so may not avoid battle; the
        // Protestant stack is a separate power and escaped to Rouen.
        expect(log).not.toContain("英格兰 avoid-battle");
        expect(log).toContain("新教联盟 avoid-battle");
        expect(landCount(G.spaces.rouen.land.protestant)).toBe(2);
        // England stayed put and fought (2 hits removed 1 of its 1 units, so
        // the surviving unit count reflects the field battle, not a retreat).
        expect(log).toContain("Field battle");
    });

    it("still lets a power avoid when another power did the interception", () => {
        const G = game();
        G.powers.france.wars = ["england"];
        G.powers.england.wars = ["france"];
        G.spaces.paris.land.france = {regular: 2, merc: 0, cav: 0};
        G.spaces.paris.control = "france";
        G.spaces.paris.unrest = false;
        G.spaces.amiens.control = "england";
        G.spaces.amiens.unrest = false;
        G.spaces.amiens.land = {england: {regular: 2, merc: 0, cav: 0}};
        G.spaces.rouen.control = "england";
        G.spaces.rouen.unrest = false;
        G.spaces.rouen.land = {};
        G.powers.france.cp = 2;
        // A different power (Spain) intercepted elsewhere; England is untouched.
        G.interceptedByThisMove = {"flanders": "spain"};

        expect(moveLand(G, context([6, 6]), {
            from: "paris", to: "amiens", units: {regular: 2}, leaders: [],
        })).toBeUndefined();

        expect(G.log.join("\n")).toContain("avoids battle and moves to Rouen");
        expect(landCount(G.spaces.rouen.land.england)).toBe(2);
    });
});
