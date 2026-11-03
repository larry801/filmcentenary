import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {battleOptions, chooseBattle, startBattle} from "./combat";
import {setupGame} from "./util";

const context = (playerID: string): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context("0"), phase: "action"} as Ctx);

describe("Flooding (card #39)", () => {
    it("is not offered outside the Netherlands", () => {
        const G = game();
        G.spaces.belgrade.control = "ottoman";
        G.spaces.belgrade.siege = {by: "france", sinceImpulse: 1};
        G.powers.ottoman.cards = ["vq-039"];
        startBattle(G, context("0"), "assault", "belgrade", "france", ["ottoman"], "paris");
        chooseBattle(G, context("3"), {choice: "done"});

        expect(battleOptions(G).some((option) => option.id === "card:vq-039")).toBe(false);
    });

    it("can be canceled by the attacker's Siege Engineering", () => {
        const G = game();
        G.spaces.brussels.control = "spain";
        G.spaces.brussels.siege = {by: "france", sinceImpulse: 1};
        G.spaces.brussels.land.spain = {regular: 1, merc: 0, cav: 0};
        G.spaces.brussels.land.france = {regular: 1, merc: 3, cav: 0};
        G.powers.spain.cards = ["vq-039"];
        G.powers.france.cards = ["vq-010"];

        startBattle(G, context("0"), "assault", "brussels", "france", ["spain"], "paris");
        chooseBattle(G, context("3"), {choice: "done"});
        expect(chooseBattle(G, context("1"), {choice: "card:vq-039"})).toBeUndefined();

        expect(G.spaces.brussels.siege).toBeDefined();
        expect(G.pendingBattle).toBeDefined();
        expect(G.powers.france.cards).not.toContain("vq-010");
    });

    it("lifts the siege and halves the attacker's mercenaries", () => {
        const G = game();
        G.spaces.brussels.control = "spain";
        G.spaces.brussels.siege = {by: "france", sinceImpulse: 1};
        G.spaces.brussels.land.spain = {regular: 1, merc: 0, cav: 0};
        G.spaces.brussels.land.france = {regular: 1, merc: 3, cav: 0};
        G.powers.spain.cards = ["vq-039"];

        startBattle(G, context("0"), "assault", "brussels", "france", ["spain"], "paris");
        chooseBattle(G, context("3"), {choice: "done"});
        expect(chooseBattle(G, context("1"), {choice: "card:vq-039"})).toBeUndefined();

        expect(G.spaces.brussels.siege).toBeUndefined();
        expect(G.spaces.brussels.land.france).toBeUndefined();
        expect(G.spaces.paris.land.france?.merc).toBe(1);
        expect(G.pendingBattle).toBeUndefined();
    });
});
