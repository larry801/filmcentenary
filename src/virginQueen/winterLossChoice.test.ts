import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {landCount, POWERS, VQGame} from "./constant/general";
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

const englishLand = (G: VQGame): number =>
    SPACES.reduce((total, space) => total + landCount(G.spaces[space.id].land.england), 0);

/**
 * Overstacked Portsmouth (6 regulars) with an unrest marker on London: the
 * two excess regulars move home, half are lost, and London has no replacement
 * because it is in unrest.  The surviving regular is the only English unit.
 */
const attritionGame = (): VQGame => {
    const G = game();
    G.activePower = "england";
    G.spaces.portsmouth.land.england = {regular: 6, merc: 0, cav: 0};
    G.spaces.london.unrest = true;
    winter(G, context("2", "action"));
    return G;
};

describe("winter loss unit-type choice", () => {
    it("records a pending choice instead of only applying the automatic removal", () => {
        const G = attritionGame();

        expect(G.winterLossChoices).toEqual([{
            power: "england",
            space: "london",
            amount: 1,
            removed: {regular: 1, merc: 0, cav: 0},
        }]);
        // The automatic loss is already applied: one survivor in London.
        expect(G.spaces.london.land.england).toEqual({regular: 1, merc: 0, cav: 0});
        expect(G.spaces.portsmouth.land.england).toEqual({regular: 4, merc: 0, cav: 0});
        expect(englishLand(G)).toBe(5);
        expect(G.log.join("\n")).toContain("1 lost to winter attrition");
    });

    it("swaps the removed units for the type chosen by the owner", () => {
        const G = attritionGame();
        const entry = G.winterLossChoices![0];
        // Give London a mercenary so the owner can choose to lose it instead.
        G.spaces.london.land.england!.merc += 1;
        const before = {...G.spaces.london.land.england!};
        const endStage = jest.fn();

        expect(chooseWinterLoss(G, {...context(), events: {endStage}} as unknown as Ctx,
            {space: "london", kind: "merc"})).toBeUndefined();

        const after = G.spaces.london.land.england!;
        // The automatically removed regular returns; the mercenary is removed.
        expect(after.regular).toBe(before.regular + entry.removed.regular);
        expect(after.merc).toBe(before.merc + entry.removed.merc - entry.amount);
        expect(after.cav).toBe(before.cav + entry.removed.cav);
        expect(landCount(after)).toBe(landCount(before));
        expect(G.winterLossChoices).toBeUndefined();
        expect(endStage).toHaveBeenCalledTimes(1);
        expect(G.log.join("\n")).toContain("loses 1 mercenary unit(s) in London to winter attrition");
    });

    it("keeps the automatic composition when the owner confirms it", () => {
        const G = attritionGame();
        const before = {...G.spaces.london.land.england!};
        const endStage = jest.fn();

        expect(chooseWinterLoss(G, {...context(), events: {endStage}} as unknown as Ctx,
            {space: "london", kind: "auto"})).toBeUndefined();

        expect(G.spaces.london.land.england).toEqual(before);
        expect(G.winterLossChoices).toBeUndefined();
        expect(endStage).toHaveBeenCalledTimes(1);
        expect(G.log.join("\n")).toContain("keeps the automatic winter losses");
    });

    it("rejects a type the surviving stack cannot supply and prevents unrelated moves", () => {
        const G = attritionGame();
        const remaining = G.winterLossChoices;

        expect(chooseWinterLoss(G, context(), {space: "london", kind: "merc"})).toBe(INVALID_MOVE);
        expect(G.winterLossChoices).toEqual(remaining);
        expect(moveError(G, "claimSeaCaptain")).toBeDefined();
        expect(moveError(G, "chooseWinterLoss")).toBeUndefined();
        expect(moveError(G, "endPhaseTurn")).toBeUndefined();
    });

    it("rejects a choice made by a different power", () => {
        const G = attritionGame();

        expect(chooseWinterLoss(G, context("0"), {space: "london", kind: "auto"})).toBe(INVALID_MOVE);
        expect(G.winterLossChoices).toHaveLength(1);
    });

    it("falls back to the automatic composition when the Card Draw turn ends", () => {
        const G = attritionGame();
        const before = {...G.spaces.london.land.england!};
        const endTurn = jest.fn();

        expect(endPhaseTurn(G, {...context(), events: {endTurn}} as unknown as Ctx)).toBeUndefined();

        expect(G.spaces.london.land.england).toEqual(before);
        expect(G.winterLossChoices).toBeUndefined();
        expect(endTurn).toHaveBeenCalledTimes(1);
    });

    it("records no choice when every unit in the stack is lost", () => {
        const G = game();
        G.spaces.clermont.land.england = {regular: 1, merc: 0, cav: 0};

        winter(G, context("2", "action"));

        // One unit cannot survive half-losses, so there is no type decision.
        expect(G.spaces.clermont.land.england).toBeUndefined();
        expect(G.winterLossChoices).toBeUndefined();
    });

    it("opens the Card Draw winter-loss stage for the owning player only", () => {
        const turnBegin = VirginQueenGameDef.phases!.cardDraw!.turn!.onBegin as (G: VQGame, ctx: Ctx) => void;
        const G = attritionGame();
        const setActivePlayers = jest.fn();

        turnBegin(G, {...context(), events: {setActivePlayers}} as unknown as Ctx);

        expect(setActivePlayers).toHaveBeenCalledWith({value: {"2": "winterLossChoice"}});

        G.winterLossChoices = [];
        const noPending = jest.fn();
        turnBegin(G, {...context(), events: {setActivePlayers: noPending}} as unknown as Ctx);
        expect(noPending).not.toHaveBeenCalled();
    });

    it("clears any choice left over before Diplomacy begins", () => {
        const G = attritionGame();
        const onBegin = VirginQueenGameDef.phases!.diplomacy!.onBegin as (G: VQGame) => void;

        onBegin(G);

        expect(G.winterLossChoices).toBeUndefined();
        expect(POWERS).toContain(G.activePower);
    });
});
