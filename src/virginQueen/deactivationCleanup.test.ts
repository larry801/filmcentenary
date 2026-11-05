import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {SPACES} from "./mapData";
import {activateMajor, deactivateMajor, setupGame} from "./util";

const context = (): Ctx => ({
    numPlayers: 2,
    currentPlayer: "0",
    playerID: "0",
    phase: "diplomacy",
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const activatedHre = (): VQGame => {
    const G = setupGame(context());
    expect(activateMajor(G, context(), "hre", "england")).toBe(true);
    return G;
};

const homeSpace = (minor: string): string => {
    const space = SPACES.find((candidate) => candidate.home === minor);
    if (space === undefined) throw new Error(`No home space for ${minor}`);
    return space.id;
};

/**
 * Scenario Book pp. 13-14: when an Activated Major Power is deactivated, its
 * cards *and treasures* are discarded.  A HRE deactivation also deactivates
 * the Papacy, Venice or Ireland if either is one of its minor power allies.
 */
describe("Activated Major Power deactivation cleanup", () => {
    it("discards the deactivating major's treasure tokens", () => {
        const G = activatedHre();
        G.powers.hre.treasures = [1, 4, 6];

        deactivateMajor(G, "hre");

        expect(G.powers.hre.treasures).toEqual([]);
        expect(G.log.join("\n")).toContain("神圣罗马帝国 discards 3 treasure(s).");
    });

    it("discards treasures for any deactivated major, not only the HRE", () => {
        const G = setupGame(context());
        G.powers.ottoman.treasures = [2];

        deactivateMajor(G, "ottoman");

        expect(G.powers.ottoman.treasures).toEqual([]);
    });

    it("deactivates the Papacy, Venice and Ireland along with the HRE", () => {
        const G = activatedHre();
        // Papacy and Venice are normally Spanish allies in the campaign setup;
        // clear those markers so the HRE is their only ally in this case.
        G.powers.spain.alliedMinors = [];
        G.powers.hre.alliedMinors = ["papacy", "venice", "ireland"];
        const homes = ["papacy", "venice", "ireland"].map(homeSpace);
        for (const home of homes) G.spaces[home].control = "hre";

        deactivateMajor(G, "hre");

        expect(G.powers.hre.alliedMinors).toEqual([]);
        for (const minor of ["papacy", "venice", "ireland"] as const) {
            expect(G.spaces[homeSpace(minor)].control).toBe(minor);
            expect(G.log.join("\n")).toContain(`${minor} is deactivated with the Holy Roman Empire.`);
        }
    });

    it("leaves another major's minor allies untouched", () => {
        const G = activatedHre();
        G.powers.spain.alliedMinors = ["papacy"];
        G.powers.hre.alliedMinors = ["venice"];
        const papalHome = homeSpace("papacy");
        G.spaces[papalHome].control = "spain";

        deactivateMajor(G, "hre");

        expect(G.powers.spain.alliedMinors).toContain("papacy");
        expect(G.spaces[papalHome].control).toBe("spain");
        expect(G.powers.hre.alliedMinors).not.toContain("venice");
    });
});
