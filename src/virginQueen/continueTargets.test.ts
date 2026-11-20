import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {continueTargets, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "0", playerID: "0", phase: "action", numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

/**
 * Rule 13.4: a formation that withdrew may continue "to an adjacent space",
 * subject to the normal 13.1 entry restrictions.  The UI used to offer every
 * neighbour, so a click on an illegal one produced no feedback at all.
 */
describe("continue-march destinations (rules 13.1/13.4)", () => {
    it("offers only spaces the formation may actually enter", () => {
        const G = game();
        G.powers.france.wars = ["england"];
        G.powers.england.wars = ["france"];
        G.spaces.paris.land.france = {regular: 2, merc: 0, cav: 0};
        G.spaces.paris.control = "france";
        G.spaces.paris.unrest = false;
        // Rouen holds an English stack; Amiens is friendly and empty.
        G.spaces.rouen.control = "england";
        G.spaces.rouen.unrest = false;
        G.spaces.rouen.land = {england: {regular: 2, merc: 0, cav: 0}};
        G.spaces.orleans.control = "france";
        G.spaces.orleans.unrest = false;
        G.spaces.orleans.land = {};

        const targets = continueTargets(G, {
            space: "paris", origin: "chartres", power: "france",
            units: {regular: 2, merc: 0, cav: 0}, leaders: [],
        });

        // Orleans is friendly and empty, so it is offered.
        expect(targets).toContain("orleans");
        // Rouen holds enemy units, so it is not offered.
        expect(targets).not.toContain("rouen");
    });

    it("never offers the space the formation came from", () => {
        const G = game();
        G.spaces.paris.control = "france";
        G.spaces.paris.unrest = false;
        G.spaces.paris.land = {};
        G.spaces.orleans.control = "france";
        G.spaces.orleans.unrest = false;
        G.spaces.orleans.land = {};

        const targets = continueTargets(G, {
            space: "paris", origin: "orleans", power: "france",
            units: {regular: 1, merc: 0, cav: 0}, leaders: [],
        });

        expect(targets).not.toContain("orleans");
    });
});
