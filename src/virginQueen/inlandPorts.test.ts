import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame, landCount, navalCount} from "./constant/general";
import {buildNaval, moveNaval, navalTransport} from "./moves";
import {setupGame, winter} from "./util";

const context = (player = "1"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame(context());

const setupNorthSea = (G: VQGame): void => {
    G.seaZones.northSea.naval.spain = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
    G.spaces.antwerp.control = "spain";
    G.spaces.flushing.control = "spain";
    G.spaces.antwerp.unrest = false;
    G.spaces.antwerp.land.spain = {regular: 2, merc: 0, cav: 0};
};

describe("Antwerp and Rotterdam inland ports (rule 16.7)", () => {
    it("never allows naval units to be built in Antwerp or Rotterdam", () => {
        const G = game();
        G.spaces.antwerp.control = "protestant";
        G.spaces.rotterdam.control = "protestant";
        G.powers.protestant.cp = 4;

        expect(buildNaval(G, context("5"), {port: "antwerp", kind: "galleon"})).toBe(INVALID_MOVE);
        expect(buildNaval(G, context("5"), {port: "rotterdam", kind: "galleon"})).toBe(INVALID_MOVE);
        expect(G.powers.protestant.cp).toBe(4);
    });

    it("never allows naval movement into an inland port", () => {
        const G = game();
        G.powers.spain.cp = 2;
        G.seaZones.northSea.naval.spain = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        expect(moveNaval(G, context("1"), {from: "northSea", to: "antwerp"})).toBe(INVALID_MOVE);
        expect(moveNaval(G, context("1"), {from: "northSea", to: "rotterdam"})).toBe(INVALID_MOVE);
        expect(G.powers.spain.cp).toBe(2);
    });

    it("moves land units directly through the North Sea for 1 CP when the link is controlled", () => {
        const G = game();
        setupNorthSea(G);
        G.powers.spain.cp = 1;
        const antwerpBefore = landCount(G.spaces.antwerp.land.spain);

        expect(navalTransport(G, context("1"), {
            from: "antwerp", to: "amsterdam", zones: ["northSea"], units: {regular: 1},
        })).toBeUndefined();

        expect(G.powers.spain.cp).toBe(0);
        expect(landCount(G.spaces.antwerp.land.spain)).toBe(antwerpBefore - 1);
        expect(G.spaces.amsterdam.land.spain?.regular).toBe(1);
    });

    it("requires the linked port to be controlled by the moving power", () => {
        const G = game();
        setupNorthSea(G);
        G.powers.spain.cp = 1;
        G.spaces.flushing.control = "france";

        expect(navalTransport(G, context("1"), {
            from: "antwerp", to: "amsterdam", zones: ["northSea"], units: {regular: 1},
        })).toBe(INVALID_MOVE);
        expect(G.powers.spain.cp).toBe(1);
    });

    it("requires a friendly fleet in the North Sea for the inland leg", () => {
        const G = game();
        setupNorthSea(G);
        delete G.seaZones.northSea.naval.spain;
        G.powers.spain.cp = 1;

        expect(navalTransport(G, context("1"), {
            from: "antwerp", to: "amsterdam", zones: ["northSea"], units: {regular: 1},
        })).toBe(INVALID_MOVE);
        expect(G.powers.spain.cp).toBe(1);
    });

    it("restricts galleys and galleons to their official powers", () => {
        const G = game();
        G.powers.england.cp = 4;
        expect(buildNaval(G, context("2"), {port: "london", kind: "galley"})).toBe(INVALID_MOVE);
        expect(buildNaval(G, context("2"), {port: "london", kind: "galleon"})).toBeUndefined();
        expect(G.powers.england.cp).toBe(2);

        G.powers.protestant.cp = 2;
        G.spaces.antwerp.control = "protestant";
        expect(buildNaval(G, context("5"), {port: "antwerp", kind: "galleon"})).toBe(INVALID_MOVE);
        expect(G.powers.protestant.cp).toBe(2);
    });

    it("excludes inland ports when returning fleets to port in winter", () => {
        const G = game();
        // A Spanish fleet in the North Sea must not be placed in Antwerp or
        // Rotterdam even though both list the North Sea as a port.
        setupNorthSea(G);
        G.spaces.antwerp.control = "spain";
        G.spaces.rotterdam.control = "spain";
        for (const id of ["london", "norwich", "flushing", "brielle", "amsterdam"]) {
            G.spaces[id].control = "france";
        }
        G.seaZones.northSea.naval.spain = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        winter(G, context("1"));

        expect(navalCount(G.spaces.antwerp.naval.spain)).toBe(0);
        expect(navalCount(G.spaces.rotterdam.naval.spain)).toBe(0);
    });
});
