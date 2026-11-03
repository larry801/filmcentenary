import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {loanNaval} from "./moves";
import {bestBattle, returnLoanedNaval, setupGame} from "./util";

const context = (player = "3", phase = "diplomacy"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const prepare = (G: VQGame): void => {
    G.powers.france.allies = ["spain"];
    G.powers.spain.allies = ["france"];
    G.spaces.marseille.control = "france";
    G.spaces.marseille.naval.france = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
    G.spaces.barcelona.control = "spain";
    G.spaces.barcelona.naval.spain = undefined as never;
};

describe("naval loans to an ally (rule 9.2)", () => {
    it("moves one naval unit to the ally's port and returns it in Winter", () => {
        const G = game();
        prepare(G);

        expect(loanNaval(G, context(), {target: "spain", fromPort: "marseille", toPort: "barcelona", kind: "galleon"})).toBeUndefined();

        expect(G.spaces.marseille.naval.france).toBeUndefined();
        expect(G.spaces.barcelona.naval.spain?.galleon).toBe(1);
        expect(G.loanedNaval).toHaveLength(1);

        expect(loanNaval(G, context(), {target: "spain", fromPort: "marseille", toPort: "barcelona", kind: "galleon"})).toBe(INVALID_MOVE);

        returnLoanedNaval(G);

        expect(G.loanedNaval).toEqual([]);
        expect(G.spaces.marseille.naval.france?.galleon).toBe(1);
    });

    it("loans a naval leader with the unit and returns it", () => {
        const G = game();
        G.powers.england.allies = ["spain"];
        G.powers.spain.allies = ["england"];
        G.spaces.london.control = "england";
        G.spaces.london.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        G.spaces.corunna.control = "spain";
        G.leaders.howard = {id: "howard", location: "london"};

        expect(loanNaval(G, context("2"), {target: "spain", fromPort: "london", toPort: "corunna", kind: "galleon", leader: "howard"})).toBeUndefined();

        expect(G.leaders.howard.location).toBe("corunna");
        expect(G.leaders.howard.loanedTo).toBe("spain");
        expect(bestBattle(G, "corunna", ["spain"], "naval")).toBe(2);

        returnLoanedNaval(G);
        expect(G.leaders.howard.location).toBe("london");
        expect(G.leaders.howard.loanedTo).toBeUndefined();
    });

    it("requires an alliance and a sea path", () => {
        const G = game();
        prepare(G);
        G.powers.france.allies = [];
        G.powers.spain.allies = [];
        expect(loanNaval(G, context(), {target: "spain", fromPort: "marseille", toPort: "barcelona", kind: "galleon"})).toBe(INVALID_MOVE);
    });
});
