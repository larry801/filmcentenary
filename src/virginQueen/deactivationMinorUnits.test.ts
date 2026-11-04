import {Ctx} from "boardgame.io";
import {MinorPower, POWERS, VQGame} from "./constant/general";
import {SPACES} from "./mapData";
import {activateMajor, deactivateMajor, setupGame} from "./util";

const MINORS: MinorPower[] = ["papacy", "venice", "ireland"];

const context = (numPlayers = 2): Ctx => ({
    numPlayers,
    currentPlayer: "0",
    playerID: "0",
    phase: "diplomacy",
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

/** Activate the HRE and make exactly `allies` its minor allies. */
const campaignHre = (allies: MinorPower[] = MINORS): VQGame => {
    const G = setupGame(context());
    expect(activateMajor(G, context(), "hre", "england")).toBe(true);
    for (const power of POWERS) G.powers[power].alliedMinors = [];
    G.powers.hre.alliedMinors = [...allies];
    return G;
};

const controlHomes = (G: VQGame, minor: MinorPower, control: string): void => {
    for (const def of SPACES.filter((space) => space.home === minor)) G.spaces[def.id].control = control as never;
};

const clearMinorUnits = (G: VQGame): void => {
    for (const def of SPACES) {
        for (const minor of MINORS) {
            delete G.spaces[def.id].land[minor];
            delete G.spaces[def.id].naval[minor];
        }
    }
    for (const zone of Object.values(G.seaZones)) {
        for (const minor of MINORS) delete zone.naval[minor];
    }
};

const minorUnitSnapshot = (G: VQGame): string[] => {
    const rows: string[] = [];
    for (const def of SPACES) {
        for (const minor of MINORS) {
            const land = G.spaces[def.id].land[minor];
            const naval = G.spaces[def.id].naval[minor];
            if (land !== undefined) rows.push(`land:${def.id}:${minor}:${JSON.stringify(land)}`);
            if (naval !== undefined) rows.push(`naval:${def.id}:${minor}:${JSON.stringify(naval)}`);
        }
    }
    for (const [zone, state] of Object.entries(G.seaZones)) {
        for (const minor of MINORS) {
            const naval = state.naval[minor];
            if (naval !== undefined) rows.push(`naval:${zone}:${minor}:${JSON.stringify(naval)}`);
        }
    }
    return rows.sort();
};

/**
 * Scenario Book p. 14 / rule 24.4: an HRE deactivation also deactivates the
 * Papacy, Venice and Ireland when they are HRE minor allies.  Their control
 * markers return, their units go home (or are eliminated), and foreign units
 * are displaced out of the home spaces whose HRE control marker was removed.
 */
describe("HRE deactivation cascades to its allied minor units", () => {
    it("returns the cascaded minors' land units to the nearest fortified home space", () => {
        const G = campaignHre();
        clearMinorUnits(G);
        for (const minor of MINORS) controlHomes(G, minor, "hre");
        G.spaces.naples.land.papacy = {regular: 1, merc: 2, cav: 1};
        G.spaces.milan.land.venice = {regular: 2, merc: 0, cav: 0};
        G.spaces.cork.land.ireland = {regular: 1, merc: 1, cav: 0};

        deactivateMajor(G, "hre");
        expect(G.spaces.rome.land.papacy).toEqual({regular: 1, merc: 2, cav: 1});
        expect(G.spaces.naples.land.papacy).toBeUndefined();
        expect(G.spaces.venice.land.venice).toEqual({regular: 2, merc: 0, cav: 0});
        expect(G.spaces.milan.land.venice).toBeUndefined();
        expect(G.spaces.kinsale.land.ireland).toEqual({regular: 1, merc: 1, cav: 0});
        expect(G.spaces.cork.land.ireland).toBeUndefined();
        const log = G.log.join("\n");
        expect(log).toContain("Papacy land units return from Naples to Rome.");
        expect(log).toContain("Venice land units return from Milan to Venice.");
        expect(log).toContain("Ireland land units return from Cork to Kinsale.");
    });

    it("returns the cascaded minors' naval units to the nearest home port", () => {
        const G = campaignHre();
        clearMinorUnits(G);
        for (const minor of MINORS) controlHomes(G, minor, "hre");
        G.seaZones.adriatic.naval.venice = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
        G.seaZones.tyrrhenian.naval.papacy = {galley: 2, galleon: 0, racebuilt: 0, corsair: 0};
        G.seaZones.irishSea.naval.ireland = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};

        deactivateMajor(G, "hre");
        expect(G.seaZones.adriatic.naval.venice).toBeUndefined();
        expect(G.seaZones.tyrrhenian.naval.papacy).toBeUndefined();
        expect(G.seaZones.irishSea.naval.ireland).toBeUndefined();
        // Zara is a Venetian fortress port in the Adriatic, closer than Venice
        // itself; the tie-break is the shortest sea route then map distance.
        expect(G.spaces.zara.naval.venice).toEqual({galley: 1, galleon: 0, racebuilt: 0, corsair: 0});
        expect(G.spaces.rome.naval.papacy).toEqual({galley: 2, galleon: 0, racebuilt: 0, corsair: 0});
        expect(G.spaces.dublin.naval.ireland).toEqual({galley: 1, galleon: 0, racebuilt: 0, corsair: 0});
    });

    it("falls back to the nearest unfortified home when every fortified home is lost", () => {
        const G = campaignHre(["papacy"]);
        clearMinorUnits(G);
        G.spaces.rome.control = "spain";
        G.spaces.ravenna.control = "hre";
        G.spaces.ancona.control = "hre";
        G.spaces.naples.land.papacy = {regular: 1, merc: 0, cav: 0};

        deactivateMajor(G, "hre");

        expect(G.spaces.ancona.land.papacy).toEqual({regular: 1, merc: 0, cav: 0});
        expect(G.spaces.ravenna.land.papacy).toBeUndefined();
        expect(G.log.join("\n")).toContain("Papacy land units return from Naples to Ancona.");
    });

    it("eliminates minor land and naval units with no friendly home or home port", () => {
        const G = campaignHre(["papacy"]);
        clearMinorUnits(G);
        for (const def of SPACES.filter((space) => space.home === "papacy")) G.spaces[def.id].control = "spain";
        G.spaces.naples.land.papacy = {regular: 1, merc: 0, cav: 0};
        G.seaZones.tyrrhenian.naval.papacy = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};

        deactivateMajor(G, "hre");

        expect(G.spaces.naples.land.papacy).toBeUndefined();
        expect(G.seaZones.tyrrhenian.naval.papacy).toBeUndefined();
        const log = G.log.join("\n");
        expect(log).toContain("Papacy land units in Naples are eliminated (no friendly home space).");
        expect(log).toContain("Papacy naval units in Tyrrhenian Sea are eliminated (no friendly home port).");
    });

    it("displaces foreign land units from a home space whose HRE control marker was removed", () => {
        const G = campaignHre(["papacy"]);
        clearMinorUnits(G);
        G.spaces.rome.control = "hre";
        G.spaces.rome.land.spain = {regular: 2, merc: 1, cav: 0};
        const before = {...(G.spaces.naples.land.spain ?? {regular: 0, merc: 0, cav: 0})};

        deactivateMajor(G, "hre");

        expect(G.spaces.rome.land.spain).toBeUndefined();
        expect(G.spaces.naples.land.spain).toEqual({
            regular: before.regular + 2,
            merc: before.merc + 1,
            cav: before.cav,
        });
        expect(G.log.join("\n")).toContain("Spain land units are displaced from Rome to Naples.");
    });

    it("displaces foreign minor units to their controlling major's friendly space", () => {
        const G = campaignHre(["papacy"]);
        G.powers.spain.alliedMinors = ["venice"];
        clearMinorUnits(G);
        G.spaces.rome.control = "hre";
        G.spaces.rome.land.venice = {regular: 1, merc: 0, cav: 0};

        deactivateMajor(G, "hre");

        expect(G.spaces.rome.land.venice).toBeUndefined();
        expect(G.spaces.naples.land.venice).toEqual({regular: 1, merc: 0, cav: 0});
        expect(G.log.join("\n")).toContain("Venice land units are displaced from Rome to Naples.");
    });

    it("displaces foreign naval units from a home space whose HRE control marker was removed", () => {
        const G = campaignHre(["papacy"]);
        clearMinorUnits(G);
        G.spaces.rome.control = "hre";
        G.spaces.rome.naval.spain = {galley: 2, galleon: 0, racebuilt: 0, corsair: 0};
        const before = G.spaces.naples.naval.spain?.galley ?? 0;

        deactivateMajor(G, "hre");

        expect(G.spaces.rome.naval.spain).toBeUndefined();
        expect(G.spaces.naples.naval.spain?.galley).toBe(before + 2);
        expect(G.log.join("\n")).toContain("Spain naval units are displaced from Rome to Naples.");
    });

    it("does not return a minor that is not one of the printed HRE deactivation allies", () => {
        const G = campaignHre(["papacy"]);
        G.powers.spain.alliedMinors = ["venice"];
        clearMinorUnits(G);
        controlHomes(G, "papacy", "hre");
        G.spaces.milan.land.venice = {regular: 1, merc: 0, cav: 0};

        deactivateMajor(G, "hre");

        expect(G.spaces.milan.land.venice).toEqual({regular: 1, merc: 0, cav: 0});
        expect(G.spaces.venice.land.venice).toBeUndefined();
    });

    it.each([2, 3, 4, 5])("leaves minor units untouched when the HRE has no allied minors (%i players)", (numPlayers) => {
        const G = setupGame(context(numPlayers));
        expect(activateMajor(G, context(numPlayers), "hre", "england")).toBe(true);
        const before = minorUnitSnapshot(G);

        deactivateMajor(G, "hre");

        expect(G.powers.hre.alliedMinors).toEqual([]);
        expect(minorUnitSnapshot(G)).toEqual(before);
    });
});
