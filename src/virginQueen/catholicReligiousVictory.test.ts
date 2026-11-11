import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {SPACES} from "./mapData";
import {
    checkImmediateVictory,
    mapProtestantSpaceCount,
    protestantOffMapCount,
    protestantSpaceCount,
    protestantSpacesInArea,
    resolveConversions,
    setupGame,
} from "./util";

const context = (die = 6): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => die, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

/** Leave only the final Protestant space in every struggle area. */
const reduceMapToFinalSpaces = (G: VQGame): void => {
    for (const area of ["france", "netherlands", "england", "scotland"] as const) {
        const spaces = SPACES.filter((s) => s.area === area && G.spaces[s.id].religion === "protestant");
        for (const space of spaces.slice(1)) G.spaces[space.id].religion = "catholic";
    }
};

describe("Catholic religious victory on the reduced map", () => {
    it("keeps the printed 18/30 track at setup through off-map spaces", () => {
        const campaign = setupGame(context(), {scenario: "campaign"});
        expect(mapProtestantSpaceCount(campaign)).toBe(9);
        expect(protestantOffMapCount(campaign)).toBe(9);
        expect(protestantSpaceCount(campaign)).toBe(18);
        expect(campaign.protestantOffMapInitial).toEqual({
            france: 4, netherlands: 1, england: 3, scotland: 1,
        });

        const tournament = setupGame(context(), {scenario: "tournament"});
        expect(mapProtestantSpaceCount(tournament)).toBe(21);
        expect(protestantOffMapCount(tournament)).toBe(9);
        expect(protestantSpaceCount(tournament)).toBe(30);
    });

    it("spends an off-map space when a Catholic conversion hits an area's final space", () => {
        const G = setupGame(context(), {scenario: "campaign"});
        const ctx = context();
        const spaces = SPACES.filter((s) => s.area === "france" && G.spaces[s.id].religion === "protestant");
        for (const space of spaces.slice(1)) G.spaces[space.id].religion = "catholic";
        const before = protestantSpaceCount(G);
        expect(protestantSpacesInArea(G, "france")).toBe(1);

        resolveConversions(G, ctx, "spain", "catholic", "france", 1);

        expect(protestantSpacesInArea(G, "france")).toBe(1);
        expect(G.protestantOffMapConverted?.france).toBe(1);
        expect(protestantSpaceCount(G)).toBe(before - 1);
        expect(G.log.some((line) => line.includes("Converted off-map: 1"))).toBe(true);
    });

    it("restores an off-map space when a Protestant conversion has no map target", () => {
        const G = setupGame(context(), {scenario: "campaign"});
        for (const space of SPACES.filter((s) => s.area === "france")) G.spaces[space.id].religion = "protestant";
        G.protestantOffMapConverted = {france: 2, netherlands: 0, england: 0, scotland: 0};
        const before = protestantSpaceCount(G);

        resolveConversions(G, context(), "protestant", "protestant", "france", 1);

        expect(G.protestantOffMapConverted?.france).toBe(1);
        expect(protestantSpaceCount(G)).toBe(before + 1);
        expect(G.log.some((line) => line.includes("Restored off-map: 1"))).toBe(true);
    });

    it("restores an off-map space while the map keeps its final Catholic space", () => {
        const G = setupGame(context(), {scenario: "campaign"});
        for (const space of SPACES.filter((s) => s.area === "france")) G.spaces[space.id].religion = "protestant";
        G.spaces.rouen.religion = "catholic";
        G.protestantOffMapConverted = {france: 1, netherlands: 0, england: 0, scotland: 0};
        const before = protestantSpaceCount(G);

        resolveConversions(G, context(), "protestant", "protestant", "france", 1);

        expect(G.spaces.rouen.religion).toBe("catholic");
        expect(G.protestantOffMapConverted?.france).toBe(0);
        expect(protestantSpaceCount(G)).toBe(before + 1);
    });

    it("does not convert past the final map space once the off-map pool is empty", () => {
        const G = setupGame(context(), {scenario: "campaign"});
        const spaces = SPACES.filter((s) => s.area === "france" && G.spaces[s.id].religion === "protestant");
        for (const space of spaces.slice(1)) G.spaces[space.id].religion = "catholic";
        if (G.protestantOffMapInitial !== undefined) G.protestantOffMapInitial.france = 0;
        const before = protestantSpaceCount(G);

        resolveConversions(G, context(), "spain", "catholic", "france", 5);

        expect(protestantSpacesInArea(G, "france")).toBe(1);
        expect(protestantSpaceCount(G)).toBe(before);
        expect(G.log.some((line) => line === "No conversions possible.")).toBe(true);
    });

    it("triggers Spain's Catholic victory when the track reaches 9", () => {
        const G = setupGame(context(), {scenario: "campaign"});
        reduceMapToFinalSpaces(G);
        // Two Protestant spaces each in France and Scotland: more than 3.
        G.spaces.nantes.religion = "protestant";
        G.spaces.stirling.religion = "protestant";
        G.protestantOffMapConverted = {france: 2, netherlands: 1, england: 2, scotland: 1};
        expect(protestantSpaceCount(G)).toBe(9);
        expect(checkImmediateVictory(G)).toEqual({winner: "spain", reason: "catholicReligious"});
    });

    it("does not trigger at 10 Protestant spaces", () => {
        const G = setupGame(context(), {scenario: "campaign"});
        reduceMapToFinalSpaces(G);
        G.spaces.nantes.religion = "protestant";
        G.spaces.stirling.religion = "protestant";
        G.protestantOffMapConverted = {france: 1, netherlands: 1, england: 2, scotland: 1};
        expect(protestantSpaceCount(G)).toBe(10);
        expect(checkImmediateVictory(G)).toBeUndefined();
    });

    it("counts remaining off-map spaces in France and Scotland for the winner", () => {
        const G = setupGame(context(), {scenario: "campaign"});
        reduceMapToFinalSpaces(G);
        // Track 9, but France still has 3 off-map spaces and Scotland 1.
        G.protestantOffMapConverted = {france: 1, netherlands: 0, england: 3, scotland: 0};
        expect(protestantSpaceCount(G)).toBe(9);

        const victory = checkImmediateVictory(G);
        expect(victory).toEqual({winner: "spain", reason: "catholicReligious"});
    });

    it("awards France the Catholic victory with at most 3 spaces in France and Scotland", () => {
        const G = setupGame(context(), {scenario: "campaign"});
        reduceMapToFinalSpaces(G);
        G.protestantOffMapConverted = {france: 4, netherlands: 0, england: 0, scotland: 0};
        expect(protestantSpaceCount(G)).toBe(9);

        const victory = checkImmediateVictory(G);
        expect(victory).toEqual({winner: "france", reason: "catholicReligious"});
    });
});
