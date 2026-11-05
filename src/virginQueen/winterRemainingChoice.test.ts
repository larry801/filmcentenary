import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {SPACES} from "./mapData";
import {VirginQueenGameDef} from "./game";
import {chooseWinterLoss, endPhaseTurn} from "./moves";
import {moveError} from "./movePolicy";
import {setupGame, winter} from "./util";

const context = (player = "2", phase = "cardDraw"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

/**
 * A game whose only English land is the stack the test places, with every
 * English-controlled space handed to France so no friendly fortification (and
 * no capital) can receive it.
 */
const game = (): VQGame => {
    const G = setupGame(context("0", "action"));
    for (const space of SPACES) {
        delete G.spaces[space.id].land.england;
        if (G.spaces[space.id].control === "england") G.spaces[space.id].control = "france";
    }
    return G;
};

/**
 * Clermont is an open space, so rule 20.4 requires the stack to withdraw to a
 * friendly fortification; with none left, the whole army is eliminated.
 */
const isolatedGame = (units = {regular: 2, merc: 1, cav: 1}): VQGame => {
    const G = game();
    G.activePower = "england";
    G.spaces.clermont.land.england = {...units};
    winter(G, context("2", "action"));
    return G;
};

const englishChoices = (G: VQGame) =>
    (G.winterLossChoices ?? []).filter((entry) => entry.power === "england");

describe("winter no-quarters elimination choice", () => {
    it("records a confirmation choice for the whole eliminated stack", () => {
        const G = isolatedGame();

        expect(englishChoices(G)).toEqual([{
            power: "england",
            space: "clermont",
            amount: 4,
            removed: {regular: 2, merc: 1, cav: 1},
        }]);
        // Rule 20.4 already removed the entire army before the choice.
        expect(G.spaces.clermont.land.england).toBeUndefined();
        expect(G.log.join("\n")).toContain("英格兰 loses 4 unit(s) in Clermont: no winter quarters");
    });

    it("keeps the automatic composition when the owner confirms it", () => {
        const G = isolatedGame();
        const endStage = jest.fn();

        expect(chooseWinterLoss(G, {...context(), events: {endStage}} as unknown as Ctx,
            {space: "clermont", kind: "auto"})).toBeUndefined();

        expect(englishChoices(G)).toEqual([]);
        expect(G.spaces.clermont.land.england).toBeUndefined();
        expect(endStage).toHaveBeenCalledTimes(1);
        expect(G.log.join("\n")).toContain("keeps the automatic winter losses in Clermont");
    });

    it("rejects a unit-type swap because the stack is already gone", () => {
        const G = isolatedGame();
        const remaining = englishChoices(G);

        expect(chooseWinterLoss(G, context(), {space: "clermont", kind: "regular"})).toBe(INVALID_MOVE);
        expect(chooseWinterLoss(G, context(), {space: "clermont", kind: "cav"})).toBe(INVALID_MOVE);
        expect(englishChoices(G)).toEqual(remaining);
    });

    it("records a single eliminated unit too", () => {
        const G = isolatedGame({regular: 1, merc: 0, cav: 0});

        expect(englishChoices(G)).toEqual([{
            power: "england",
            space: "clermont",
            amount: 1,
            removed: {regular: 1, merc: 0, cav: 0},
        }]);
        expect(G.spaces.clermont.land.england).toBeUndefined();
    });

    it("rejects a choice from another power or outside Card Draw", () => {
        const G = isolatedGame();

        expect(chooseWinterLoss(G, context("0"), {space: "clermont", kind: "auto"})).toBe(INVALID_MOVE);
        expect(chooseWinterLoss(G, context("2", "action"), {space: "clermont", kind: "auto"})).toBe(INVALID_MOVE);
        expect(englishChoices(G)).toHaveLength(1);
    });

    it("blocks unrelated moves while the confirmation is pending", () => {
        const G = isolatedGame();

        expect(moveError(G, "claimSeaCaptain")).toBeDefined();
        expect(moveError(G, "chooseWinterLoss")).toBeUndefined();
        expect(moveError(G, "endPhaseTurn")).toBeUndefined();
    });

    it("falls back to the automatic composition when the Card Draw turn ends", () => {
        const G = isolatedGame();
        const endTurn = jest.fn();

        expect(endPhaseTurn(G, {...context(), events: {endTurn}} as unknown as Ctx)).toBeUndefined();

        expect(englishChoices(G)).toEqual([]);
        expect(G.spaces.clermont.land.england).toBeUndefined();
        expect(endTurn).toHaveBeenCalledTimes(1);
        expect(G.log.join("\n")).toContain("英格兰 keeps the automatic winter loss composition");
    });

    it("opens the Card Draw winter-loss stage for the owning player only", () => {
        const turnBegin = VirginQueenGameDef.phases!.cardDraw!.turn!.onBegin as (G: VQGame, ctx: Ctx) => void;
        const G = isolatedGame();
        const setActivePlayers = jest.fn();

        turnBegin(G, {...context(), events: {setActivePlayers}} as unknown as Ctx);

        expect(setActivePlayers).toHaveBeenCalledWith({value: {"2": "winterLossChoice"}});
    });

    it("clears the pending confirmation before Diplomacy begins", () => {
        const G = isolatedGame();
        const onBegin = VirginQueenGameDef.phases!.diplomacy!.onBegin as (G: VQGame) => void;

        onBegin(G);

        expect(G.winterLossChoices).toBeUndefined();
    });
});
