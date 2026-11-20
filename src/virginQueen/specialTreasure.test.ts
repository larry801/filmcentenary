import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {TREASURE_TABLE, Treasure, VQGame} from "./constant/general";
import {chooseScienceTreasureBonus, playTreasure} from "./moves";
import {eligibleScienceBonuses, setupGame} from "./util";

const context = (playerID = "0"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const playSpecial = (treasure: Treasure) => {
    const G = game();
    G.powers.ottoman.cardPlayed = true;
    G.powers.ottoman.treasures = [treasure];
    expect(playTreasure(G, context(), {index: 0})).toBeUndefined();
    return G;
};

describe("rule 11 special treasures", () => {
    it("uses the official 30-counter distribution", () => {
        expect(TREASURE_TABLE).toHaveLength(30);
        const counts = TREASURE_TABLE.reduce<Record<string, number>>((acc, t) => {
            const key = String(t);
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
        }, {});
        expect(counts).toMatchObject({1: 5, 2: 8, 3: 7, 4: 5, 5: 1,
            drawCard: 2, scienceBonus: 1, vp: 1});
    });

    it("puts a 1 VP treasure in the Bonus VP box without granting CP", () => {
        const G = playSpecial("vp");
        expect(G.powers.ottoman.bonusVp).toBe(1);
        expect(G.powers.ottoman.cp).toBe(0);
        expect(G.powers.ottoman.treasurePlayed).toBe(true);
        expect(G.powers.ottoman.treasures).toEqual([]);
    });

    it("draws a card for a Draw Card treasure and holds it", () => {
        const G = playSpecial("drawCard");
        expect(G.powers.ottoman.cp).toBe(0);
        expect(G.powers.ottoman.cards).toHaveLength(1);
        expect(G.powers.ottoman.treasurePlayed).toBe(true);
    });

    it("opens a science-bonus choice and claims the selected bonus", () => {
        const G = playSpecial("scienceBonus");
        expect(G.pendingScienceTreasure).toEqual({power: "ottoman"});
        expect(G.powers.ottoman.scienceBonuses).toEqual([]);
        const bonus = eligibleScienceBonuses(G, "ottoman")[0];
        expect(bonus).toBeDefined();

        expect(chooseScienceTreasureBonus(G, context(), {bonus: bonus.id})).toBeUndefined();
        expect(G.pendingScienceTreasure).toBeUndefined();
        expect(G.powers.ottoman.scienceBonuses).toEqual([bonus.id]);
        expect(G.scienceBonusesAvailable).not.toContain(bonus.id);
    });

    it("rejects a bonus that is not available or not eligible", () => {
        const G = playSpecial("scienceBonus");
        expect(chooseScienceTreasureBonus(G, context(), {bonus: "not-a-bonus"})).toBe(INVALID_MOVE);
        expect(G.pendingScienceTreasure).toBeDefined();
    });
});
