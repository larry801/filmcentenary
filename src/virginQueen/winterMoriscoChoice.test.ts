import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {SPACES} from "./mapData";
import {VirginQueenGameDef} from "./game";
import {chooseWinterLoss} from "./moves";
import {moveError} from "./movePolicy";
import {checkMoriscoStatus, clearWar, setupGame, winter} from "./util";

const context = (player = "0", phase = "cardDraw"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

/**
 * A tournament game whose only land and naval unit is the Morisco stack in
 * Granada, so the only winter loss choice is the one under test.
 */
const game = (): VQGame => {
    const G = setupGame(context("0", "action"), {scenario: "tournament"});
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

/** The Morisco is besieging a fortified Granada, so Winter eliminates it. */
const siegeGame = (): VQGame => {
    const G = game();
    G.spaces.granada.fortress = true;
    G.spaces.granada.siege = {by: "ottoman", sinceImpulse: 1};
    return G;
};

const peace = (G: VQGame): void => {
    G.powers.ottoman.wars = G.powers.ottoman.wars.filter((power) => power !== "spain");
    G.powers.spain.wars = G.powers.spain.wars.filter((power) => power !== "ottoman");
};

describe("winter Morisco removal confirmation", () => {
    it("records the removed Morisco regulars as a Card Draw choice at Winter", () => {
        const G = siegeGame();

        winter(G, context("0", "action"));

        expect(G.morisco).toBeUndefined();
        expect(G.spaces.granada.land.ottoman).toBeUndefined();
        expect(G.removed).toContain("vq-028");
        expect(G.winterLossChoices).toEqual([{
            power: "ottoman",
            space: "granada",
            amount: 2,
            removed: {regular: 2, merc: 0, cav: 0},
        }]);
        expect(moveError(G, "claimSeaCaptain")).toBeDefined();
        expect(moveError(G, "chooseWinterLoss")).toBeUndefined();
        expect(moveError(G, "endPhaseTurn")).toBeUndefined();
    });

    it("records the choice when the Morisco is removed for peace at Winter", () => {
        const G = game();
        peace(G);

        winter(G, context("0", "action"));

        expect(G.morisco).toBeUndefined();
        expect(G.winterLossChoices).toEqual([{
            power: "ottoman",
            space: "granada",
            amount: 2,
            removed: {regular: 2, merc: 0, cav: 0},
        }]);
    });

    it("confirms the automatic removal and clears the pending choice", () => {
        const G = siegeGame();
        winter(G, context("0", "action"));
        const endStage = jest.fn();

        expect(chooseWinterLoss(G, {...context(), events: {endStage}} as unknown as Ctx,
            {space: "granada", kind: "auto"})).toBeUndefined();

        expect(G.spaces.granada.land.ottoman).toBeUndefined();
        expect(G.winterLossChoices).toBeUndefined();
        expect(endStage).toHaveBeenCalledTimes(1);
        expect(G.log.join("\n")).toContain("keeps the automatic winter losses");
    });

    it("does not record a choice when peace removes the Morisco during the Action Phase", () => {
        const G = game();

        clearWar(G, "ottoman", "spain");

        expect(G.morisco).toBeUndefined();
        expect(G.spaces.granada.land.ottoman).toBeUndefined();
        expect(G.winterLossChoices).toBeUndefined();
        // Nothing pending, so ordinary Action Phase moves are not blocked.
        expect(moveError(G, "claimSeaCaptain")).toBeUndefined();
    });

    it("does not record a choice from an Action Phase Morisco status check", () => {
        const G = game();
        peace(G);

        checkMoriscoStatus(G);

        expect(G.morisco).toBeUndefined();
        expect(G.winterLossChoices).toBeUndefined();
        expect(moveError(G, "claimSeaCaptain")).toBeUndefined();
    });

    it("opens the Card Draw winter-loss stage for the Ottoman owner only", () => {
        const turnBegin = VirginQueenGameDef.phases!.cardDraw!.turn!.onBegin as (G: VQGame, ctx: Ctx) => void;
        const G = siegeGame();
        winter(G, context("0", "action"));
        const setActivePlayers = jest.fn();

        turnBegin(G, {...context(), events: {setActivePlayers}} as unknown as Ctx);

        expect(setActivePlayers).toHaveBeenCalledWith({value: {"0": "winterLossChoice"}});
    });

    it("keeps the choice bounded to Card Draw", () => {
        const G = siegeGame();
        winter(G, context("0", "action"));
        const onBegin = VirginQueenGameDef.phases!.diplomacy!.onBegin as (G: VQGame) => void;

        onBegin(G);

        expect(G.winterLossChoices).toBeUndefined();
    });
});
