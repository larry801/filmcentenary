import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {buildPatrol, buildWorldFortress, worldPiracy} from "./moves";
import {setupGame} from "./util";

const context = (values: number[] = [], player = "2"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const preparePirate = (G: VQGame): void => {
    G.powers.england.cp = 2;
    G.worldControls.florida = "spain";
    G.worldColonies.florida = "spain";
    G.powers.england.seaCaptains = G.powers.england.seaCaptains.filter((id) => id !== "drake");
    G.worldCaptains.drake = {power: "england", location: "northAtlantic", damaged: false, colony: false};
};

describe("World Map piracy and patrols (rules 16.5/17.3)", () => {
    it("builds Spanish patrols and world fortresses", () => {
        const G = game();
        G.powers.spain.cp = 4;
        G.worldControls.florida = "spain";
        G.worldColonies.florida = "spain";

        expect(buildPatrol(G, context([], "1"), {zone: "northAtlantic"})).toBeUndefined();
        expect(G.worldPatrols?.northAtlantic).toBe(1);
        expect(buildWorldFortress(G, context([], "1"), {settlement: "florida"})).toBeUndefined();
        expect(G.worldFortresses?.florida).toBe("spain");
        expect(buildWorldFortress(G, context([], "1"), {settlement: "florida"})).toBe(INVALID_MOVE);
    });

    it("awards patrol, treasure and VP hits in priority order", () => {
        const G = game();
        preparePirate(G);
        G.worldPatrols = {northAtlantic: 1};
        G.powers.spain.treasures = [5];
        const vpBefore = G.powers.england.bonusVp;

        // One defense die (miss), then four piracy dice: two hits.
        expect(worldPiracy(G, context([1, 5, 5, 1, 1]), {captain: "drake"})).toBeUndefined();

        expect(G.worldPatrols?.northAtlantic).toBe(0);
        expect(G.powers.spain.treasures).toEqual([]);
        expect(G.worldCaptains.drake.treasureValues).toContain(5);
        expect(G.powers.england.bonusVp).toBe(vpBefore);
    });

    it("awards piracy VP when no patrol or treasure remains", () => {
        const G = game();
        preparePirate(G);
        G.powers.spain.treasures = [];
        const vp = G.powers.england.bonusVp;

        // Four piracy dice: one hit.
        expect(worldPiracy(G, context([5, 1, 1, 1]), {captain: "drake"})).toBeUndefined();

        expect(G.powers.england.bonusVp).toBe(vp + 1);
    });

    it("eliminates an undamaged captain when two defense hits are scored", () => {
        const G = game();
        preparePirate(G);
        G.worldPatrols = {northAtlantic: 2};

        expect(worldPiracy(G, context([5, 5]), {captain: "drake"})).toBeUndefined();

        expect(G.worldCaptains.drake).toBeUndefined();
        expect(G.powers.england.seaCaptains).not.toContain("drake");
    });

    it("limits each power to one piracy action per ocean zone per turn", () => {
        const G = game();
        preparePirate(G);
        G.powers.spain.treasures = [];
        expect(worldPiracy(G, context([1, 1, 1, 1]), {captain: "drake"})).toBeUndefined();
        expect(worldPiracy(G, context([]), {captain: "drake"})).toBe(INVALID_MOVE);
    });

    it("lets a connected Spanish fortress withhold one treasure from the draw", () => {
        const G = game();
        preparePirate(G);
        // A fortress in the zone (so Spain rolled a defense die) and two
        // treasures: Spain withholds the first, so only the second can be taken.
        G.worldFortresses = {florida: "spain"};
        G.powers.spain.treasures = [1, 5];
        G.worldPiracyWithholds = {spain: 0};

        // One defense die (miss), then two piracy dice: one hit.
        expect(worldPiracy(G, context([1, 5, 1]), {captain: "drake"})).toBeUndefined();

        expect(G.powers.spain.treasures).toEqual([1]);
        expect(G.worldCaptains.drake.treasureValues).toEqual([5]);
    });

    it("refuses the treasure award when a fortress leaves only the withheld one", () => {
        const G = game();
        preparePirate(G);
        G.worldFortresses = {florida: "spain"};
        G.powers.spain.treasures = [3];
        G.worldPiracyWithholds = {spain: 0};
        const vp = G.powers.england.bonusVp;

        // One defense die (miss), then three piracy dice: one hit.
        expect(worldPiracy(G, context([1, 5, 1, 1]), {captain: "drake"})).toBeUndefined();

        // The only Spanish treasure is withheld, so the hit converts to VP.
        expect(G.powers.spain.treasures).toEqual([3]);
        expect(G.powers.england.bonusVp).toBe(vp + 1);
    });
});
