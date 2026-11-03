import {Ctx} from "boardgame.io";
import {Power, RoyalDef, VQGame} from "./constant/general";
import {resolveMarriages, setupGame} from "./util";

const context = (values: number[]): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context([]), numPlayers: 6} as Ctx);

const royal = (id: string, power: Power, gender: "male" | "female", eligibility: number): RoyalDef => ({
    id, name: id, power, gender, eligibility, alive: true, married: false, status: "available",
});

const pair = (G: VQGame, male: RoyalDef, female: RoyalDef): void => {
    G.royals.push(male, female);
    G.betrothals = [{male: male.id, female: female.id}];
};

describe("Royal Wedding Table (rule 21.1)", () => {
    it("awards 2 VP to each power on 15+", () => {
        const G = game();
        const male = royal("m1", "spain", "male", 3);
        const female = royal("f1", "england", "female", 5);
        pair(G, male, female);
        const spain = G.powers.spain.bonusVp;
        const england = G.powers.england.bonusVp;

        resolveMarriages(G, context([6, 6]));

        expect(G.powers.spain.bonusVp).toBe(spain + 2);
        expect(G.powers.england.bonusVp).toBe(england + 2);
        expect(male.married).toBe(true);
        expect(female.married).toBe(true);
    });

    it("awards 1 VP and a +1 Card marker on 14", () => {
        const G = game();
        const male = royal("m2", "spain", "male", 1);
        const female = royal("f2", "england", "female", 1);
        pair(G, male, female);

        resolveMarriages(G, context([6, 6]));

        expect(G.powers.spain.marriageCardModifier).toBe(1);
        expect(G.powers.england.marriageCardModifier).toBe(1);
    });

    it("awards a +1 Card marker without VP on 12", () => {
        const G = game();
        const male = royal("m3", "spain", "male", 0);
        const female = royal("f3", "england", "female", 0);
        pair(G, male, female);
        const vp = G.powers.spain.bonusVp;

        resolveMarriages(G, context([6, 6]));

        expect(G.powers.spain.bonusVp).toBe(vp);
        expect(G.powers.spain.marriageCardModifier).toBe(1);
    });

    it("returns both royals to the pool on 9", () => {
        const G = game();
        const male = royal("m4", "spain", "male", 0);
        const female = royal("f4", "england", "female", 0);
        pair(G, male, female);

        resolveMarriages(G, context([5, 4]));

        expect(male.married).toBe(false);
        expect(female.married).toBe(false);
        expect(G.marriages).toBe(0);
    });

    it("applies -1 Card markers on 8", () => {
        const G = game();
        const male = royal("m5", "spain", "male", 0);
        const female = royal("f5", "england", "female", 0);
        pair(G, male, female);

        resolveMarriages(G, context([4, 4]));

        expect(G.powers.spain.marriageCardModifier).toBe(-1);
        expect(G.powers.england.marriageCardModifier).toBe(-1);
    });

    it("kills the wife on 7 and the husband on 6 or less", () => {
        const wifeGame = game();
        const husband = royal("m6", "spain", "male", 0);
        const wife = royal("f6", "england", "female", 0);
        pair(wifeGame, husband, wife);
        resolveMarriages(wifeGame, context([4, 3]));
        expect(wife.alive).toBe(false);
        expect(husband.married).toBe(true);

        const husbandGame = game();
        const murdered = royal("m7", "spain", "male", 0);
        const widow = royal("f7", "england", "female", 0);
        pair(husbandGame, murdered, widow);
        resolveMarriages(husbandGame, context([3, 3]));
        expect(murdered.alive).toBe(false);
        expect(widow.married).toBe(true);
    });

    it("uses only the higher rating when both royals are from the same power", () => {
        const G = game();
        const male = royal("m8", "spain", "male", 1);
        const female = royal("f8", "spain", "female", 5);
        pair(G, male, female);
        const vpBefore = G.powers.spain.bonusVp;

        resolveMarriages(G, context([4, 3]));

        // 4+3+max(1,5) = 12 -> +1 Card marker, not 13 (which would award VP).
        expect(G.powers.spain.marriageCardModifier).toBe(1);
        expect(G.powers.spain.bonusVp).toBe(vpBefore);
        expect(G.marriages).toBe(1);
    });
});
