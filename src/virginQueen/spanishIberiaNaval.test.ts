import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {POWERS, VQGame} from "./constant/general";
import {SPACES} from "./mapData";
import {moveNaval} from "./moves";
import {legalTargets, setupGame, warCost} from "./util";

const events = (): {setActivePlayers: jest.Mock; endStage: jest.Mock; endTurn: jest.Mock} => ({
    setActivePlayers: jest.fn(),
    endStage: jest.fn(),
    endTurn: jest.fn(),
});

/** Six-player seats follow POWERS order: 0 Ottoman, 1 Spain. */
const context = (player = "1"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
    events: events(),
} as unknown as Ctx);

/**
 * Six-player game with a single Spanish squadron at sea, no cards in hand (so
 * no Action response window opens) and every other naval stack cleared, so the
 * only legal destinations left are the ones under test.
 */
const game = (): VQGame => {
    const G = setupGame(context());
    for (const space of SPACES) {
        G.spaces[space.id].naval = {};
        G.spaces[space.id].land = {};
    }
    for (const zone of Object.values(G.seaZones)) {
        zone.naval = {};
    }
    for (const p of POWERS) G.powers[p].cards = [];
    G.activePower = "spain";
    G.powers.spain.cp = 5;
    return G;
};

describe("rule 9.5 Spanish units entering Ireland or Scotland", () => {
    it("bars a Spanish squadron from Dublin while the DOW cost is above 3", () => {
        const G = game();
        G.spaces.dublin.control = "spain";
        G.seaZones.irishSea.naval.spain = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
        expect(warCost(G, "spain", "england")).toBe(5);

        expect(moveNaval(G, context(), {from: "irishSea", to: "dublin"})).toBe(INVALID_MOVE);

        expect(G.spaces.dublin.naval.spain).toBeUndefined();
        expect(G.seaZones.irishSea.naval.spain?.galley).toBe(1);
        expect(G.powers.spain.wars).not.toContain("england");
        expect(G.powers.spain.cp).toBe(5);
    });

    it("keeps the Irish port out of the highlighted naval targets until 3", () => {
        const G = game();
        G.spaces.dublin.control = "spain";
        G.seaZones.irishSea.naval.spain = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};

        expect(legalTargets(G, "spain", "moveNaval", "irishSea").has("dublin")).toBe(false);
        expect(legalTargets(G, "spain", "moveNaval", "irishSea").has("englishChannel")).toBe(true);

        G.doWCostEnglandSpain = 3;

        expect(legalTargets(G, "spain", "moveNaval", "irishSea").has("dublin")).toBe(true);
    });

    it("treats a DOW cost of 4 as still closed", () => {
        const G = game();
        G.spaces.dublin.control = "spain";
        G.seaZones.irishSea.naval.spain = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
        G.doWCostEnglandSpain = 4;

        expect(moveNaval(G, context(), {from: "irishSea", to: "dublin"})).toBe(INVALID_MOVE);
        expect(G.powers.spain.wars).not.toContain("england");
    });

    it("sails into Dublin and immediately declares war once the cost is 3", () => {
        const G = game();
        G.spaces.dublin.control = "spain";
        G.seaZones.irishSea.naval.spain = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
        G.doWCostEnglandSpain = 3;

        expect(moveNaval(G, context(), {from: "irishSea", to: "dublin"})).toBeUndefined();

        expect(G.spaces.dublin.naval.spain?.galley).toBe(1);
        expect(G.seaZones.irishSea.naval.spain).toBeUndefined();
        expect(G.powers.spain.wars).toContain("england");
        expect(G.powers.england.wars).toContain("spain");
        expect(G.log.join("\n")).toContain("declares war");
    });

    it("bars the entry even into an enemy-held Irish port with the enemy fleet there", () => {
        const G = game();
        // Already at war, so the port entry is otherwise legal: 16.1 allows
        // sailing into another player's port when enemy naval units are present.
        G.powers.spain.wars = ["england"];
        G.powers.england.wars = ["spain"];
        G.spaces.dublin.control = "england";
        G.spaces.dublin.naval.england = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
        G.seaZones.irishSea.naval.spain = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};

        expect(moveNaval(G, context(), {from: "irishSea", to: "dublin"})).toBe(INVALID_MOVE);
        expect(G.spaces.dublin.naval.england?.galley).toBe(1);
    });

    it("applies to Scotland as well", () => {
        const G = game();
        G.spaces.glasgow.control = "spain";
        G.seaZones.atlanticOcean.naval.spain = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
        G.powers.spain.cp = 2;

        expect(moveNaval(G, context(), {from: "atlanticOcean", to: "glasgow"})).toBe(INVALID_MOVE);
        expect(G.powers.spain.wars).not.toContain("england");

        G.doWCostEnglandSpain = 2;

        expect(moveNaval(G, context(), {from: "atlanticOcean", to: "glasgow"})).toBeUndefined();

        expect(G.spaces.glasgow.naval.spain?.galley).toBe(1);
        expect(G.powers.spain.wars).toContain("england");
    });

    it("leaves sea-zone moves alone", () => {
        const G = game();
        G.spaces.dublin.control = "spain";
        G.seaZones.irishSea.naval.spain = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};

        expect(moveNaval(G, context(), {from: "irishSea", to: "englishChannel"})).toBeUndefined();

        expect(G.seaZones.englishChannel.naval.spain?.galley).toBe(1);
        expect(G.powers.spain.wars).not.toContain("england");
    });
});
