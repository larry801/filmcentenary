import {Ctx} from "boardgame.io";
import {POWERS, VQGame} from "./constant/general";
import {ownerOf} from "./ownership";
import {powerVp, setupGame, vpBreakdown, vpBreakdowns} from "./util";

const context = (numPlayers = 6): Ctx => ({
    numPlayers,
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

describe("VP breakdown panel data", () => {
    it("splits every power's total into the same sources powerVp sums", () => {
        const G = setupGame(context());
        for (const p of POWERS) G.powers[p].bonusVp = POWERS.indexOf(p) + 1;
        const rows = vpBreakdowns(G);
        expect(rows).toHaveLength(POWERS.filter((p) => ownerOf(G, p) !== undefined).length);
        for (const row of rows) {
            expect(row.total).toBe(powerVp(G, row.power));
            expect(row.baseVp + row.religiousVp + row.bonusVp + row.fortressVp + row.cyprusVp).toBe(row.total);
            expect(row.keyCount).toBeGreaterThanOrEqual(0);
        }
        expect(rows.map((row) => row.total)).toEqual([...rows.map((row) => row.total)].sort((a, b) => b - a));
    });

    it("keeps an unrevealed HRE religious preference out of the total", () => {
        const G: VQGame = setupGame(context(2), {scenario: "tutorial"});
        G.hreReligiousPreferenceChosen = true;
        G.hreReligiousPreferenceRevealed = false;
        const hre = vpBreakdown(G, "hre");
        expect(hre.secretReligiousVp).toBe(true);
        expect(hre.religiousVp).toBe(0);
        expect(hre.total).toBe(powerVp(G, "hre"));
    });

    it("splits the tutorial Ottoman fortress and Cyprus VP", () => {
        const G = setupGame(context(2), {scenario: "tutorial"});
        G.tutorialEffects = {...G.tutorialEffects, cyprusTarget: "cyprus"};
        G.spaces.cyprus.control = "ottoman";
        const row = vpBreakdown(G, "ottoman");
        expect(row.fortressVp).toBeGreaterThan(0);
        expect(row.cyprusVp).toBe(1);
        expect(row.total).toBe(powerVp(G, "ottoman"));
    });
});
