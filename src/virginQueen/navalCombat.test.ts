import {Ctx} from "boardgame.io";
import {VQGame, navalCount} from "./constant/general";
import {chooseNavalOrder, moveNaval} from "./moves";
import {SPACES} from "./mapData";
import {setWar, setupGame} from "./util";

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

        expect(moveNaval(G, context([1, 1, 6, 6, 6, 6, 6, 6]), {from: "calais", to: "englishChannel"})).toBeUndefined();

        expect(G.lastRolls).toContain("4 hits (4 dice) vs England 2 hits (2 dice)");
        expect(navalCount(G.seaZones.englishChannel.naval.france)).toBe(1);
        expect(navalCount(G.seaZones.englishChannel.naval.england)).toBe(0);
    });

    it("applies the odd hit to the losing side only", () => {
        const G = game();
        G.powers.france.cp = 1;
        G.spaces.calais.naval.france = {galley: 0, galleon: 3, racebuilt: 0, corsair: 0};
        G.seaZones.englishChannel.naval.england = {galley: 0, galleon: 3, racebuilt: 0, corsair: 0};
        const beforeEnglish = totalEnglish(G);

        expect(moveNaval(G, context([1, 1, 6, 6, 6, 1, 1, 1, 1, 1, 1, 1, 1, 1]), {
            from: "calais", to: "englishChannel",
        })).toBeUndefined();

        expect(G.lastRolls).toContain("3 hits (6 dice) vs England 0 hits (6 dice)");
        expect(totalEnglish(G)).toBe(beforeEnglish - 2);
        expect(navalCount(G.seaZones.englishChannel.naval.england)).toBe(0);
        expect(navalCount(G.seaZones.englishChannel.naval.france)).toBe(3);
    });

    it("lets a sea-zone defender avoid battle on a successful roll", () => {
        const G = game();
        G.powers.france.cp = 1;
        G.spaces.calais.naval.france = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        for (const space of SPACES) delete G.spaces[space.id].naval.england;
        G.seaZones.englishChannel.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        G.spaces.portsmouth.control = "england";
        G.spaces.plymouth.control = "england";
        const beforeEnglish = totalEnglish(G);

        expect(moveNaval(G, context([6, 6]), {from: "calais", to: "englishChannel"})).toBeUndefined();

        expect(G.log.join("\n")).toContain("avoids naval battle");
        expect(navalCount(G.seaZones.englishChannel.naval.england)).toBe(0);
        expect(totalEnglish(G)).toBe(beforeEnglish);
        expect(navalCount(G.seaZones.englishChannel.naval.france)).toBe(1);
    });

    it("adds the defender die in port combat and forces the attacker to sea", () => {
        const G = game();
        G.powers.france.cp = 1;
        G.seaZones.englishChannel.naval.france = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        G.spaces.portsmouth.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        expect(moveNaval(G, context([1, 1, 1, 1, 1]), {from: "englishChannel", to: "portsmouth"})).toBeUndefined();

        expect(G.lastRolls).toContain("(2 dice) vs England 0 hits (3 dice)");
        expect(navalCount(G.spaces.portsmouth.naval.france)).toBe(0);
    });

    it("lets an adjacent enemy fleet intercept an empty destination", () => {
        const G = game();
        G.powers.france.cp = 1;
        G.spaces.calais.naval.france = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        G.seaZones.northSea.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        expect(moveNaval(G, context([6, 6, 6, 6, 6, 6]), {from: "calais", to: "englishChannel"})).toBeUndefined();

        expect(G.log.join("\n")).toContain("intercepts the naval move into englishChannel");
        expect(navalCount(G.seaZones.englishChannel.naval.england)).toBe(1);
        expect(navalCount(G.seaZones.northSea.naval.england)).toBe(0);
    });

    it("continues the move when the naval interception roll fails", () => {
        const G = game();
        G.powers.france.cp = 1;
        G.spaces.calais.naval.france = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        for (const space of SPACES) delete G.spaces[space.id].naval.england;
        G.seaZones.northSea.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        expect(moveNaval(G, context([1, 1]), {from: "calais", to: "englishChannel"})).toBeUndefined();

        expect(G.log.join("\n")).not.toContain("intercepts the naval move");
        expect(navalCount(G.seaZones.northSea.naval.england)).toBe(1);
        expect(navalCount(G.seaZones.englishChannel.naval.france)).toBe(1);
    });

    it("does not intercept when the destination already contains enemy naval units", () => {
        const G = game();
        G.powers.france.cp = 1;
        G.spaces.calais.naval.france = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        G.seaZones.englishChannel.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        G.seaZones.northSea.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        expect(moveNaval(G, context([6, 6, 6, 6, 6, 6]), {from: "calais", to: "englishChannel"})).toBeUndefined();

        expect(G.log.join("\n")).not.toContain("intercepts the naval move");
        expect(navalCount(G.seaZones.northSea.naval.england)).toBe(1);
    });

    it("lets the attacker choose a non-impulse enemy first", () => {
        const G = game();
        setWar(G, "france", "spain");
        G.powers.france.cp = 1;
        G.spaces.calais.naval.france = {galley: 0, galleon: 4, racebuilt: 0, corsair: 0};
        G.seaZones.englishChannel.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        G.seaZones.englishChannel.naval.spain = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        expect(moveNaval(G, context([1, 1, 1, 1]), {from: "calais", to: "englishChannel"})).toBeUndefined();
        expect(chooseNavalOrder(G, context([...Array(10).fill(6)]), {enemy: "england"})).toBeUndefined();

        expect(G.pendingNavalOrder?.enemies).toEqual(["spain"]);
    });

    it("fights multiple enemy powers one at a time in impulse order", () => {
        const G = game();
        setWar(G, "france", "spain");
        G.powers.france.cp = 1;
        G.spaces.calais.naval.france = {galley: 0, galleon: 4, racebuilt: 0, corsair: 0};
        G.seaZones.englishChannel.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        G.seaZones.englishChannel.naval.spain = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        expect(moveNaval(G, context([1, 1, 1, 1]), {from: "calais", to: "englishChannel"})).toBeUndefined();
        expect(G.pendingNavalOrder?.enemies).toEqual(["spain", "england"]);

        expect(chooseNavalOrder(G, context([...Array(10).fill(6)]), {enemy: "spain"})).toBeUndefined();
        expect(G.pendingNavalOrder?.enemies).toEqual(["england"]);
        expect(chooseNavalOrder(G, context([...Array(8).fill(6)]), {enemy: "england"})).toBeUndefined();

        expect(G.log.join("\n").match(/Naval battle at/g)).toHaveLength(2);
        expect(navalCount(G.seaZones.englishChannel.naval.spain)).toBe(0);
        expect(navalCount(G.seaZones.englishChannel.naval.england)).toBe(0);
        expect(navalCount(G.seaZones.englishChannel.naval.france)).toBe(2);
    });

    it("lets the defender retain one unit when both sides are eliminated", () => {
        const G = game();
        G.powers.france.cp = 1;
        G.spaces.calais.naval.france = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        G.seaZones.englishChannel.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};

        expect(moveNaval(G, context([1, 1, 6, 6, 6, 6]), {from: "calais", to: "englishChannel"})).toBeUndefined();

        expect(navalCount(G.seaZones.englishChannel.naval.france)).toBe(0);
        expect(navalCount(G.seaZones.englishChannel.naval.england)).toBe(1);
        expect(G.log.join("\n")).toContain("retains 1 galley");
    });
});
