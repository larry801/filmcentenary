import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {landCount, navalCount, VQGame} from "./constant/general";
import {autoResolveCityRebelsLosses, chooseCityRebelsLoss, cityRebelsLossOptions, playCard} from "./moves";
import {moveError} from "./movePolicy";
import {setupGame} from "./util";

const context = (playerID = "2", currentPlayer = "2"): Ctx => ({
    currentPlayer,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

const game = (): VQGame => {
    const G = setupGame(context());
    G.powers.england.cards = ["vq-018"];
    return G;
};

/**
 * Rotterdam with six Spanish units (five land, one galley) against five hits:
 * the controller must allocate five losses but one unit always survives.
 */
const pendingGame = (): VQGame => {
    const G = game();
    G.spaces.rotterdam.control = "spain";
    G.spaces.rotterdam.land = {spain: {regular: 2, merc: 2, cav: 1}};
    G.spaces.rotterdam.naval = {spain: {galley: 1, galleon: 0, racebuilt: 0, corsair: 0}};
    G.spaces.rotterdam.leaders = [];
    expect(playCard(G, context(), {cardId: "vq-018", asEvent: true, target: "rotterdam"})).toBeUndefined();
    return G;
};

describe("City State Rebels loss choice (#18)", () => {
    it("opens a bounded controller choice without removing units immediately", () => {
        const G = game();
        const setActivePlayers = jest.fn();
        G.spaces.rotterdam.control = "spain";
        G.spaces.rotterdam.land = {spain: {regular: 2, merc: 2, cav: 1}};
        G.spaces.rotterdam.naval = {spain: {galley: 1, galleon: 0, racebuilt: 0, corsair: 0}};

        expect(playCard(G, {...context(), events: {setActivePlayers}} as unknown as Ctx,
            {cardId: "vq-018", asEvent: true, target: "rotterdam"})).toBeUndefined();

        expect(G.pendingCityRebels).toMatchObject({
            power: "england",
            controller: "spain",
            space: "rotterdam",
            remaining: 5,
        });
        expect(G.pendingCityRebels?.values).toHaveLength(5);
        // The controller allocates every hit; nothing is auto-removed yet.
        expect(G.spaces.rotterdam.land.spain).toEqual({regular: 2, merc: 2, cav: 1});
        expect(G.spaces.rotterdam.naval.spain?.galley).toBe(1);
        expect(setActivePlayers).toHaveBeenCalledWith({value: {"1": "cityRebelsLossChoice"}});
        expect(cityRebelsLossOptions(G).map((entry) => entry.kind))
            .toEqual(["merc", "regular", "cav", "galley"]);
    });

    it("assigns one hit per move and finishes when all hits are allocated", () => {
        const G = pendingGame();
        const endStage = jest.fn();
        const spanish = {...context("1"), events: {endStage}} as unknown as Ctx;

        expect(chooseCityRebelsLoss(G, spanish, {kind: "regular"})).toBeUndefined();
        expect(G.spaces.rotterdam.land.spain).toEqual({regular: 1, merc: 2, cav: 1});
        expect(G.pendingCityRebels?.remaining).toBe(4);
        expect(endStage).not.toHaveBeenCalled();

        expect(chooseCityRebelsLoss(G, spanish, {kind: "regular"})).toBeUndefined();
        expect(G.spaces.rotterdam.land.spain).toEqual({regular: 0, merc: 2, cav: 1});
        expect(G.pendingCityRebels?.remaining).toBe(3);

        expect(chooseCityRebelsLoss(G, spanish, {kind: "galley"})).toBeUndefined();
        expect(G.spaces.rotterdam.naval.spain).toBeUndefined();
        expect(G.pendingCityRebels?.remaining).toBe(2);

        expect(chooseCityRebelsLoss(G, spanish, {kind: "merc"})).toBeUndefined();
        expect(chooseCityRebelsLoss(G, spanish, {kind: "merc"})).toBeUndefined();

        expect(G.pendingCityRebels).toBeUndefined();
        expect(endStage).toHaveBeenCalledTimes(1);
        expect(landCount(G.spaces.rotterdam.land.spain)).toBe(1);
        expect(navalCount(G.spaces.rotterdam.naval.spain)).toBe(0);
        expect(G.spaces.rotterdam.control).toBe("spain");
        expect(G.log.join("\n")).toContain("City State Rebels");
        expect(G.log.join("\n")).toContain("in Rotterdam");
    });

    it("auto allocates every remaining hit in the printed order", () => {
        const G = pendingGame();
        const endStage = jest.fn();

        expect(chooseCityRebelsLoss(G, {...context("1"), events: {endStage}} as unknown as Ctx,
            {kind: "auto"})).toBeUndefined();

        // The five automatic land losses (2 merc, 2 regular, 1 cavalry) leave
        // the galley as the only survivor; the fortress stays Spanish.
        expect(G.spaces.rotterdam.land.spain).toBeUndefined();
        expect(G.spaces.rotterdam.naval.spain?.galley).toBe(1);
        expect(G.spaces.rotterdam.control).toBe("spain");
        expect(G.pendingCityRebels).toBeUndefined();
        expect(endStage).toHaveBeenCalledTimes(1);
    });

    it("rejects absent types and choices made by another seat", () => {
        const G = pendingGame();
        const remaining = G.pendingCityRebels;
        const spanish = context("1");

        expect(chooseCityRebelsLoss(G, spanish, {kind: "galleon"})).toBe(INVALID_MOVE);
        expect(chooseCityRebelsLoss(G, spanish, {kind: "corsair"})).toBe(INVALID_MOVE);
        expect(chooseCityRebelsLoss(G, context("2"), {kind: "regular"})).toBe(INVALID_MOVE);
        expect(G.pendingCityRebels).toBe(remaining);
        expect(G.spaces.rotterdam.land.spain).toEqual({regular: 2, merc: 2, cav: 1});

        expect(moveError(G, "claimSeaCaptain")).toBeDefined();
        expect(moveError(G, "chooseCityRebelsLoss")).toBeUndefined();

        expect(chooseCityRebelsLoss(G, spanish, {kind: "auto"})).toBeUndefined();
        expect(chooseCityRebelsLoss(G, spanish, {kind: "auto"})).toBe(INVALID_MOVE);
    });

    it("keeps the automatic composition when the choice is abandoned", () => {
        const G = pendingGame();

        autoResolveCityRebelsLosses(G);

        expect(G.pendingCityRebels).toBeUndefined();
        expect(G.spaces.rotterdam.land.spain).toBeUndefined();
        expect(G.spaces.rotterdam.naval.spain?.galley).toBe(1);
        expect(G.spaces.rotterdam.control).toBe("spain");
    });

    it("resolves immediately when the stack has no real unit-type choice", () => {
        const G = game();
        G.spaces.rotterdam.control = "spain";
        // Seven regulars and five hits: one kind, so the fallback applies now.
        G.spaces.rotterdam.land = {spain: {regular: 7, merc: 0, cav: 0}};

        expect(playCard(G, context(), {cardId: "vq-018", asEvent: true, target: "rotterdam"})).toBeUndefined();

        expect(G.pendingCityRebels).toBeUndefined();
        expect(G.spaces.rotterdam.land.spain).toEqual({regular: 2, merc: 0, cav: 0});
        expect(G.spaces.rotterdam.control).toBe("spain");
    });

    it("keeps the automatic wipe and control restoration when hits cover the stack", () => {
        const G = game();
        G.spaces.rotterdam.control = "france";
        G.spaces.rotterdam.land = {france: {regular: 2, merc: 1, cav: 1}};

        expect(playCard(G, context(), {cardId: "vq-018", asEvent: true, target: "rotterdam"})).toBeUndefined();

        expect(G.pendingCityRebels).toBeUndefined();
        expect(G.spaces.rotterdam.land.france).toBeUndefined();
        expect(G.spaces.rotterdam.control).toBe("protestant");
        expect(G.spaces.rotterdam.land.protestant?.regular).toBe(1);
    });
});
