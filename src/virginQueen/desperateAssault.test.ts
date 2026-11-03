import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {chooseBattle, startBattle} from "./combat";
import {assault} from "./moves";
import {setupGame} from "./util";

const context = (playerID: string): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const defenseDice = (withCard: boolean): number => {
    const G = setupGame({...context("0"), phase: "action"} as Ctx);
    G.spaces.rotterdam.control = "spain";
    G.spaces.rotterdam.land.spain = {regular: 2, merc: 0, cav: 0};
    G.spaces.rotterdam.land.france = {regular: 4, merc: 0, cav: 0};
    if (withCard) G.powers.france.cards = ["vq-007"];
    startBattle(G, context("0"), "assault", "rotterdam", "france", ["spain"], "rotterdam");
    if (withCard) chooseBattle(G, context("3"), {choice: "card:vq-007"});
    chooseBattle(G, context("3"), {choice: "done"});
    chooseBattle(G, context("1"), {choice: "done"});
    return G.pendingBattle!.rolls!.defender.length;
};

describe("Desperate Assault (card #7)", () => {
    it("makes automatic assault hits on 4-6", () => {
        const hits = (withCard: boolean): number => {
            const four = {...context("3"), random: {Die: () => 4, Shuffle: (cards: unknown[]) => cards}} as Ctx;
            const G = setupGame({...four, phase: "action"} as Ctx);
            G.impulse = 2;
            G.spaces.ghent.control = "spain";
            G.spaces.ghent.siege = {by: "france", sinceImpulse: 1};
            G.spaces.ghent.land.spain = {regular: 1, merc: 0, cav: 0};
            G.spaces.ghent.land.france = {regular: 6, merc: 0, cav: 0};
            G.spaces.brussels.control = "france";
            G.spaces.brussels.unrest = false;
            G.powers.spain.cards = [];
            G.powers.france.cp = 10;
            if (withCard) G.powers.france.cards = ["vq-007"];
            assault(G, four, {space: "ghent"});
            return Number(G.lastRolls.match(/Assault on Ghent: (\d+) hits/)?.[1] ?? 0);
        };
        expect(hits(true)).toBeGreaterThan(hits(false));
    });

    it("is applied automatically in a campaign assault", () => {
        const G = setupGame({...context("3"), phase: "action"} as Ctx);
        G.impulse = 2;
        G.spaces.ghent.control = "spain";
        G.spaces.ghent.siege = {by: "france", sinceImpulse: 1};
        G.spaces.ghent.land.spain = {regular: 1, merc: 0, cav: 0};
        G.spaces.ghent.land.france = {regular: 6, merc: 0, cav: 0};
        G.spaces.brussels.control = "france";
        G.spaces.brussels.unrest = false;
        G.powers.spain.cards = [];
        G.powers.france.cp = 10;
        G.powers.france.cards = ["vq-007"];

        expect(assault(G, context("3"), {space: "ghent"})).toBeUndefined();

        expect(G.log.join("\n")).toContain("Desperate Assault");
        expect(G.powers.france.cards).not.toContain("vq-007");
    });

    it("doubles defender dice", () => {
        expect(defenseDice(true)).toBe(defenseDice(false) * 2);
    });
});
