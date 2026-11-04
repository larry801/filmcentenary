import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {formAlliance} from "./moves";
import {setupGame} from "./util";

/** Six-player campaign: England is player "2", Spain is player "1". */
const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "diplomacy",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame(context());

const spainContext = (): Ctx => ({...context(), currentPlayer: "1", playerID: "1"} as Ctx);

/**
 * Rule 9.2: "Spain and England may not ally if the cost of DOW between them is
 * 3 CP or less (9.5)."  The cost starts at 5 and can be reduced by events and
 * by Elizabeth's excommunication, so the live `warCost` is what matters.
 */
describe("alliance restrictions (rule 9.2)", () => {
    it("rejects an England-Spain alliance while the DOW cost is exactly 3", () => {
        const G = game();
        G.doWCostEnglandSpain = 3;

        expect(formAlliance(G, context(), {target: "spain"})).toBe(INVALID_MOVE);
        expect(G.powers.england.allies).not.toContain("spain");
        expect(G.powers.spain.allies).not.toContain("england");
    });

    it("rejects the alliance when Elizabeth's excommunication drops the cost to 3", () => {
        const G = game();
        G.doWCostEnglandSpain = 5;
        G.elizabethExcommunicated = true;

        expect(formAlliance(G, spainContext(), {target: "england"})).toBe(INVALID_MOVE);
        expect(G.powers.spain.allies).not.toContain("england");
    });

    it("allows the alliance at a DOW cost of 4", () => {
        const G = game();
        G.doWCostEnglandSpain = 4;

        expect(formAlliance(G, context(), {target: "spain"})).toBeUndefined();
        expect(G.powers.england.allies).toContain("spain");
        expect(G.powers.spain.allies).toContain("england");
    });

    it("allows the alliance at the printed starting cost of 5", () => {
        const G = game();
        expect(G.doWCostEnglandSpain).toBe(5);

        expect(formAlliance(G, context(), {target: "spain"})).toBeUndefined();
        expect(G.powers.england.allies).toContain("spain");
    });

    it("still rejects an alliance between powers at war", () => {
        const G = game();
        G.doWCostEnglandSpain = 3;

        expect(formAlliance(G, context(), {target: "france"})).toBe(INVALID_MOVE);
        expect(G.powers.england.allies).not.toContain("france");
    });
});
