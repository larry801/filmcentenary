import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {buildExpedition, buildNaval, buildWorldFortress, piracy, worldPiracy} from "./moves";
import {choosePiracy, piracyOptions} from "./piracy";
import {setupGame} from "./util";

const context = (values: number[] = [6], playerID = "3"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), numPlayers: 6} as Ctx);

describe("Spain may not build galleys or galleons in Netherlands ports (rule 17.3)", () => {
    const prepare = (G: VQGame): void => {
        G.spaces.amsterdam.control = "spain";
        G.spaces.amsterdam.unrest = false;
        G.spaces.amsterdam.land = {};
        G.spaces.amsterdam.naval = {};
        G.dutchSpanishHome = false;
        G.powers.spain.cp = 10;
    };

    it("refuses a galley in Amsterdam", () => {
        const G = game();
        prepare(G);
        expect(buildNaval(G, context([6], "1"), {port: "amsterdam", kind: "galley"})).toBe("INVALID_MOVE");
    });

    it("refuses a galleon in Amsterdam", () => {
        const G = game();
        prepare(G);
        expect(buildNaval(G, context([6], "1"), {port: "amsterdam", kind: "galleon"})).toBe("INVALID_MOVE");
    });

    it("still refuses a galleon after Union of Arras (card FAQ #109)", () => {
        const G = game();
        prepare(G);
        G.dutchSpanishHome = true;
        // "Even after this event, Walloons remain the only units that Spain may
        // build in the Netherlands" (Scenario Book p. 32).
        expect(buildNaval(G, context([6], "1"), {port: "amsterdam", kind: "galleon"})).toBe("INVALID_MOVE");
    });
});

describe("inland-port piracy needs the linked port (rule 16.7)", () => {
    const prepare = (G: VQGame): void => {
        G.powers.england.wars = [...new Set([...G.powers.england.wars, "spain"])];
        G.powers.spain.wars = [...new Set([...G.powers.spain.wars, "england"])];
        G.seaZones.northSea.naval.england = {galley: 0, galleon: 2, racebuilt: 0, corsair: 0};
        // Spain controls only Antwerp in the North Sea; the linked port
        // (Flushing) belongs to a third power, so Antwerp is the only
        // candidate target and the inland-waterway restriction decides.
        for (const id of ["amsterdam", "rotterdam", "bruges", "brielle", "london", "norwich", "edinburgh", "aberdeen", "alkmaar", "berwick"]) {
            G.spaces[id].control = "england";
        }
        G.spaces.flushing.control = "france";
        G.spaces.antwerp.control = "spain";
        G.powers.england.cp = 10;
        G.piracyUsed = {};
    };

    it("refuses piracy against Antwerp while the linked port is not friendly", () => {
        const G = game();
        prepare(G);
        expect(piracy(G, context([6], "2"), {zone: "northSea", target: "spain"})).toBe("INVALID_MOVE");
    });

    it("allows piracy against Antwerp when England controls Flushing", () => {
        const G = game();
        prepare(G);
        G.spaces.flushing.control = "england";
        expect(piracy(G, context([6], "2"), {zone: "northSea", target: "spain"})).toBeUndefined();
    });
});

describe("world piracy zone limit (rule 16.5)", () => {
    it("refuses a third power in the same ocean zone", () => {
        const G = game();
        G.worldCaptains.hawkins = {power: "england", location: "spanishMain", damaged: false, colony: false};
        G.powers.england.cp = 10;
        G.piracyZones = {spanishMain: ["france", "protestant"]};
        G.piracyActions = {};
        expect(worldPiracy(G, context([6], "2"), {captain: "hawkins"})).toBe("INVALID_MOVE");
    });
});

describe("Le Testu may not be both scientist and captain (rule 17.4)", () => {
    it("refuses a Le Testu expedition after he was sponsored as a scientist", () => {
        const G = game();
        G.powers.france.seaCaptains = [...new Set([...G.powers.france.seaCaptains, "leTestu"])];
        G.powers.france.cp = 10;
        G.patronizedThisTurn = ["france:scientist"];
        expect(buildExpedition(G, context([6], "3"), {captain: "leTestu"})).toBe("INVALID_MOVE");
    });

    it("allows a Le Testu expedition when he was not sponsored", () => {
        const G = game();
        G.powers.france.seaCaptains = [...new Set([...G.powers.france.seaCaptains, "leTestu"])];
        G.powers.france.cp = 10;
        G.patronizedThisTurn = [];
        expect(buildExpedition(G, context([6], "3"), {captain: "leTestu"})).toBeUndefined();
    });
});

describe("world fortress markers are per turn (rules 8.2/17.5)", () => {
    it("allows one fortress per turn and refuses a second in the same turn", () => {
        const G = game();
        G.worldControls.florida = "spain";
        G.worldControls.antillesColony = "spain";
        G.powers.spain.cp = 10;
        G.worldFortressesBuilt = 0;
        expect(buildWorldFortress(G, context([6], "1"), {settlement: "florida"})).toBeUndefined();
        expect(buildWorldFortress(G, context([6], "1"), {settlement: "antillesColony"})).toBe("INVALID_MOVE");
    });

    it("allows another fortress in a new turn", () => {
        const G = game();
        G.worldControls.florida = "spain";
        G.worldControls.antillesColony = "spain";
        G.powers.spain.cp = 10;
        G.worldFortressesBuilt = 0;
        expect(buildWorldFortress(G, context([6], "1"), {settlement: "florida"})).toBeUndefined();
        G.worldFortressesBuilt = 0;
        expect(buildWorldFortress(G, context([6], "1"), {settlement: "antillesColony"})).toBeUndefined();
    });
});

describe("piracy can downgrade the Armada (rule 16.4 step 5d)", () => {
    it("offers the Armada reward when Spain is the target and the Armada is adjacent", () => {
        const G = game();
        // Rewards step after a successful piracy roll against Spain.
        G.pendingPiracy = {power: "england", target: "spain", zone: "northSea", step: "rewards", remaining: 2, rewards: {}};
        G.armada = {strength: 4, location: "englishChannel"};
        expect(piracyOptions(G).some((option) => option.id === "armada")).toBe(true);
    });

    it("does not offer the Armada reward when the Armada is out of range", () => {
        const G = game();
        G.pendingPiracy = {power: "england", target: "spain", zone: "northSea", step: "rewards", remaining: 2, rewards: {}};
        G.armada = {strength: 4, location: "aegean"};
        expect(piracyOptions(G).some((option) => option.id === "armada")).toBe(false);
    });

    it("downgrades the Armada by two strength when the reward is chosen", () => {
        const G = game();
        G.pendingPiracy = {power: "england", target: "spain", zone: "northSea", step: "rewards", remaining: 2, rewards: {}};
        G.armada = {strength: 6, location: "englishChannel"};
        // The reward is chosen by the target power (Spain, player "1").
        expect(choosePiracy(G, context([6], "1"), {choice: "armada"})).toBeUndefined();
        expect(G.armada?.strength).toBe(4);
    });
});
