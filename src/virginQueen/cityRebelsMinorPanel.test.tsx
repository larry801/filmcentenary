import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import {Controller, Power, VQGame} from "./constant/general";
import {cityRebelsDecider, cityRebelsLossOptions, chooseCityRebelsLoss, playCard} from "./moves";
import {moveError} from "./movePolicy";
import {ownerOf} from "./ownership";
import {PendingCityRebelsPanel} from "./components/board/PendingPanels/CityRebelsPanel";
import {addLand, isCityRebelsTarget, setupGame} from "./util";
import {SPACES} from "./mapData";

/**
 * #18 City State Rebels lets the *controller* allocate the hits.  For a minor
 * garrison that is the major power allied to the minor, so the panel has to
 * follow the same rule as the move guard.  It used to test
 * `isPower(controller)` only, which rendered no buttons at all for an allied
 * minor's fortress while `moveError` blocked every seat from passing.
 */
const context = (playerID: string): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (values: unknown[]) => values},
    events: {setActivePlayers: () => undefined, endStage: () => undefined, endTurn: () => undefined},
} as unknown as Ctx);

const moves = {
    chooseCityRebelsLoss: (args: {kind: string}) => {chosen = args.kind;},
} as unknown as {chooseCityRebelsLoss: (args: {kind: string}) => void};

let chosen: string | undefined;

/** France plays #18 against a Venetian fortress while Spain is allied to Venice. */
const siegeVenetianFortress = (): VQGame => {
    const G = setupGame({...context("3"), phase: "action"} as Ctx);
    G.activePower = "france";
    G.powers.france.cards = ["vq-018"];
    G.powers.france.cp = 0;
    G.powers.spain.alliedMinors = ["venice"];
    const target = SPACES.find((space) => {
        const state = G.spaces[space.id];
        if (state === undefined) return false;
        state.control = "venice";
        state.land = {};
        state.naval = {};
        state.unrest = false;
        addLand(G, space.id, "venice", "regular", 4);
        addLand(G, space.id, "venice", "merc", 4);
        return isCityRebelsTarget(G, space.id);
    });
    expect(target).toBeDefined();
    const spaceId = target!.id;
    G.spaces[spaceId].control = "venice";
    G.spaces[spaceId].land = {};
    G.spaces[spaceId].naval = {};
    addLand(G, spaceId, "venice", "regular", 4);
    addLand(G, spaceId, "venice", "merc", 4);
    expect(playCard(G, context(ownerOf(G, "france") ?? "3"), {cardId: "vq-018", asEvent: true, target: spaceId}))
        .toBeUndefined();
    return G;
};

const render = (G: VQGame, playerID: string): string => renderToStaticMarkup(
    <PendingCityRebelsPanel G={G} moves={moves} playerID={playerID}/>,
);

describe("#18 City State Rebels asks the minor's controlling major", () => {
    it("maps a minor garrison to the major that owns the minor", () => {
        const G = siegeVenetianFortress();
        expect(G.pendingCityRebels?.controller).toBe("venice");
        const decider = cityRebelsDecider(G, "venice");
        expect(decider).toBe("spain");
        expect(ownerOf(G, decider!)).toBe("1");
    });

    it("renders the allocation buttons for that seat", () => {
        const G = siegeVenetianFortress();
        chosen = undefined;
        const markup = render(G, "1");
        for (const option of cityRebelsLossOptions(G)) {
            expect(markup).toContain(option.label);
        }
        // Other seats only see the waiting text.
        expect(render(G, "3")).not.toContain(cityRebelsLossOptions(G)[0].label);
    });

    it("lets that seat allocate a hit, which ends the deadlock", () => {
        const G = siegeVenetianFortress();
        expect(moveError(G, "pass")).toBeDefined();
        const option = cityRebelsLossOptions(G)[0];
        expect(chooseCityRebelsLoss(G, context("1"), {kind: option.kind})).toBeUndefined();
    });

    it("keeps refusing a seat that does not control the garrison", () => {
        const G = siegeVenetianFortress();
        const option = cityRebelsLossOptions(G)[0];
        expect(chooseCityRebelsLoss(G, context("3"), {kind: option.kind})).toBe("INVALID_MOVE");
    });
});
