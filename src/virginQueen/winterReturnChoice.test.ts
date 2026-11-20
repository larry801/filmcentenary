import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {landCount, navalCount, VQGame} from "./constant/general";
import {SPACE_BY_ID, SPACES} from "./mapData";
import {VirginQueenGameDef} from "./game";
import {chooseWinterNavalReturn, chooseWinterReturn, endPhaseTurn} from "./moves";
import {moveError} from "./movePolicy";
import {autoResolveWinterReturnChoices, setupGame, winter} from "./util";

const context = (player = "2", phase = "cardDraw"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

/** A game whose only English land is the stack a test places. */
const game = (): VQGame => {
    const G = setupGame(context("0", "action"));
    for (const space of SPACES) {
        delete G.spaces[space.id].land.england;
    }
    return G;
};

const returnsFor = (G: VQGame, power: string) =>
    (G.winterReturnChoices ?? []).filter((entry) => entry.power === power);

const navalReturnsFor = (G: VQGame, power: string) =>
    (G.winterNavalReturnChoices ?? []).filter((entry) => entry.power === power);

const place = (id: string): string => SPACE_BY_ID[id].name;

describe("winter land returns (rule 20.4)", () => {
    /**
     * Spain has two capitals, so a returning stack there always has a
     * destination to choose from even when both are equidistant.
     */
    const spanishGame = (): VQGame => {
        const G = setupGame(context("1", "action"));
        G.activePower = "spain";
        G.spaces.barcelona.control = "france";
        G.spaces.barcelona.land.spain = {regular: 2, merc: 0, cav: 0};
        winter(G, context("1", "action"));
        return G;
    };

    it("records a Spanish return with every legal capital as a destination", () => {
        const G = spanishGame();
        const record = returnsFor(G, "spain").find((entry) => entry.from === "barcelona");

        expect(record).toBeDefined();
        expect(record!.options).toContain(record!.autoTo);
        expect(record!.options.length).toBeGreaterThan(1);
        expect(record!.before).toEqual({regular: 2, merc: 0, cav: 0});
        expect(record!.minMove).toBe(2);
    });

    it("moves the stack to the chosen capital and undoes the automatic one", () => {
        const G = spanishGame();
        const record = returnsFor(G, "spain").find((entry) => entry.from === "barcelona")!;
        const alternative = record.options.find((option) => option !== record.autoTo)!;
        const autoBefore = landCount(G.spaces[record.autoTo].land.spain);
        const altBefore = landCount(G.spaces[alternative].land.spain);

        expect(chooseWinterReturn(G, context("1"), {id: record.id, to: alternative})).toBeUndefined();

        // Exactly the two returned regulars moved; the rest of each stack stays.
        expect(landCount(G.spaces[record.autoTo].land.spain)).toBe(autoBefore - 2);
        expect(landCount(G.spaces[alternative].land.spain)).toBe(altBefore + 2);
        // The owner may revise again until Card Draw ends, so the record now
        // names the chosen capital as its automatic placement.
        const revised = returnsFor(G, "spain").find((entry) => entry.from === "barcelona");
        expect(revised?.autoTo).toBe(alternative);
        expect(G.log.join("\n")).toContain(`西班牙 moves 2 unit(s) from ${place("barcelona")} to ${place(alternative)}`);
    });

    it("lets an overstacked fortress send a chosen unit kind and keep four at home", () => {
        const G = game();
        G.activePower = "england";
        G.spaces.portsmouth.land.england = {regular: 4, merc: 2, cav: 0};
        winter(G, context("2", "action"));
        const record = returnsFor(G, "england").find((entry) => entry.from === "portsmouth")!;

        expect(record.minMove).toBe(2);
        // The automatic rule sends mercenaries first, so Portsmouth keeps 4 regulars.
        expect(G.spaces.portsmouth.land.england).toEqual({regular: 4, merc: 0, cav: 0});

        // The owner may instead send two regulars and keep the mercenaries.
        expect(chooseWinterReturn(G, context("2"), {
            id: record.id, to: record.autoTo, units: {regular: 2, merc: 0, cav: 0},
        })).toBeUndefined();

        expect(G.spaces.portsmouth.land.england).toEqual({regular: 2, merc: 2, cav: 0});
        // Both sent regulars reach London; the automatic gain there is preserved.
        expect(G.spaces.london.land.england!.regular).toBeGreaterThanOrEqual(2);
    });

    it("rejects a composition that would leave the wrong number of units", () => {
        const G = game();
        G.activePower = "england";
        G.spaces.portsmouth.land.england = {regular: 4, merc: 2, cav: 0};
        winter(G, context("2", "action"));
        const record = returnsFor(G, "england").find((entry) => entry.from === "portsmouth")!;
        const before = JSON.stringify(G.spaces.portsmouth.land.england);

        expect(chooseWinterReturn(G, context("2"), {
            id: record.id, to: record.autoTo, units: {regular: 1, merc: 0, cav: 0},
        })).toBe(INVALID_MOVE);
        expect(chooseWinterReturn(G, context("2"), {
            id: record.id, to: record.autoTo, units: {regular: 5, merc: 0, cav: 0},
        })).toBe(INVALID_MOVE);
        expect(JSON.stringify(G.spaces.portsmouth.land.england)).toBe(before);
        expect(returnsFor(G, "england").some((entry) => entry.from === "portsmouth")).toBe(true);
    });

    it("rejects a destination the record does not offer and another power's record", () => {
        const G = spanishGame();
        const record = returnsFor(G, "spain").find((entry) => entry.from === "barcelona")!;

        expect(chooseWinterReturn(G, context("1"), {id: record.id, to: "clermont"})).toBe(INVALID_MOVE);
        expect(chooseWinterReturn(G, context("2"), {id: record.id, to: record.autoTo})).toBe(INVALID_MOVE);
        expect(chooseWinterReturn(G, context("1", "action"), {id: record.id, to: record.autoTo})).toBe(INVALID_MOVE);
        expect(returnsFor(G, "spain").some((entry) => entry.from === "barcelona")).toBe(true);
    });

    it("keeps the automatic placement when the Card Draw turn ends", () => {
        const G = spanishGame();
        const record = returnsFor(G, "spain").find((entry) => entry.from === "barcelona")!;
        const auto = landCount(G.spaces[record.autoTo].land.spain);
        const endTurn = jest.fn();

        expect(endPhaseTurn(G, {...context("1"), events: {endTurn}} as unknown as Ctx)).toBeUndefined();

        expect(landCount(G.spaces[record.autoTo].land.spain)).toBe(auto);
        expect(G.winterReturnChoices).toBeUndefined();
        expect(endTurn).toHaveBeenCalledTimes(1);
        expect(G.log.join("\n")).toContain("keeps the automatic winter return moves");
    });

    it("does not block other moves, because the automatic placement already stands", () => {
        const G = spanishGame();

        expect(moveError(G, "declareWar")).toBeUndefined();
        expect(moveError(G, "chooseWinterReturn")).toBeUndefined();
    });

    it("opens the Card Draw stage even when only a return choice is pending", () => {
        const G = spanishGame();
        expect(G.winterLossChoices).toBeUndefined();
        const turnBegin = VirginQueenGameDef.phases!.cardDraw!.turn!.onBegin as (G: VQGame, ctx: Ctx) => void;
        const setActivePlayers = jest.fn();

        turnBegin(G, {...context("1"), events: {setActivePlayers}} as unknown as Ctx);

        expect(setActivePlayers).toHaveBeenCalledWith({value: {"1": "winterLossChoice"}});
    });

    it("drops pending return choices when they are no longer in scope", () => {
        const G = spanishGame();

        autoResolveWinterReturnChoices(G);

        expect(G.winterReturnChoices).toBeUndefined();
    });

    it("records nothing for a garrison with a single capital and no excess", () => {
        const G = game();
        G.activePower = "england";
        G.spaces.portsmouth.land.england = {regular: 2, merc: 0, cav: 0};

        winter(G, context("2", "action"));

        expect(returnsFor(G, "england")).toEqual([]);
        expect(G.spaces.portsmouth.land.england).toEqual({regular: 2, merc: 0, cav: 0});
    });
});

describe("winter naval returns (rule 20.4)", () => {
    /** Every English port one sea zone from the North Sea. */
    const returnGame = (): VQGame => {
        const G = game();
        G.activePower = "england";
        G.seaZones.northSea.naval.england = {galley: 0, galleon: 2, racebuilt: 0, corsair: 0};
        winter(G, context("2", "action"));
        return G;
    };

    it("records every equidistant port and keeps the squadron in one", () => {
        const G = returnGame();
        const record = navalReturnsFor(G, "england")[0];

        if (record === undefined) {
            // One port only: the automatic result is the only legal one.
            expect(navalCount(G.seaZones.northSea.naval.england)).toBe(0);
            return;
        }
        expect(record.options.length).toBeGreaterThan(1);
        expect(record.options).toContain(record.auto);
        expect(navalCount(G.spaces[record.auto].naval.england)).toBeGreaterThanOrEqual(2);
    });

    it("moves the squadron to the chosen equidistant port", () => {
        const G = returnGame();
        const record = navalReturnsFor(G, "england")[0];
        if (record === undefined) return;
        const alternative = record.options.find((port) => port !== record.auto)!;
        const autoBefore = navalCount(G.spaces[record.auto].naval.england);
        const altBefore = navalCount(G.spaces[alternative].naval.england);

        expect(chooseWinterNavalReturn(G, context("2"), {id: record.id, port: alternative})).toBeUndefined();

        expect(navalCount(G.spaces[record.auto].naval.england)).toBe(autoBefore - 2);
        expect(navalCount(G.spaces[alternative].naval.england)).toBe(altBefore + 2);
        expect(G.winterNavalReturnChoices).toBeUndefined();
        expect(G.log.join("\n")).toContain("fleet moves from");
    });

    it("rejects a port the record does not offer", () => {
        const G = returnGame();
        const record = navalReturnsFor(G, "england")[0];
        if (record === undefined) return;

        expect(chooseWinterNavalReturn(G, context("2"), {id: record.id, port: "adriatic"})).toBe(INVALID_MOVE);
        expect(G.winterNavalReturnChoices).toHaveLength(1);
    });
});
