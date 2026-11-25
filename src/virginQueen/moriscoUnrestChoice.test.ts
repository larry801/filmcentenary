import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {SPACES} from "./mapData";
import {VirginQueenGameDef} from "./game";
import {chooseMoriscoUnrest, endPhaseTurn} from "./moves";
import {moveError} from "./movePolicy";
import {moriscoUnrestOptions, setupGame, winter} from "./util";

const context = (player = "0", phase = "cardDraw", numPlayers = 6): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

/**
 * A tournament game whose only land and naval unit is the Morisco stack in
 * Granada, so the winter unrest choice is the rule under test and the legal
 * spaces are decided by the map alone.
 */
const game = (numPlayers = 6): VQGame => {
    const G = setupGame(context("0", "action", numPlayers), {scenario: "tournament"});
    for (const space of SPACES) {
        G.spaces[space.id].land = {};
        G.spaces[space.id].naval = {};
    }
    for (const zone of Object.values(G.seaZones)) {
        zone.naval = {};
    }
    G.spaces.granada.land.ottoman = {regular: 2, merc: 0, cav: 0};
    return G;
};

const winterGame = (numPlayers = 6): VQGame => {
    const G = game(numPlayers);
    winter(G, context("0", "action", numPlayers));
    return G;
};

const options = (G: VQGame): string[] => [...new Set([...moriscoUnrestOptions(G, "granada"), ...(G.pendingMoriscoUnrest?.auto ?? [])])];

describe("rule 20.1 winter Morisco unrest placement", () => {
    it("records the choice for the Ottoman instead of only marking two spaces", () => {
        const G = winterGame();

        const pending = G.pendingMoriscoUnrest;
        expect(pending).toBeDefined();
        expect(pending!.power).toBe("ottoman");
        expect(pending!.origin).toBe("granada");
        expect(pending!.count).toBe(2);
        expect(pending!.auto).toHaveLength(2);
        for (const id of pending!.auto) {
            expect(G.spaces[id].unrest).toBe(true);
        }
    });

    it("hands the choice to England in a four-player game", () => {
        const G = winterGame(4);

        expect(G.pendingMoriscoUnrest!.power).toBe("ottoman");
        // The activated Ottoman belongs to the English seat, so the panel and
        // the choice stage open for player "1".
        const turnBegin = VirginQueenGameDef.phases!.cardDraw!.turn!.onBegin as (G: VQGame, ctx: Ctx) => void;
        G.activePower = "ottoman";
        const setActivePlayers = jest.fn();
        turnBegin(G, {...context("1"), events: {setActivePlayers}} as unknown as Ctx);
        expect(setActivePlayers).toHaveBeenCalledWith({value: {"1": "winterLossChoice"}});
    });

    it("opens the Card Draw choice stage for the Ottoman's owner alone", () => {
        const G = winterGame();
        G.activePower = "ottoman";
        const turnBegin = VirginQueenGameDef.phases!.cardDraw!.turn!.onBegin as (G: VQGame, ctx: Ctx) => void;
        const setActivePlayers = jest.fn();

        turnBegin(G, {...context(), events: {setActivePlayers}} as unknown as Ctx);

        expect(setActivePlayers).toHaveBeenCalledWith({value: {"0": "winterLossChoice"}});
    });

    it("replaces the automatic pair with the chosen pair", () => {
        const G = winterGame();
        const auto = [...G.pendingMoriscoUnrest!.auto];
        const alternatives = options(G).filter((id) => !auto.includes(id)).slice(0, 2);

        expect(chooseMoriscoUnrest(G, context(), {spaces: alternatives})).toBeUndefined();

        expect(G.pendingMoriscoUnrest).toBeUndefined();
        for (const id of auto) expect(G.spaces[id].unrest).toBe(false);
        for (const id of alternatives) expect(G.spaces[id].unrest).toBe(true);
    });

    it("keeps the automatic pair when that same pair is confirmed", () => {
        const G = winterGame();
        const auto = [...G.pendingMoriscoUnrest!.auto];

        expect(chooseMoriscoUnrest(G, context(), {spaces: auto})).toBeUndefined();

        expect(G.pendingMoriscoUnrest).toBeUndefined();
        for (const id of auto) expect(G.spaces[id].unrest).toBe(true);
    });

    it("withdraws only the markers it placed and leaves other unrest alone", () => {
        const G = winterGame();
        const auto = [...G.pendingMoriscoUnrest!.auto];
        const alternatives = options(G).filter((id) => !auto.includes(id)).slice(0, 2);
        const untouched = "granada";
        expect(G.spaces[untouched].unrest).toBe(true);

        expect(chooseMoriscoUnrest(G, context(), {spaces: alternatives})).toBeUndefined();

        expect(G.spaces[untouched].unrest).toBe(true);
        expect(G.log.join("\n")).toContain("withdrawn");
    });

    it("rejects a wrong count, duplicates and spaces outside the two-space radius", () => {
        const G = winterGame();
        const auto = [...G.pendingMoriscoUnrest!.auto];
        const legal = options(G);
        const outside = SPACES.find((space) => !legal.includes(space.id) && space.id !== "granada")!.id;

        expect(chooseMoriscoUnrest(G, context(), {spaces: [auto[0]]})).toBe(INVALID_MOVE);
        expect(chooseMoriscoUnrest(G, context(), {spaces: [auto[0], auto[0]]})).toBe(INVALID_MOVE);
        expect(chooseMoriscoUnrest(G, context(), {spaces: [auto[0], outside]})).toBe(INVALID_MOVE);
        expect(G.pendingMoriscoUnrest).toBeDefined();
    });

    it("refuses the choice from a seat that does not control the Ottoman", () => {
        const G = winterGame();
        const auto = [...G.pendingMoriscoUnrest!.auto];

        expect(chooseMoriscoUnrest(G, context("2"), {spaces: auto})).toBe(INVALID_MOVE);
        expect(G.pendingMoriscoUnrest).toBeDefined();
    });

    it("refuses the choice outside Card Draw", () => {
        const G = winterGame();
        const auto = [...G.pendingMoriscoUnrest!.auto];

        expect(chooseMoriscoUnrest(G, context("0", "diplomacy"), {spaces: auto})).toBe(INVALID_MOVE);
    });

    it("blocks other winter moves until the placement is decided", () => {
        const G = winterGame();
        G.activePower = "ottoman";

        expect(moveError(G, "declareWar")).toBeDefined();
        expect(moveError(G, "chooseMoriscoUnrest")).toBeUndefined();
        expect(moveError(G, "endPhaseTurn")).toBeUndefined();
    });

    it("keeps the automatic pair when the Card Draw turn ends", () => {
        const G = winterGame();
        G.activePower = "ottoman";
        const auto = [...G.pendingMoriscoUnrest!.auto];
        const endTurn = jest.fn();

        expect(endPhaseTurn(G, {...context(), events: {endTurn}} as unknown as Ctx)).toBeUndefined();

        expect(G.pendingMoriscoUnrest).toBeUndefined();
        for (const id of auto) expect(G.spaces[id].unrest).toBe(true);
        expect(endTurn).toHaveBeenCalledTimes(1);
    });

    it("keeps the automatic pair when Diplomacy begins", () => {
        const G = winterGame();
        const auto = [...G.pendingMoriscoUnrest!.auto];
        const onBegin = VirginQueenGameDef.phases!.diplomacy!.onBegin as (G: VQGame) => void;

        onBegin(G);

        expect(G.pendingMoriscoUnrest).toBeUndefined();
        for (const id of auto) expect(G.spaces[id].unrest).toBe(true);
    });

    it("does not offer a space that received its winter replacement", () => {
        const G = winterGame();
        const auto = [...G.pendingMoriscoUnrest!.auto];
        // Madrid is within two of Granada and is a Spanish capital: winter adds
        // its regular after rule 20.1 marks the automatic pair, so it is no
        // longer an unoccupied space the Ottoman may pick.
        expect(auto).not.toContain("madrid");
        expect(G.spaces.madrid.land.spain?.regular ?? 0).toBeGreaterThan(0);

        expect(chooseMoriscoUnrest(G, context(), {spaces: [auto[0], "madrid"]})).toBe(INVALID_MOVE);
        expect(G.pendingMoriscoUnrest).toBeDefined();
    });

    it("records no choice once the Morisco is gone", () => {
        const G = game();
        delete G.morisco;
        delete G.spaces.granada.land.ottoman;

        winter(G, context("0", "action"));

        expect(G.pendingMoriscoUnrest).toBeUndefined();
    });
});
