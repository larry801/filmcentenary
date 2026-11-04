import {Ctx} from "boardgame.io";
import {LandStack, VQGame} from "./constant/general";
import {assaultSpace, setupGame} from "./util";

const context = (die = 2): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => die, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const prepare = (G: VQGame, attackers: LandStack, defenders?: LandStack): void => {
    G.impulse = 2;
    G.spaces.ghent.control = "spain";
    G.spaces.ghent.siege = {by: "france", sinceImpulse: 1};
    G.spaces.ghent.land = {france: attackers};
    if (defenders !== undefined) G.spaces.ghent.land.spain = defenders;
    G.spaces.ghent.leaders = [];
    G.powers.france.cards = [];
    G.powers.spain.cards = [];
    if (!G.powers.france.wars.includes("spain")) G.powers.france.wars.push("spain");
    if (!G.powers.spain.wars.includes("france")) G.powers.spain.wars.push("france");
};

const diceCounts = (G: VQGame): number[] =>
    [...G.lastRolls.matchAll(/\((\d+) dice\)/g)].map((match) => Number(match[1]));

describe("assault dice ignore cavalry (rule 15.1)", () => {
    it("counts only non-cavalry attackers, and non-cavalry defenders", () => {
        const G = game();
        prepare(G,
            {regular: 4, merc: 0, cav: 4},
            {regular: 1, merc: 0, cav: 3});

        // 4 regulars halve to 2 dice; 1 defending regular + the defender bonus = 2.
        expect(assaultSpace(G, context(), "france", "ghent")).toBe(false);
        expect(diceCounts(G)).toEqual([2, 2]);
    });

    it("counts one die per non-cavalry unit against an empty fortress", () => {
        const G = game();
        prepare(G, {regular: 4, merc: 0, cav: 4});

        // 4 regulars (not 8 units) + no leader; the empty fortress rolls 1 die.
        expect(assaultSpace(G, context(), "france", "ghent")).toBe(false);
        expect(diceCounts(G)).toEqual([4, 1]);
    });
});
