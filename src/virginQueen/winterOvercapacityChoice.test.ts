import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {landCount, VQGame} from "./constant/general";
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

/** A game whose only English land is the stack the test places. */
const game = (): VQGame => {
    const G = setupGame(context("0", "action"));
    for (const space of SPACES) {
        delete G.spaces[space.id].land.england;
    }
    return G;
};

/**
 * Overstacked Portsmouth with London under enemy control: the excess has no
 * home capital to return to, so the engine destroys it.  The automatic removal
 * takes the two mercenaries, leaving two regulars and two cavalry behind.
 */
const noCapitalGame = (): VQGame => {
    const G = game();
    G.activePower = "england";
    G.spaces.portsmouth.land.england = {regular: 2, merc: 2, cav: 2};
    G.spaces.london.control = "france";
    winter(G, context("2", "action"));
    return G;
};

describe("winter overcapacity choice (no capital)", () => {
    it("records a pending choice for the destroyed excess instead of resolving silently", () => {
        const G = noCapitalGame();

        expect(G.winterLossChoices).toEqual([{
            power: "england",
            space: "portsmouth",
            amount: 2,
            removed: {regular: 0, merc: 2, cav: 0},
        }]);
        // The automatic loss is already applied: four units remain.
        expect(G.spaces.portsmouth.land.england).toEqual({regular: 2, merc: 0, cav: 2});
        expect(landCount(G.spaces.portsmouth.land.england)).toBe(4);
        expect(G.log.join("\n")).toContain("has no capital and loses 2 overstacked unit(s) in Portsmouth");
    });

    it("swaps the destroyed units for the type chosen by the owner", () => {
        const G = noCapitalGame();
        const endStage = jest.fn();

        expect(chooseWinterLoss(G, {...context(), events: {endStage}} as unknown as Ctx,
            {space: "portsmouth", kind: "cav"})).toBeUndefined();

        // The automatically removed mercenaries return; two cavalry are removed.
        expect(G.spaces.portsmouth.land.england).toEqual({regular: 2, merc: 2, cav: 0});
        expect(G.winterLossChoices).toBeUndefined();
        expect(endStage).toHaveBeenCalledTimes(1);
        expect(G.log.join("\n")).toContain("loses 2 cavalry unit(s) in Portsmouth to winter attrition");
    });

    it("keeps the automatic composition when the owner confirms it", () => {
        const G = noCapitalGame();
        const before = {...G.spaces.portsmouth.land.england!};
        const endStage = jest.fn();

        expect(chooseWinterLoss(G, {...context(), events: {endStage}} as unknown as Ctx,
            {space: "portsmouth", kind: "auto"})).toBeUndefined();

        expect(G.spaces.portsmouth.land.england).toEqual(before);
        expect(G.winterLossChoices).toBeUndefined();
        expect(endStage).toHaveBeenCalledTimes(1);
        expect(G.log.join("\n")).toContain("keeps the automatic winter losses in Portsmouth");
    });

    it("rejects a type the surviving stack cannot supply and keeps the choice pending", () => {
        const G = noCapitalGame();
        const remaining = G.winterLossChoices;

        expect(chooseWinterLoss(G, context(), {space: "portsmouth", kind: "merc"})).toBe(INVALID_MOVE);
        expect(G.winterLossChoices).toEqual(remaining);
        expect(moveError(G, "claimSeaCaptain")).toBeDefined();
        expect(moveError(G, "chooseWinterLoss")).toBeUndefined();
    });

    it("falls back to the automatic composition when the Card Draw turn ends", () => {
        const G = noCapitalGame();
        const before = {...G.spaces.portsmouth.land.england!};
        const endTurn = jest.fn();

        expect(endPhaseTurn(G, {...context(), events: {endTurn}} as unknown as Ctx)).toBeUndefined();

        expect(G.spaces.portsmouth.land.england).toEqual(before);
        expect(G.winterLossChoices).toBeUndefined();
        expect(endTurn).toHaveBeenCalledTimes(1);
    });

    it("opens the Card Draw winter-loss stage for the owning player only", () => {
        const turnBegin = VirginQueenGameDef.phases!.cardDraw!.turn!.onBegin as (G: VQGame, ctx: Ctx) => void;
        const G = noCapitalGame();
        const setActivePlayers = jest.fn();

        turnBegin(G, {...context(), events: {setActivePlayers}} as unknown as Ctx);

        expect(setActivePlayers).toHaveBeenCalledWith({value: {"2": "winterLossChoice"}});
    });

    it("discards the pending choice before Diplomacy begins", () => {
        const G = noCapitalGame();
        const onBegin = VirginQueenGameDef.phases!.diplomacy!.onBegin as (G: VQGame) => void;

        onBegin(G);

        expect(G.winterLossChoices).toBeUndefined();
    });

    it("records no overcapacity choice when a capital can receive the excess", () => {
        const G = game();
        G.activePower = "england";
        G.spaces.portsmouth.land.england = {regular: 6, merc: 0, cav: 0};

        winter(G, context("2", "action"));

        // Friendly London receives the two excess regulars without attrition.
        expect(G.spaces.portsmouth.land.england).toEqual({regular: 4, merc: 0, cav: 0});
        expect(G.winterLossChoices).toBeUndefined();
    });
});
