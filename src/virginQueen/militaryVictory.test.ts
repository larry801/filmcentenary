import {Ctx} from "boardgame.io";
import {POWERS, POWER_INFO, VQGame} from "./constant/general";
import {DUTCH_KEYS, KEY_SPACES} from "./mapData";
import {checkImmediateVictory, checkVictory, controlledKeys, setupGame} from "./util";

const fakeCtx = (numPlayers = 6): Ctx => ({
    numPlayers,
    random: {Die: () => 6, Shuffle: (a: any[]) => a},
} as unknown as Ctx);

const newGame = (numPlayers = 6): VQGame => setupGame(fakeCtx(numPlayers));

/** Keys a power may use for a military victory (Protestant excludes the Netherlands). */
const militaryKeys = (p: string): string[] =>
    KEY_SPACES.filter((id) => p !== "protestant" || !DUTCH_KEYS.includes(id));

const setKeys = (G: VQGame, p: (typeof POWERS)[number], count: number, keys = militaryKeys(p)): void => {
    for (const id of keys.slice(0, count)) {
        G.spaces[id].control = p;
        G.spaces[id].unrest = false;
    }
};

/** Remove every starting key so the test controls the exact count. */
const clearKeys = (G: VQGame): void => {
    for (const id of KEY_SPACES) {
        G.spaces[id].control = "independent";
        G.spaces[id].unrest = false;
    }
};

describe("military victory (rule 25.1)", () => {
    it("uses the printed Auto Win values from the six power cards", () => {
        expect(POWER_INFO.ottoman.autoWinKeys).toBe(10);
        expect(POWER_INFO.spain.autoWinKeys).toBe(14);
        expect(POWER_INFO.england.autoWinKeys).toBe(7);
        expect(POWER_INFO.france.autoWinKeys).toBe(10);
        expect(POWER_INFO.hre.autoWinKeys).toBe(8);
        expect(POWER_INFO.protestant.autoWinKeys).toBe(5);
    });

    it.each(POWERS.map((p) => [p, POWER_INFO[p].autoWinKeys] as const))(
        "%s wins exactly at its Auto Win count, not one key earlier",
        (p, goal) => {
            const G = newGame();
            clearKeys(G);
            setKeys(G, p, goal - 1);
            expect(controlledKeys(G, p)).toHaveLength(goal - 1);
            expect(checkImmediateVictory(G)).toBeUndefined();

            setKeys(G, p, goal);
            expect(controlledKeys(G, p)).toHaveLength(goal);
            expect(checkImmediateVictory(G)).toEqual({winner: p, reason: "military"});
        },
    );

    it("never counts a key in unrest toward the military victory", () => {
        const G = newGame();
        clearKeys(G);
        const keys = militaryKeys("england");
        setKeys(G, "england", POWER_INFO.england.autoWinKeys, keys);
        G.spaces[keys[0]].unrest = true;

        expect(controlledKeys(G, "england")).toHaveLength(POWER_INFO.england.autoWinKeys - 1);
        expect(checkImmediateVictory(G)).toBeUndefined();

        G.spaces[keys[0]].unrest = false;
        expect(checkImmediateVictory(G)).toEqual({winner: "england", reason: "military"});
    });

    it("counts only Protestant keys outside the Netherlands", () => {
        const G = newGame();
        clearKeys(G);
        for (const id of DUTCH_KEYS) {
            G.spaces[id].control = "protestant";
            G.spaces[id].unrest = false;
        }
        const outside = militaryKeys("protestant");
        setKeys(G, "protestant", 4, outside);

        expect(controlledKeys(G, "protestant")).toHaveLength(4 + DUTCH_KEYS.length);
        expect(checkImmediateVictory(G)).toBeUndefined();

        G.spaces[outside[4]].control = "protestant";
        expect(checkImmediateVictory(G)).toEqual({winner: "protestant", reason: "military"});
    });

    it("does not award a military victory during Diplomacy or Spring", () => {
        const G = newGame();
        clearKeys(G);
        setKeys(G, "france", POWER_INFO.france.autoWinKeys);

        expect(checkImmediateVictory(G, "diplomacy")).toBeUndefined();
        expect(checkImmediateVictory(G, "spring")).toBeUndefined();
        expect(checkImmediateVictory(G, "action")).toEqual({winner: "france", reason: "military"});
        expect(checkVictory(G, false, "diplomacy")).toBeUndefined();
        expect(checkVictory(G, false, "action")?.reason).toBe("military");
    });

    it("does not let an activated major power win a military victory", () => {
        const G = newGame(5);
        clearKeys(G);
        G.activatedMajors = {...G.activatedMajors, hre: {ally: "spain", baseline: 0}};
        setKeys(G, "hre", POWER_INFO.hre.autoWinKeys);

        expect(checkImmediateVictory(G)).toBeUndefined();
    });
});
