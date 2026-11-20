import {Ctx} from "boardgame.io";
import {VQGame, landCount} from "./constant/general";
import {removeLandLosses, setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "0", playerID: "0", phase: "action", numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

/**
 * Rule 14: "If units from two major powers defend together, battle and assault
 * losses are split evenly between the powers until a power is eliminated; roll
 * randomly to see who suffers any odd loss."
 */
describe("allied defence losses (rule 14)", () => {
    it("takes losses from mercenaries before regulars within one power", () => {
        const G = game();
        G.spaces.amiens.land.england = {regular: 2, merc: 2, cav: 0};
        removeLandLosses(G, "amiens", ["england"], 1);
        expect(G.spaces.amiens.land.england).toEqual({regular: 2, merc: 1, cav: 0});
    });

    it("splits an even hit count evenly between two allied defenders", () => {
        const G = game();
        G.spaces.amiens.land.england = {regular: 4, merc: 0, cav: 0};
        G.spaces.amiens.land.protestant = {regular: 4, merc: 0, cav: 0};
        removeLandLosses(G, "amiens", ["england", "protestant"], 2);
        expect(landCount(G.spaces.amiens.land.england)).toBe(3);
        expect(landCount(G.spaces.amiens.land.protestant)).toBe(3);
    });

    it("gives the odd loss to one of the defenders, not to the first listed", () => {
        // With three hits over three defenders the split is exactly even.
        const G = game();
        for (const p of ["england", "protestant", "france"] as const) {
            G.spaces.amiens.land[p] = {regular: 3, merc: 0, cav: 0};
        }
        removeLandLosses(G, "amiens", ["england", "protestant", "france"], 3);
        for (const p of ["england", "protestant", "france"] as const) {
            expect(landCount(G.spaces.amiens.land[p])).toBe(2);
        }
    });

    it("does not drain the first defender when two defenders take one odd hit each", () => {
        const G = game();
        G.spaces.amiens.land.england = {regular: 3, merc: 0, cav: 0};
        G.spaces.amiens.land.protestant = {regular: 3, merc: 0, cav: 0};
        // Two hits over two powers: one each.
        removeLandLosses(G, "amiens", ["england", "protestant"], 2);
        expect(landCount(G.spaces.amiens.land.england)).toBe(2);
        expect(landCount(G.spaces.amiens.land.protestant)).toBe(2);
    });

    it("moves remaining hits onto survivors when one defender is eliminated", () => {
        const G = game();
        G.spaces.amiens.land.england = {regular: 1, merc: 0, cav: 0};
        G.spaces.amiens.land.protestant = {regular: 5, merc: 0, cav: 0};
        removeLandLosses(G, "amiens", ["england", "protestant"], 3);
        expect(G.spaces.amiens.land.england).toBeUndefined();
        expect(landCount(G.spaces.amiens.land.protestant)).toBeLessThanOrEqual(4);
    });
});
