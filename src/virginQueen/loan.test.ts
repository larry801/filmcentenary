import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {loanNaval} from "./moves";
import {returnLoanedNaval, setupGame} from "./util";

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

    it("requires an alliance and a sea path", () => {
        const G = game();
        prepare(G);
        G.powers.france.allies = [];
        G.powers.spain.allies = [];
        expect(loanNaval(G, context(), {target: "spain", fromPort: "marseille", toPort: "barcelona", kind: "galleon"})).toBe(INVALID_MOVE);
    });
});
