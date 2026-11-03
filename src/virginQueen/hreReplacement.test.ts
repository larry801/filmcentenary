import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame, landCount} from "./constant/general";
import {SPACES} from "./mapData";
import {chooseHreReplacement} from "./moves";
import {resolvePendingHreReplacement, setupGame, winter} from "./util";

const context = (): Ctx => ({
    numPlayers: 6,
    currentPlayer: "4",
    playerID: "4",
    phase: "action",
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx);

const game = (): VQGame => {
    const G = setupGame(context());
    for (const space of SPACES) delete G.spaces[space.id].land.hre;
    G.spaces.vienna.land.hre = {regular: 2, merc: 0, cav: 0};
    G.spaces.vienna.control = "hre";
    G.mercenariesForHire = 0;
    return G;
};

const diplomacy = (playerID = "4"): Ctx => ({...context(), phase: "diplomacy", playerID} as Ctx);

describe("Holy Roman winter replacements (rule 20.6)", () => {
    it("defers the choice instead of automatically adding a regular", () => {
        const G = game();
        winter(G, context());

        expect(G.pendingHreReplacement).toEqual({canRegular: true, canMercs: true, canMarker: true});
        expect(landCount(G.spaces.vienna.land.hre)).toBe(2);
        expect(G.log.join("\n")).toContain("Holy Roman replacement");
    });

    it("adds one regular when chosen", () => {
        const G = game();
        winter(G, context());
        expect(chooseHreReplacement(G, diplomacy(), {choice: "regular"})).toBeUndefined();
        expect(G.pendingHreReplacement).toBeUndefined();
        expect(landCount(G.spaces.vienna.land.hre)).toBe(3);
    });

    it("adds two mercenaries when chosen", () => {
        const G = game();
        winter(G, context());
        expect(chooseHreReplacement(G, diplomacy(), {choice: "mercs"})).toBeUndefined();
        expect(G.spaces.vienna.land.hre?.merc).toBe(2);
        expect(landCount(G.spaces.vienna.land.hre)).toBe(4);
    });

    it("moves the Mercenaries for Hire marker from 0 to 4", () => {
        const G = game();
        winter(G, context());
        expect(chooseHreReplacement(G, diplomacy(), {choice: "marker"})).toBeUndefined();
        expect(G.mercenariesForHire).toBe(4);
        expect(landCount(G.spaces.vienna.land.hre)).toBe(2);
    });

    it("rejects the marker choice when the marker is not at 0", () => {
        const G = game();
        G.mercenariesForHire = 2;
        winter(G, context());
        expect(G.pendingHreReplacement).toEqual({canRegular: true, canMercs: true, canMarker: false});
        expect(chooseHreReplacement(G, diplomacy(), {choice: "marker"})).toBe(INVALID_MOVE);
        expect(G.pendingHreReplacement).not.toBeUndefined();
    });

    it("allows only the HRE player and only during diplomacy", () => {
        const G = game();
        winter(G, context());
        expect(chooseHreReplacement(G, diplomacy("0"), {choice: "regular"})).toBe(INVALID_MOVE);
        expect(chooseHreReplacement(G, {...diplomacy(), phase: "action"}, {choice: "regular"})).toBe(INVALID_MOVE);
        expect(G.pendingHreReplacement).not.toBeUndefined();
    });

    it("offers only the marker when Vienna is enemy-controlled", () => {
        const G = game();
        G.spaces.vienna.control = "england";
        winter(G, context());
        expect(G.pendingHreReplacement).toEqual({canRegular: false, canMercs: false, canMarker: true});
        expect(chooseHreReplacement(G, diplomacy(), {choice: "marker"})).toBeUndefined();
        expect(G.mercenariesForHire).toBe(4);
    });

    it("resolves to a regular automatically before spring deployment", () => {
        const G = game();
        winter(G, context());
        resolvePendingHreReplacement(G);
        expect(G.pendingHreReplacement).toBeUndefined();
        expect(landCount(G.spaces.vienna.land.hre)).toBe(3);
    });
});
