import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {navalCount, VQGame} from "./constant/general";
import {SPACES} from "./mapData";
import {VirginQueenGameDef} from "./game";
import {chooseWinterLoss, chooseWinterNavalLoss, endPhaseTurn} from "./moves";
import {moveError} from "./movePolicy";
import {setupGame, winter} from "./util";

const context = (player = "4", phase = "cardDraw"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

/** A game with no English land so land winter losses do not add their own choices. */
const game = (): VQGame => {
    const G = setupGame(context("4", "action"));
    for (const space of SPACES) {
        delete G.spaces[space.id].land.england;
    }
    return G;
};

const hreStack = {galley: 2, galleon: 1, racebuilt: 0, corsair: 0};

/**
 * The Holy Roman Empire starts the campaign without a port, so its Adriatic
 * squadron has nowhere to return to and is eliminated by rule 20.4.
 */
const navalLossGame = (): VQGame => {
    const G = game();
    G.activePower = "hre";
    G.seaZones.adriatic.naval.hre = {...hreStack};
    winter(G, context("4", "action"));
    return G;
};

/** England has a port, so its returning squadron creates no naval loss choice. */
const returnedNavalGame = (): VQGame => {
    const G = game();
    G.activePower = "england";
    G.seaZones.northSea.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
    winter(G, context("2", "action"));
    return G;
};

/**
 * England loses one regular to land attrition in London (overstacked
 * Portsmouth with London in unrest), which gives the same power a pending land
 * choice next to the synthetic naval one.
 */
const landAndNavalGame = (): VQGame => {
    const G = game();
    G.activePower = "england";
    G.spaces.portsmouth.land.england = {regular: 6, merc: 0, cav: 0};
    G.spaces.london.unrest = true;
    winter(G, context("2", "action"));
    G.winterNavalLossChoices = [{
        power: "england",
        zone: "northSea",
        amount: 1,
        removed: {galley: 0, galleon: 1, racebuilt: 0, corsair: 0},
    }];
    return G;
};

describe("winter no-port naval loss choice", () => {
    it("eliminates the whole squadron and records the automatic ship types", () => {
        const G = navalLossGame();

        expect(G.winterNavalLossChoices).toEqual([{
            power: "hre",
            zone: "adriatic",
            amount: 3,
            removed: {...hreStack},
        }]);
        // Rule 20.4: no port means the whole squadron is gone, not reduced.
        expect(navalCount(G.seaZones.adriatic.naval.hre)).toBe(0);
        expect(G.log.join("\n")).toContain("Holy Roman fleet in Adriatic Sea has no port to return to and is eliminated");
    });

    it("lets the owner confirm one lost ship type without restoring any ship", () => {
        const G = navalLossGame();
        const endStage = jest.fn();

        expect(chooseWinterNavalLoss(G, {...context(), events: {endStage}} as unknown as Ctx,
            {zone: "adriatic", kind: "galleon"})).toBeUndefined();

        expect(G.winterNavalLossChoices).toBeUndefined();
        // The confirmation is bookkeeping only; the eliminated fleet stays gone.
        expect(navalCount(G.seaZones.adriatic.naval.hre)).toBe(0);
        expect(endStage).toHaveBeenCalledTimes(1);
        expect(G.log.join("\n")).toContain("records 1 galleon unit(s) lost in Adriatic Sea with no winter port");
    });

    it("keeps the automatic composition when the owner confirms it", () => {
        const G = navalLossGame();
        const endStage = jest.fn();

        expect(chooseWinterNavalLoss(G, {...context(), events: {endStage}} as unknown as Ctx,
            {zone: "adriatic", kind: "auto"})).toBeUndefined();

        expect(G.winterNavalLossChoices).toBeUndefined();
        expect(navalCount(G.seaZones.adriatic.naval.hre)).toBe(0);
        expect(G.log.join("\n")).toContain("keeps the automatic winter naval losses in Adriatic Sea");
    });

    it("rejects a ship type the eliminated squadron did not contain", () => {
        const G = navalLossGame();
        const remaining = G.winterNavalLossChoices;

        expect(chooseWinterNavalLoss(G, context(), {zone: "adriatic", kind: "corsair"})).toBe(INVALID_MOVE);
        expect(G.winterNavalLossChoices).toEqual(remaining);
    });

    it("rejects a choice made by a different power or outside Card Draw", () => {
        const G = navalLossGame();

        expect(chooseWinterNavalLoss(G, context("0"), {zone: "adriatic", kind: "auto"})).toBe(INVALID_MOVE);
        expect(G.winterNavalLossChoices).toHaveLength(1);
        expect(chooseWinterNavalLoss(G, context("4", "action"), {zone: "adriatic", kind: "auto"})).toBe(INVALID_MOVE);
        expect(G.winterNavalLossChoices).toHaveLength(1);
    });

    it("blocks unrelated moves while a naval loss is pending", () => {
        const G = navalLossGame();

        expect(moveError(G, "claimSeaCaptain")).toBeDefined();
        expect(moveError(G, "chooseWinterNavalLoss")).toBeUndefined();
        expect(moveError(G, "endPhaseTurn")).toBeUndefined();
    });

    it("falls back to the automatic composition when the Card Draw turn ends", () => {
        const G = navalLossGame();
        const endTurn = jest.fn();

        expect(endPhaseTurn(G, {...context(), events: {endTurn}} as unknown as Ctx)).toBeUndefined();

        expect(G.winterNavalLossChoices).toBeUndefined();
        expect(navalCount(G.seaZones.adriatic.naval.hre)).toBe(0);
        expect(endTurn).toHaveBeenCalledTimes(1);
        expect(G.log.join("\n")).toContain("keeps the automatic winter naval loss composition");
    });

    it("resolves several no-port squadrons one at a time", () => {
        const G = game();
        G.activePower = "hre";
        G.seaZones.adriatic.naval.hre = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
        G.seaZones.tyrrhenian.naval.hre = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        winter(G, context("4", "action"));
        const endStage = jest.fn();

        expect(G.winterNavalLossChoices).toHaveLength(2);
        expect(chooseWinterNavalLoss(G, {...context(), events: {endStage}} as unknown as Ctx,
            {zone: "adriatic", kind: "auto"})).toBeUndefined();
        expect(endStage).not.toHaveBeenCalled();
        expect(chooseWinterNavalLoss(G, {...context(), events: {endStage}} as unknown as Ctx,
            {zone: "tyrrhenian", kind: "galleon"})).toBeUndefined();
        expect(endStage).toHaveBeenCalledTimes(1);
        expect(G.winterNavalLossChoices).toBeUndefined();
        expect(navalCount(G.seaZones.adriatic.naval.hre)).toBe(0);
        expect(navalCount(G.seaZones.tyrrhenian.naval.hre)).toBe(0);
    });

    it("keeps a power in the winter-loss stage until its land and naval choices are both confirmed", () => {
        const G = landAndNavalGame();
        const endStage = jest.fn();

        expect(G.winterLossChoices).toHaveLength(1);
        expect(chooseWinterLoss(G, {...context("2"), events: {endStage}} as unknown as Ctx,
            {space: "london", kind: "auto"})).toBeUndefined();
        expect(endStage).not.toHaveBeenCalled();
        expect(chooseWinterNavalLoss(G, {...context("2"), events: {endStage}} as unknown as Ctx,
            {zone: "northSea", kind: "auto"})).toBeUndefined();
        expect(endStage).toHaveBeenCalledTimes(1);
    });

    it("opens the Card Draw winter-loss stage for a pending naval choice", () => {
        const turnBegin = VirginQueenGameDef.phases!.cardDraw!.turn!.onBegin as (G: VQGame, ctx: Ctx) => void;
        const G = navalLossGame();
        const setActivePlayers = jest.fn();

        turnBegin(G, {...context(), events: {setActivePlayers}} as unknown as Ctx);

        expect(setActivePlayers).toHaveBeenCalledWith({value: {"4": "winterLossChoice"}});
    });

    it("records no naval choice when the squadron returns to a port", () => {
        const G = returnedNavalGame();

        expect(G.winterNavalLossChoices).toBeUndefined();
        expect(navalCount(G.seaZones.northSea.naval.england)).toBe(0);
        expect(G.log.join("\n")).toContain("fleet returns from North Sea to London");
    });

    it("clears any naval choice left over before Diplomacy begins", () => {
        const G = navalLossGame();
        const onBegin = VirginQueenGameDef.phases!.diplomacy!.onBegin as (G: VQGame) => void;

        onBegin(G);

        expect(G.winterNavalLossChoices).toBeUndefined();
    });

    it("clears any naval choice left over before Spring begins", () => {
        const G = navalLossGame();
        const onBegin = VirginQueenGameDef.phases!.spring!.onBegin as (G: VQGame, ctx: Ctx) => void;

        onBegin(G, context("4", "spring"));

        expect(G.winterNavalLossChoices).toBeUndefined();
    });
});
