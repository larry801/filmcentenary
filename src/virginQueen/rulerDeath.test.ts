import {Ctx} from "boardgame.io";
import {Power, RoyalDef, VQGame} from "./constant/general";
import {resolveMarriages, rulerStats, setupGame} from "./util";

const context = (values: number[]): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context([]), phase: "action"} as Ctx);

const royal = (id: string, power: Power, gender: "male" | "female", eligibility = 0): RoyalDef => ({
    id, name: id, power, gender, eligibility, alive: true, married: false, status: "available",
});

const pair = (G: VQGame, male: RoyalDef, female: RoyalDef, values: number[]): void => {
    G.royals = G.royals.filter((r) => r.id !== male.id && r.id !== female.id);
    G.royals.push(male, female);
    G.betrothals = [{male: male.id, female: female.id}];
    resolveMarriages(G, context(values));
};

describe("ruler death effects (section 23)", () => {
    it("drops Spain to 0 card bonus and 1 Admin if Philip II dies", () => {
        const G = game();
        G.royals.find((r) => r.id === "philip")!.alive = false;
        expect(rulerStats(G, "spain")).toEqual({cardBonus: 0, admin: 1});
    });

    it("removes Henry III's army leader and drops France to 0/1", () => {
        const G = game();
        pair(G, royal("henryIII", "france", "male"), royal("f1", "england", "female"), [3, 3]);

        expect(G.leaders.henryIII).toBeUndefined();
        expect(rulerStats(G, "france")).toEqual({cardBonus: 0, admin: 1});
    });

    it("applies Elizabeth I's death effects", () => {
        const G = game();
        G.powers.england.cards.push("vq-036");
        pair(G, royal("m2", "spain", "male"), royal("elizabeth", "england", "female"), [4, 3]);

        expect(G.powers.england.ruler).toBe("elizabethDead");
        expect(G.powers.england.cards).not.toContain("vq-036");
        expect(G.removed).toContain("vq-036");
        expect(rulerStats(G, "england")).toEqual({cardBonus: 0, admin: 1});
    });

    it("kills Mary Queen of Scots when she dies in childbirth", () => {
        const G = game();
        pair(G, royal("m3", "spain", "male"), royal("maryScots", "france", "female"), [4, 3]);

        const mary = G.royals.find((r) => r.id === "maryScots")!;
        expect(mary.status).toBe("dead");
        expect(mary.alive).toBe(false);
    });

    it("drops the Holy Roman Empire to 0/1 if Rudolf II is murdered", () => {
        const G = game();
        pair(G, royal("rudolf", "hre", "male"), royal("f4", "france", "female"), [3, 3]);

        expect(rulerStats(G, "hre")).toEqual({cardBonus: 0, admin: 1});
    });
});
