import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {resolveColonies, setupGame} from "./util";

const context = (values: number[]): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "cardDraw",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context([]), numPlayers: 6} as Ctx);

const withFlorida = (): VQGame => {
    const G = game();
    G.worldColonies = {florida: "spain"};
    G.worldControls = {florida: "spain"};
    return G;
};

describe("Colony Table at Card Draw (rule 8.4)", () => {
    it("eliminates a colony on 2-4", () => {
        const G = withFlorida();
        resolveColonies(G, context([1, 2]));
        expect(G.worldColonies.florida).toBeUndefined();
        expect(G.worldControls.florida).toBeUndefined();
    });

    it("keeps a colony with no effect on 5-8", () => {
        const G = withFlorida();
        resolveColonies(G, context([2, 3]));
        expect(G.worldColonies.florida).toBe("spain");
        expect(G.log.join("\n")).toContain("no effect");
    });

    it("awards a treasure on 9-11", () => {
        const G = withFlorida();
        const before = G.powers.spain.treasures.length;
        resolveColonies(G, context([4, 5, 3]));
        expect(G.powers.spain.treasures.length).toBe(before + 1);
    });

    it("awards a treasure and Virginia Dare VP on 11 or more", () => {
        const G = withFlorida();
        const treasures = G.powers.spain.treasures.length;
        const vp = G.powers.spain.bonusVp;
        resolveColonies(G, context([5, 6, 3]));
        expect(G.powers.spain.treasures.length).toBe(treasures + 1);
        expect(G.powers.spain.bonusVp).toBe(vp + 1);
    });

    it("adds 1 for the Plantation science bonus", () => {
        const G = withFlorida();
        G.powers.spain.scienceBonuses = ["plantation"];
        const before = G.powers.spain.treasures.length;
        resolveColonies(G, context([4, 4, 3]));
        expect(G.powers.spain.treasures.length).toBe(before + 1);
        expect(G.lastRolls).toContain("1 plantation");
    });

    it("adds 1 for a fortress at the colony", () => {
        const G = withFlorida();
        G.worldFortresses = {florida: "spain"};
        const treasures = G.powers.spain.treasures.length;
        resolveColonies(G, context([4, 4, 3]));
        expect(G.powers.spain.treasures.length).toBe(treasures + 1);
        expect(G.lastRolls).toContain("1 fortress");
    });

    it("does not add fortress bonus when owned by another power", () => {
        const G = withFlorida();
        G.worldFortresses = {florida: "england"};
        resolveColonies(G, context([4, 4]));
        expect(G.lastRolls).toContain("0 fortress");
    });
});
