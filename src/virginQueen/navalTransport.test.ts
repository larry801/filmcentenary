import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame, landCount} from "./constant/general";
import {navalTransport} from "./moves";
import {atWar, setupGame} from "./util";

const context = (values: number[] = []): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), numPlayers: 6} as Ctx);

describe("naval transport in the full game (rule 16.3)", () => {
    it("moves a formation between ports through a friendly-held sea zone", () => {
        const G = game();
        expect(G.scenario).toBe("campaign");
        G.powers.england.cp = 3;
        G.seaZones.northSea.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        const londonBefore = landCount(G.spaces.london.land.england);

        expect(navalTransport(G, context(), {
            from: "london", to: "norwich", zones: ["northSea"], units: {regular: 2},
        })).toBeUndefined();

        expect(G.powers.england.cp).toBe(1);
        expect(landCount(G.spaces.london.land.england)).toBe(londonBefore - 2);
        expect(G.spaces.norwich.land.england?.regular).toBe(2);
        expect(navalBoatCount(G)).toBe(1);
        expect(G.log.join("\n")).toContain("transports 2 units");
    });

    it("requires a friendly naval unit in every sea zone of the route", () => {
        const G = game();
        G.powers.england.cp = 3;
        expect(G.seaZones.northSea.naval.england).toBeUndefined();

        expect(navalTransport(G, context(), {
            from: "london", to: "norwich", zones: ["northSea"], units: {regular: 2},
        })).toBe(INVALID_MOVE);
        expect(G.powers.england.cp).toBe(3);
        expect(G.spaces.norwich.land.england).toBeUndefined();
    });

    it("eliminates the transported units when the field battle at the port is lost", () => {
        const G = game();
        expect(atWar(G, "england", "france")).toBe(true);
        G.powers.england.cp = 2;
        G.spaces.dover.land.england = {regular: 2, merc: 0, cav: 0};
        G.spaces.rouen.land.france = {regular: 2, merc: 0, cav: 0};
        G.seaZones.englishChannel.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        expect(navalTransport(G, context([1, 1, 1, 1, 1, 1]), {
            from: "dover", to: "rouen", zones: ["englishChannel"], units: {regular: 2},
        })).toBeUndefined();

        // Both sides roll no hits; the defender wins ties, so the transported
        // units are eliminated rather than retreating to Dover.
        expect(landCount(G.spaces.rouen.land.england)).toBe(0);
        expect(landCount(G.spaces.dover.land.england)).toBe(0);
        expect(G.powers.england.cp).toBe(0);
        expect(G.log.join("\n")).toContain("transported unit(s) are eliminated");
    });

    it("does not allow a formation under siege to be transported", () => {
        const G = game();
        G.powers.england.cp = 3;
        G.spaces.london.siege = {by: "spain", sinceImpulse: 2};
        G.seaZones.northSea.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        expect(navalTransport(G, context(), {
            from: "london", to: "norwich", zones: ["northSea"], units: {regular: 1},
        })).toBe(INVALID_MOVE);
        expect(G.powers.england.cp).toBe(3);
    });
});

const navalBoatCount = (G: VQGame): number => {
    const fleet = G.seaZones.northSea.naval.england;
    return fleet === undefined ? 0 : fleet.galley + fleet.galleon + fleet.racebuilt + fleet.corsair;
};
