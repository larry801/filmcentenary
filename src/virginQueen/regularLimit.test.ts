import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {buildNaval, recruit} from "./moves";
import {setupGame} from "./util";

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

    it("limits Ottoman cavalry counters", () => {
        const G = game();
        for (const space of Object.values(G.spaces)) {
            if (space.land.ottoman !== undefined) space.land.ottoman.cav = 0;
        }
        G.powers.ottoman.cp = 10;
        G.spaces.istanbul.control = "ottoman";
        G.spaces.istanbul.unrest = false;
        G.spaces.istanbul.land.ottoman = {regular: 0, merc: 0, cav: 39};
        const ottomanContext = {...context(), currentPlayer: "0", playerID: "0"} as Ctx;

        expect(recruit(G, ottomanContext, {space: "istanbul", kind: "cav"})).toBe(INVALID_MOVE);
    });

    it("limits English naval counters to six", () => {
        const G = game();
        for (const zone of Object.values(G.seaZones)) delete zone.naval.england;
        for (const space of Object.values(G.spaces)) delete space.naval.england;
        G.spaces.london.naval.england = {galley: 0, galleon: 6, racebuilt: 0, corsair: 0};
        G.spaces.portsmouth.control = "england";
        G.spaces.portsmouth.unrest = false;
        G.powers.england.cp = 10;

        const englandContext = {...context(), currentPlayer: "2", playerID: "2"} as Ctx;
        expect(buildNaval(G, englandContext, {port: "portsmouth", kind: "galleon"})).toBe(INVALID_MOVE);
    });

    it("delays rebuilding while lost naval counters are returning", () => {
        const G = game();
        for (const zone of Object.values(G.seaZones)) delete zone.naval.england;
        for (const space of Object.values(G.spaces)) delete space.naval.england;
        G.spaces.london.naval.england = {galley: 0, galleon: 5, racebuilt: 0, corsair: 0};
        G.navalLost = {england: {galley: 0, galleon: 1, racebuilt: 0, corsair: 0}};
        G.spaces.portsmouth.control = "england";
        G.spaces.portsmouth.unrest = false;
        G.powers.england.cp = 10;

        const englandContext = {...context(), currentPlayer: "2", playerID: "2"} as Ctx;
        expect(buildNaval(G, englandContext, {port: "portsmouth", kind: "galleon"})).toBe(INVALID_MOVE);
        delete G.navalLost.england;
        expect(buildNaval(G, englandContext, {port: "portsmouth", kind: "galleon"})).toBeUndefined();
    });

    it("allows recruiting up to the limit", () => {
        const G = game();
        clearSpanishRegulars(G);
        G.spaces.madrid.land.spain = {regular: 41, merc: 0, cav: 0};

        expect(recruit(G, context(), {space: "seville", kind: "regular"})).toBeUndefined();
        expect(G.spaces.madrid.land.spain.regular + (G.spaces.seville.land.spain?.regular ?? 0)).toBe(42);
    });
});
