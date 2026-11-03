import {Ctx} from "boardgame.io";
import {POWERS, VQGame, landCount, navalCount} from "./constant/general";
import {SPACES} from "./mapData";
import {setupGame, winter} from "./util";

const context = (): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

const game = (): VQGame => {
    const G = setupGame(context());
    // Keep the winter-only assertions independent of the scenario's starting army.
    for (const space of SPACES) {
        delete G.spaces[space.id].land.england;
    }
    return G;
};

const englishLand = (G: VQGame): number =>
    SPACES.reduce((total, space) => total + landCount(G.spaces[space.id].land.england), 0);

describe("winter return home (rule 20.4)", () => {
    it("returns a squadron to the nearest controlled port and takes its naval leader along", () => {
        const G = game();
        const londonBefore = navalCount(G.spaces.london.naval.england);
        G.seaZones.northSea.naval.england = {galley: 0, galleon: 2, racebuilt: 0, corsair: 0};
        G.spaces.london.leaders = G.spaces.london.leaders.filter((id) => id !== "howard");
        G.seaZones.northSea.leaders.push("howard");
        G.leaders.howard = {id: "howard", location: "northSea"};

        winter(G, context());

        expect(navalCount(G.seaZones.northSea.naval.england)).toBe(0);
        expect(navalCount(G.spaces.london.naval.england)).toBe(londonBefore + 2);
        expect(G.seaZones.northSea.leaders).not.toContain("howard");
        expect(G.spaces.london.leaders).toContain("howard");
        expect(G.leaders.howard.location).toBe("london");
        expect(G.log.join("\n")).toContain("fleet returns from North Sea to London");
    });

    it("may return a squadron to a port that was under siege at the start of the phase", () => {
        const G = game();
        G.spaces.london.siege = {by: "spain", sinceImpulse: 1};
        G.seaZones.northSea.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        winter(G, context());

        expect(navalCount(G.seaZones.northSea.naval.england)).toBe(0);
        expect(navalCount(G.spaces.london.naval.england)).toBeGreaterThan(0);
    });

    it("eliminates a squadron when its power controls no port", () => {
        const G = game();
        G.seaZones.adriatic.naval.hre = {galley: 0, galleon: 2, racebuilt: 0, corsair: 0};

        winter(G, context());

        expect(navalCount(G.seaZones.adriatic.naval.hre)).toBe(0);
        expect(G.log.join("\n")).toContain("Holy Roman fleet in Adriatic Sea has no port");
    });

    it("loses half of a land stack, rounded up, when no clean winter path exists", () => {
        const G = game();
        G.spaces.clermont.land.england = {regular: 3, merc: 0, cav: 0};

        winter(G, context());

        // Two of the three units are lost; London also receives its replacement regular.
        expect(englishLand(G)).toBe(2);
        expect(landCount(G.spaces.clermont.land.england)).toBe(0);
        expect(G.log.join("\n")).toContain("2 lost to winter attrition");
    });

    it("sends the excess of an overstacked fortress to the capital", () => {
        const G = game();
        G.spaces.portsmouth.land.england = {regular: 6, merc: 0, cav: 0};

        winter(G, context());

        expect(landCount(G.spaces.portsmouth.land.england)).toBe(4);
        // Four remain in Portsmouth, two return to London, and London gets its replacement.
        expect(englishLand(G)).toBe(7);
        expect(G.log.join("\n")).toContain("returns 2 overstacked unit(s)");
    });

    it("eliminates excess units when the capital is enemy-controlled", () => {
        const G = game();
        G.spaces.portsmouth.land.england = {regular: 6, merc: 0, cav: 0};
        G.spaces.london.control = "france";

        winter(G, context());

        expect(landCount(G.spaces.portsmouth.land.england)).toBe(4);
        expect(englishLand(G)).toBe(4);
        expect(G.log.join("\n")).toContain("has no capital");
    });

    it("returns a stack through a clean path without attrition", () => {
        const G = game();
        // Calais is a French-controlled fortress at the start of the campaign.
        expect(G.spaces.calais.control).toBe("france");
        G.spaces.calais.land.england = {regular: 2, merc: 0, cav: 0};

        winter(G, context());

        expect(landCount(G.spaces.calais.land.england)).toBe(0);
        // No attrition: both units survive, plus the London replacement.
        expect(englishLand(G)).toBe(3);
        expect(G.log.join("\n")).not.toContain("winter attrition");
    });

    it("returns Dutch Protestant units to Amsterdam rather than the Huguenot capital", () => {
        const G = game();
        G.spaces.amsterdam.control = "protestant";
        G.spaces.utrecht.control = "protestant";
        for (const space of SPACES) delete G.spaces[space.id].land.protestant;
        G.spaces.utrecht.land.protestant = {regular: 2, merc: 0, cav: 0};

        winter(G, context());

        expect(landCount(G.spaces.utrecht.land.protestant)).toBe(0);
        expect(landCount(G.spaces.amsterdam.land.protestant)).toBeGreaterThan(0);
        expect(landCount(G.spaces.laRochelle.land.protestant)).toBe(0);
    });

    it("keeps every power's state reset even after the new return-home step", () => {
        const G = game();
        G.powers.spain.cp = 4;
        G.powers.spain.treasures = [1, 2];

        winter(G, context());

        for (const p of POWERS) {
            expect(G.powers[p].cp).toBe(0);
            expect(G.powers[p].treasures).toEqual([]);
        }
    });
});
