import {Ctx} from "boardgame.io";
import {VQGame, navalCount} from "./constant/general";
import {moveNaval} from "./moves";
import {setupGame} from "./util";

const context = (values: number[] = [6]): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), numPlayers: 6} as Ctx);

const totalFrench = (G: VQGame): number => Object.values(G.seaZones).reduce((total, zone) =>
    total + navalCount(zone.naval.france), 0) + Object.values(G.spaces).reduce((total, space) =>
    total + navalCount(space.naval.france), 0);

const totalEnglish = (G: VQGame): number => Object.values(G.seaZones).reduce((total, zone) =>
    total + navalCount(zone.naval.england), 0) + Object.values(G.spaces).reduce((total, space) =>
    total + navalCount(space.naval.england), 0);

describe("official naval combat (rule 16.2)", () => {
    it("rolls two dice per galleon and removes one ship per two hits", () => {
        const G = game();
        G.powers.france.cp = 1;
        G.spaces.calais.naval.france = {galley: 0, galleon: 2, racebuilt: 0, corsair: 0};
        G.seaZones.englishChannel.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        expect(moveNaval(G, context([6, 6, 6, 6, 6, 6]), {from: "calais", to: "englishChannel"})).toBeUndefined();

        expect(G.lastRolls).toContain("4 hits (4 dice) vs 2 hits (2 dice)");
        expect(navalCount(G.seaZones.englishChannel.naval.france)).toBe(1);
        expect(navalCount(G.seaZones.englishChannel.naval.england)).toBe(0);
    });

    it("applies the odd hit to the losing side only", () => {
        const G = game();
        G.powers.france.cp = 1;
        G.spaces.calais.naval.france = {galley: 0, galleon: 3, racebuilt: 0, corsair: 0};
        G.seaZones.englishChannel.naval.england = {galley: 0, galleon: 3, racebuilt: 0, corsair: 0};
        const beforeEnglish = totalEnglish(G);

        expect(moveNaval(G, context([6, 6, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1]), {
            from: "calais", to: "englishChannel",
        })).toBeUndefined();

        expect(G.lastRolls).toContain("3 hits (6 dice) vs 0 hits (6 dice)");
        expect(totalEnglish(G)).toBe(beforeEnglish - 2);
        expect(navalCount(G.seaZones.englishChannel.naval.england)).toBe(0);
        expect(navalCount(G.seaZones.englishChannel.naval.france)).toBe(3);
    });

    it("adds the defender die in port combat and forces the attacker to sea", () => {
        const G = game();
        G.powers.france.cp = 1;
        G.seaZones.englishChannel.naval.france = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        G.spaces.portsmouth.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        expect(moveNaval(G, context([1, 1, 1, 1, 1]), {from: "englishChannel", to: "portsmouth"})).toBeUndefined();

        expect(G.lastRolls).toContain("(2 dice) vs 0 hits (3 dice)");
        expect(navalCount(G.spaces.portsmouth.naval.france)).toBe(0);
    });

    it("lets the defender retain one unit when both sides are eliminated", () => {
        const G = game();
        G.powers.france.cp = 1;
        G.spaces.calais.naval.france = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        G.seaZones.englishChannel.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        expect(moveNaval(G, context([6, 6, 6, 6]), {from: "calais", to: "englishChannel"})).toBeUndefined();

        expect(navalCount(G.seaZones.englishChannel.naval.france)).toBe(0);
        expect(navalCount(G.seaZones.englishChannel.naval.england)).toBe(1);
        expect(G.log.join("\n")).toContain("retains 1 galley");
    });
});
