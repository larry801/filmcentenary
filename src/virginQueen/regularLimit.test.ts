import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {Power, VQGame} from "./constant/general";
import {recruitmentOptions} from "./cardEvents";
import {VirginQueenGameDef} from "./game";
import {buildNaval, recruit} from "./moves";
import {
    addForeignWarLandFromPool,
    addLandFromPool,
    addNavalFromPool,
    landPoolLimit,
    landPoolRoom,
    navalLostCount,
    navalPoolLimit,
    navalPoolRoom,
    navalPoolUsed,
    recordNavalLoss,
    setupGame,
} from "./util";

const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const clearSpanishRegulars = (G: VQGame): void => {
    for (const space of Object.values(G.spaces)) {
        if (space.land.spain !== undefined) space.land.spain.regular = 0;
    }
    G.powers.spain.cp = 10;
    G.spaces.seville.control = "spain";
    G.spaces.seville.unrest = false;
};

/** Remove every land counter of `power` so a test can build an exact pool. */
const clearLand = (G: VQGame, power: Power): void => {
    for (const space of Object.values(G.spaces)) delete space.land[power];
    G.powers[power].cp = 10;
};

/** Remove every naval counter of `power` so a test can build an exact pool. */
const clearNaval = (G: VQGame, power: Power): void => {
    for (const zone of Object.values(G.seaZones)) delete zone.naval[power];
    for (const space of Object.values(G.spaces)) delete space.naval[power];
    G.powers[power].cp = 10;
};

describe("land counter limits (17.1)", () => {
    it("blocks recruiting beyond the physical regular limit", () => {
        const G = game();
        clearSpanishRegulars(G);
        G.spaces.madrid.land.spain = {regular: 42, merc: 0, cav: 0};

        expect(recruit(G, context(), {space: "seville", kind: "regular"})).toBe(INVALID_MOVE);
    });

    it("counts mercenaries against the same physical counter pool", () => {
        const G = game();
        clearSpanishRegulars(G);
        G.spaces.madrid.land.spain = {regular: 41, merc: 1, cav: 0};

        expect(recruit(G, context(), {space: "seville", kind: "regular"})).toBe(INVALID_MOVE);
    });

    it("does not apply a separate mercenary cap", () => {
        const G = game();
        clearLand(G, "spain");
        G.spaces.madrid.land.spain = {regular: 0, merc: 20, cav: 0};
        G.spaces.seville.control = "spain";
        G.spaces.seville.unrest = false;

        // 20 mercenaries exceeds the old MERC_LIMITS value but the physical
        // pool holds 42 counters, so the unified check must allow the build.
        expect(recruit(G, context(), {space: "seville", kind: "merc"})).toBeUndefined();
    });

    it("counts Ottoman cavalry against the same physical counter pool", () => {
        const G = game();
        clearLand(G, "ottoman");
        G.spaces.istanbul.control = "ottoman";
        G.spaces.istanbul.unrest = false;
        G.spaces.istanbul.land.ottoman = {regular: 38, merc: 0, cav: 1};
        const ottomanContext = {...context(), currentPlayer: "0", playerID: "0"} as Ctx;

        expect(recruit(G, ottomanContext, {space: "istanbul", kind: "cav"})).toBe(INVALID_MOVE);
        expect(recruit(G, ottomanContext, {space: "istanbul", kind: "regular"})).toBe(INVALID_MOVE);
    });

    it("counts land counters loaded on the Spanish Armada", () => {
        const G = game();
        clearLand(G, "spain");
        G.spaces.madrid.land.spain = {regular: 41, merc: 0, cav: 0};
        G.armada = {strength: 2, location: "atlanticOcean", land: {regular: 1, merc: 0, cav: 0}};
        G.spaces.seville.control = "spain";
        G.spaces.seville.unrest = false;

        expect(recruit(G, context(), {space: "seville", kind: "regular"})).toBe(INVALID_MOVE);
    });

    it("counts land counters committed to a foreign war", () => {
        const G = game();
        clearLand(G, "hre");
        G.spaces.vienna.control = "hre";
        G.spaces.vienna.unrest = false;
        G.spaces.vienna.land.hre = {regular: 27, merc: 0, cav: 0};
        G.foreignWars.hre = {power: "hre", cardId: "vq-118", enemy: "Poland", enemyUnits: 3,
            units: {regular: 2, merc: 0, cav: 0}, winnerVp: false, status: "active"};
        const hreContext = {...context(), currentPlayer: "4", playerID: "4"} as Ctx;

        expect(recruit(G, hreContext, {space: "vienna", kind: "regular"})).toBe(INVALID_MOVE);
    });

    it("limits English naval counters to six", () => {
        const G = game();
        clearNaval(G, "england");
        G.spaces.london.naval.england = {galley: 0, galleon: 6, racebuilt: 0, corsair: 0};
        G.spaces.portsmouth.control = "england";
        G.spaces.portsmouth.unrest = false;

        const englandContext = {...context(), currentPlayer: "2", playerID: "2"} as Ctx;
        expect(buildNaval(G, englandContext, {port: "portsmouth", kind: "galleon"})).toBe(INVALID_MOVE);
    });

    it("counts every ship type against the one naval pool", () => {
        const G = game();
        clearNaval(G, "england");
        G.spaces.london.naval.england = {galley: 0, galleon: 5, racebuilt: 1, corsair: 0};
        G.spaces.portsmouth.control = "england";
        G.spaces.portsmouth.unrest = false;
        const englandContext = {...context(), currentPlayer: "2", playerID: "2"} as Ctx;

        // Five galleons plus one race-built galleon already use all six
        // two-sided counters, even though neither kind is at its old per-type
        // allowance.
        expect(buildNaval(G, englandContext, {port: "portsmouth", kind: "galleon"})).toBe(INVALID_MOVE);
        G.spaces.london.naval.england.racebuilt = 0;
        expect(buildNaval(G, englandContext, {port: "portsmouth", kind: "galleon"})).toBeUndefined();
    });

    it("delays rebuilding while lost naval counters are returning", () => {
        const G = game();
        clearNaval(G, "england");
        G.spaces.london.naval.england = {galley: 0, galleon: 5, racebuilt: 0, corsair: 0};
        G.navalLost = {england: {galley: 0, galleon: 1, racebuilt: 0, corsair: 0}};
        G.spaces.portsmouth.control = "england";
        G.spaces.portsmouth.unrest = false;

        const englandContext = {...context(), currentPlayer: "2", playerID: "2"} as Ctx;
        expect(buildNaval(G, englandContext, {port: "portsmouth", kind: "galleon"})).toBe(INVALID_MOVE);
        delete G.navalLost.england;
        expect(buildNaval(G, englandContext, {port: "portsmouth", kind: "galleon"})).toBeUndefined();
    });

    it("applies the rebuild delay to allied-minor counters", () => {
        const G = game();
        const before = navalPoolUsed(G, "venice");

        recordNavalLoss(G, "venice", "galley");

        expect(navalLostCount(G, "venice")).toBe(1);
        expect(navalPoolUsed(G, "venice")).toBe(before + 1);
    });

    it("returns lost counters during Card Draw, not Spring Deployment", () => {
        const G = game();
        G.dealtYear = G.year;
        G.navalLost = {england: {galley: 0, galleon: 1, racebuilt: 0, corsair: 0}};

        const springBegin = VirginQueenGameDef.phases!.spring!.onBegin as unknown as (G: VQGame, ctx: Ctx) => void;
        springBegin(G, {...context(), phase: "spring"} as Ctx);
        expect(navalLostCount(G, "england")).toBe(1);

        const cardDrawBegin = VirginQueenGameDef.phases!.cardDraw!.onBegin as unknown as (G: VQGame, ctx: Ctx) => void;
        cardDrawBegin(G, {...context(), phase: "cardDraw"} as Ctx);
        expect(navalLostCount(G, "england")).toBe(0);
    });

    it("allows recruiting up to the limit", () => {
        const G = game();
        clearSpanishRegulars(G);
        G.spaces.madrid.land.spain = {regular: 41, merc: 0, cav: 0};

        expect(recruit(G, context(), {space: "seville", kind: "regular"})).toBeUndefined();
        expect(G.spaces.madrid.land.spain.regular + (G.spaces.seville.land.spain?.regular ?? 0)).toBe(42);
    });
});

describe("event and replacement additions respect the physical pool (17.1)", () => {
    it("places only the land counters still available", () => {
        const G = game();
        clearLand(G, "spain");
        G.spaces.madrid.land.spain = {regular: 41, merc: 0, cav: 0};

        expect(addLandFromPool(G, "seville", "spain", "regular", 2)).toBe(1);
        expect(G.spaces.seville.land.spain?.regular).toBe(1);
        expect(landPoolRoom(G, "spain")).toBe(0);
        expect(addLandFromPool(G, "seville", "spain", "regular", 1)).toBe(0);
    });

    it("counts foreign-war counters before adding new regulars there", () => {
        const G = game();
        clearLand(G, "hre");
        G.spaces.vienna.land.hre = {regular: 27, merc: 0, cav: 0};
        G.foreignWars.hre = {power: "hre", cardId: "vq-118", enemy: "Poland", enemyUnits: 3,
            units: {regular: 1, merc: 0, cav: 0}, winnerVp: false, status: "active"};

        expect(addForeignWarLandFromPool(G, "hre", "regular", 2)).toBe(1);
        expect(G.foreignWars.hre.units.regular).toBe(2);
        expect(landPoolRoom(G, "hre")).toBe(0);
        expect(addForeignWarLandFromPool(G, "hre", "regular", 1)).toBe(0);
    });

    it("places only the naval counters still available", () => {
        const G = game();
        clearNaval(G, "spain");
        G.spaces.seville.naval.spain = {galley: 0, galleon: 6, racebuilt: 0, corsair: 0};

        expect(addNavalFromPool(G, "seville", "spain", "galleon", 2)).toBe(1);
        expect(G.spaces.seville.naval.spain.galleon).toBe(7);
        expect(navalPoolRoom(G, "spain")).toBe(0);
        expect(addNavalFromPool(G, "seville", "spain", "galleon", 1)).toBe(0);
    });

    it("removes Grand Vizier recruitment options once both pools are full", () => {
        const G = game();
        clearLand(G, "ottoman");
        clearNaval(G, "ottoman");
        G.spaces.istanbul.control = "ottoman";
        G.spaces.istanbul.unrest = false;
        G.spaces.istanbul.land.ottoman = {regular: 39, merc: 0, cav: 0};
        G.spaces.istanbul.naval.ottoman = {galley: 9, galleon: 0, racebuilt: 0, corsair: 0};

        expect(recruitmentOptions(G)).toHaveLength(0);

        // Freeing one naval counter restores the galley choices without
        // reopening the full land pool.
        G.spaces.istanbul.naval.ottoman.galley = 8;
        const options = recruitmentOptions(G);
        expect(options.some((option) => option.id.startsWith("galley:"))).toBe(true);
        expect(options.some((option) => option.id.startsWith("regular:"))).toBe(false);
    });
});

describe("minor-power counter supply (24.3)", () => {
    it("uses the printed regular counters instead of a flat twelve-point allowance", () => {
        expect(landPoolLimit("scotland")).toBe(4);
        expect(landPoolLimit("ireland")).toBe(6);
        expect(landPoolLimit("portugal")).toBe(4);
        expect(landPoolLimit("papacy")).toBe(4);
        expect(landPoolLimit("venice")).toBe(6);

        const G = game();
        for (const space of Object.values(G.spaces)) delete space.land.venice;
        G.spaces.venice.land.venice = {regular: 6, merc: 0, cav: 0};
        expect(landPoolRoom(G, "venice")).toBe(0);
        expect(addLandFromPool(G, "venice", "venice", "regular", 1)).toBe(0);
    });

    it("uses the printed minor naval counters, including no ships for Scotland and Ireland", () => {
        expect(navalPoolLimit("scotland")).toBe(0);
        expect(navalPoolLimit("ireland")).toBe(0);
        expect(navalPoolLimit("portugal")).toBe(2);
        expect(navalPoolLimit("papacy")).toBe(1);
        expect(navalPoolLimit("venice")).toBe(4);

        const G = game();
        for (const zone of Object.values(G.seaZones)) delete zone.naval.venice;
        for (const space of Object.values(G.spaces)) delete space.naval.venice;
        G.spaces.venice.naval.venice = {galley: 4, galleon: 0, racebuilt: 0, corsair: 0};
        expect(navalPoolRoom(G, "venice")).toBe(0);
        expect(addNavalFromPool(G, "venice", "venice", "galley", 1)).toBe(0);
    });
});
