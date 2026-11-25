import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {worldPiracy} from "./moves";
import {startPiracy} from "./piracy";
import {setupGame} from "./util";

const context = (values: number[] = [], player = "5"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 1, Shuffle: (cards: unknown[]) => cards},
});

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const pirate = (G: VQGame, captain: string, location: string): void => {
    G.powers.protestant.cp = 2;
    G.worldCaptains[captain] = {power: "protestant", location, damaged: false, colony: false};
    G.worldPatrols = {};
};

describe("Sea Captain Table bonuses (Scenario Book p. 34)", () => {
    it("de Sores ignores fortress dice", () => {
        const G = game();
        pirate(G, "deSores", "northAtlantic");
        G.worldControls.florida = "spain";
        G.worldFortresses = {florida: "spain"};

        expect(worldPiracy(G, context([1, 1, 1]), {captain: "deSores"})).toBeUndefined();

        // No fortress defence die was rolled ("Fortresses do not roll against him").
        expect(G.log.join("\n")).not.toContain("World piracy defense");
    });

    it("le Clerc is P2 in the Antilles", () => {
        const G = game();
        pirate(G, "leClerc", "antilles");
        G.worldColonies.antillesColony = "spain";

        expect(worldPiracy(G, context([1, 1, 1, 1]), {captain: "leClerc"})).toBeUndefined();

        // One settlement gives a base die of 1; P2 adds two more.
        const line = G.lastRolls;
        expect(line).toContain("World piracy (le Clerc)");
        expect((line.match(/\d/g) ?? []).length).toBeGreaterThanOrEqual(3);
        expect(G.log.join("\n")).toContain("World piracy (le Clerc): [1,1,1]");
    });
});

describe("Europe piracy defence dice (rule 16.4 step 2)", () => {
    const defenceDice = (builtFortress: boolean): number => {
        const G = game();
        G.powers.france.wars = [...new Set([...G.powers.france.wars, "england"])];
        G.powers.england.wars = [...new Set([...G.powers.england.wars, "france"])];
        G.seaZones.englishChannel.naval.france = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
        G.spaces.plymouth.control = "england";
        G.spaces.plymouth.unrest = false;
        G.spaces.plymouth.siege = undefined;
        G.spaces.plymouth.fortress = builtFortress;
        startPiracy(G, context(new Array(12).fill(1), "3"), "france", "england", "englishChannel");
        const match = /Piracy defense \[([0-9,]*)\]/.exec(G.log.join("\n"));
        return match === null || match[1] === "" ? 0 : match[1].split(",").length;
    };

    it("counts a fortress built during play but not a key", () => {
        expect(defenceDice(true)).toBe(defenceDice(false) + 1);
    });
});
