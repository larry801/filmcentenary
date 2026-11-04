import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {SPACES} from "./mapData";
import {chooseWinterLoss, endPhaseTurn} from "./moves";
import {setupGame, winter} from "./util";

const context = (player = "0", phase = "cardDraw"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

/**
 * A tournament game whose only land and naval units are the Ottoman stack in
 * Granada, so the only winter loss choice is the Morisco removal under test.
 */
const game = (units = {regular: 2, merc: 0, cav: 0}): VQGame => {
    const G = setupGame(context("0", "action"), {scenario: "tournament"});
    for (const space of SPACES) {
        G.spaces[space.id].land = {};
        G.spaces[space.id].naval = {};
    }
    for (const zone of Object.values(G.seaZones)) {
        zone.naval = {};
    }
    G.spaces.granada.land.ottoman = {...units};
    return G;
};

/** The Morisco is besieging a fortified Granada, so Winter eliminates it. */
const siegeGame = (units = {regular: 2, merc: 0, cav: 0}): VQGame => {
    const G = game(units);
    G.spaces.granada.fortress = true;
    G.spaces.granada.siege = {by: "ottoman", sinceImpulse: 1};
    return G;
};

/**
 * The same siege with Granada held by the Ottomans, so the surviving
 * mercenaries and cavalry stay there as winter quarters instead of returning
 * to a home capital.  Those survivors would let an ordinary loss choice swap
 * the removed Morisco regulars for another unit type.
 */
const survivorSiegeGame = (): VQGame => {
    const G = siegeGame({regular: 2, merc: 2, cav: 2});
    G.spaces.granada.control = "ottoman";
    return G;
};

/**
 * An ordinary English attrition loss: overstacked Portsmouth with London in
 * unrest loses one regular, which the owner may swap for another unit type.
 */
const attritionGame = (): VQGame => {
    const G = setupGame(context("2", "action"));
    for (const space of SPACES) {
        delete G.spaces[space.id].land.england;
    }
    G.activePower = "england";
    G.spaces.portsmouth.land.england = {regular: 6, merc: 0, cav: 0};
    G.spaces.london.unrest = true;
    winter(G, context("2", "action"));
    return G;
};

describe("winter Morisco confirm-only removal", () => {
    it("marks the winter Morisco record as confirmation-only", () => {
        const G = siegeGame();

        winter(G, context("0", "action"));

        expect(G.winterLossChoices).toEqual([{
            power: "ottoman",
            space: "granada",
            amount: 2,
            removed: {regular: 2, merc: 0, cav: 0},
            confirmOnly: true,
        }]);
    });

    it("rejects swapping the removed Morisco regulars for surviving mercenaries or cavalry", () => {
        const G = survivorSiegeGame();

        winter(G, context("0", "action"));

        // The Morisco regulars are gone, but two mercenaries and two cavalry
        // survive: an ordinary loss choice could take either type instead.
        expect(G.spaces.granada.land.ottoman).toEqual({regular: 0, merc: 2, cav: 2});
        const before = {...G.spaces.granada.land.ottoman!};

        expect(chooseWinterLoss(G, context(), {space: "granada", kind: "merc"})).toBe(INVALID_MOVE);
        expect(chooseWinterLoss(G, context(), {space: "granada", kind: "cav"})).toBe(INVALID_MOVE);
        expect(chooseWinterLoss(G, context(), {space: "granada", kind: "regular"})).toBe(INVALID_MOVE);

        expect(G.spaces.granada.land.ottoman).toEqual(before);
        expect(G.winterLossChoices).toHaveLength(1);
    });

    it("confirms the removal through auto and keeps the surviving units", () => {
        const G = survivorSiegeGame();

        winter(G, context("0", "action"));
        const endStage = jest.fn();

        expect(chooseWinterLoss(G, {...context(), events: {endStage}} as unknown as Ctx,
            {space: "granada", kind: "auto"})).toBeUndefined();

        expect(G.spaces.granada.land.ottoman).toEqual({regular: 0, merc: 2, cav: 2});
        expect(G.winterLossChoices).toBeUndefined();
        expect(endStage).toHaveBeenCalledTimes(1);
        expect(G.log.join("\n")).toContain("confirms the Morisco removal in Granada");
    });

    it("keeps the confirmed removal when the Card Draw turn ends unconfirmed", () => {
        const G = survivorSiegeGame();

        winter(G, context("0", "action"));
        const endTurn = jest.fn();

        expect(endPhaseTurn(G, {...context(), events: {endTurn}} as unknown as Ctx)).toBeUndefined();

        expect(G.winterLossChoices).toBeUndefined();
        expect(G.spaces.granada.land.ottoman).toEqual({regular: 0, merc: 2, cav: 2});
        expect(endTurn).toHaveBeenCalledTimes(1);
    });

    it("leaves ordinary winter attrition choices swappable", () => {
        const G = attritionGame();

        expect(G.winterLossChoices).toHaveLength(1);
        expect(G.winterLossChoices![0].confirmOnly).toBeUndefined();
        // Give London a mercenary so the ordinary choice can take it instead.
        G.spaces.london.land.england!.merc += 1;

        expect(chooseWinterLoss(G, context("2"), {space: "london", kind: "merc"})).toBeUndefined();

        // The automatically removed regular returns; the mercenary is removed.
        expect(G.spaces.london.land.england).toEqual({regular: 2, merc: 0, cav: 0});
        expect(G.winterLossChoices).toBeUndefined();
    });
});
