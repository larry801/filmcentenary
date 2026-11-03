import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame, navalCount} from "./constant/general";
import {autoInterceptionOrder, chooseInterceptionOrder, moveNaval} from "./moves";
import {interceptionOrderOptions} from "./navalCombat";
import {setupGame} from "./util";

const context = (values: number[] = [], playerID = "3", currentPlayer = playerID): Ctx => ({
    currentPlayer,
    playerID,
    phase: "action",
    activePlayers: null,
    numPlayers: 6,
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

/** Context for the intercepting power while the interceptionOrder stage is open. */
const orderContext = (values: number[] = [], playerID = "2"): Ctx => {
    const ctx = context(values, playerID, "3");
    (ctx as unknown as {activePlayers: Record<string, string>}).activePlayers = {[playerID]: "interceptionOrder"};
    return ctx;
};

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

/** Campaign setup: France sails from Calais into the empty English Channel. */
const sailToChannel = (G: VQGame, ctx: Ctx = context([], "3")): void | typeof INVALID_MOVE => {
    G.powers.france.cp = 1;
    return moveNaval(G, ctx, {from: "calais", to: "englishChannel"});
};

/** Adds a second English stack adjacent to the English Channel. */
const addNorthSeaFleet = (G: VQGame): void => {
    G.seaZones.northSea.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
};

describe("naval interception order (rule 13.2)", () => {
    it("offers the intercepting power the order of its own stacks", () => {
        const G = game();
        addNorthSeaFleet(G);
        const ctx = context([6, 6], "3");

        expect(sailToChannel(G, ctx)).toBeUndefined();

        expect(G.pendingInterceptionOrder).toEqual({
            power: "france",
            defender: "england",
            moveFrom: "calais",
            to: "englishChannel",
            destinationHadEnemy: false,
        });
        expect(ctx.events!.setActivePlayers).toHaveBeenCalledWith({value: {2: "interceptionOrder"}});
        // Nothing is rolled until the order is announced.
        expect(G.log.join("\n")).not.toContain("naval interception from");
        expect(interceptionOrderOptions(G).map((entry) => entry.id)).toEqual(["northSea", "portsmouth"]);
    });

    it("attempts the stack the player announces first instead of the engine order", () => {
        const G = game();
        addNorthSeaFleet(G);
        expect(sailToChannel(G)).toBeUndefined();

        // Engine order would try northSea first; the player announces Portsmouth.
        const ctx = orderContext([6, 6, 1, 1, 1, 1]);
        expect(chooseInterceptionOrder(G, ctx, {from: "portsmouth"})).toBeUndefined();

        expect(G.pendingInterceptionOrder).toBeUndefined();
        expect(ctx.events!.endStage).toHaveBeenCalled();
        expect(G.log.join("\n")).toContain("naval interception from Portsmouth");
        expect(G.log.join("\n")).not.toContain("naval interception from northSea");
        // The announced home-port stack moved; the other stack never attempted.
        expect(G.spaces.portsmouth.naval.england).toBeUndefined();
        expect(navalCount(G.seaZones.northSea.naval.england)).toBe(1);
    });

    it("continues with the remaining own stacks after the announced attempt fails", () => {
        const G = game();
        addNorthSeaFleet(G);
        expect(sailToChannel(G)).toBeUndefined();

        const ctx = orderContext([1, 1, 6, 6, 1, 1, 1, 1]);
        expect(chooseInterceptionOrder(G, ctx, {from: "northSea"})).toBeUndefined();

        const log = G.log.join("\n");
        expect(log).toContain("naval interception from northSea: [1,1]");
        expect(log).toContain("naval interception from Portsmouth");
        expect(log.indexOf("naval interception from northSea")).toBeLessThan(log.indexOf("naval interception from Portsmouth"));
        expect(G.pendingInterceptionOrder).toBeUndefined();
    });

    it("falls back to engine order when the player declines the choice", () => {
        const G = game();
        addNorthSeaFleet(G);
        expect(sailToChannel(G)).toBeUndefined();

        const ctx = orderContext([6, 6, 1, 1, 1, 1]);
        expect(autoInterceptionOrder(G, ctx)).toBeUndefined();

        expect(G.pendingInterceptionOrder).toBeUndefined();
        expect(ctx.events!.endStage).toHaveBeenCalled();
        // Engine order (impulse order, then location) tries northSea first.
        expect(G.log.join("\n")).toContain("naval interception from northSea");
        expect(G.log.join("\n")).not.toContain("naval interception from Portsmouth");
    });

    it("offers #14 before the roll for a home-port stack the player announces", () => {
        const G = game();
        G.powers.england.cards.push("vq-014");
        addNorthSeaFleet(G);
        expect(sailToChannel(G)).toBeUndefined();

        expect(chooseInterceptionOrder(G, orderContext(), {from: "portsmouth"})).toBeUndefined();

        expect(G.pendingInterceptionOrder).toBeUndefined();
        expect(G.pendingBeacon).toEqual({
            power: "france",
            defender: "england",
            from: "portsmouth",
            moveFrom: "calais",
            to: "englishChannel",
            destinationHadEnemy: false,
        });
        expect(G.powers.england.cards).toContain("vq-014");
        expect(G.log.join("\n")).not.toContain("naval interception from");
    });

    it("keeps #14 available when another stack intercepts first", () => {
        const G = game();
        G.powers.england.cards.push("vq-014");
        addNorthSeaFleet(G);
        expect(sailToChannel(G)).toBeUndefined();

        expect(chooseInterceptionOrder(G, orderContext([1, 1]), {from: "northSea"})).toBeUndefined();

        expect(G.log.join("\n")).toContain("naval interception from northSea: [1,1]");
        // The only remaining English stack is Portsmouth, so the response is
        // offered before its roll rather than skipped by the earlier attempt.
        expect(G.pendingBeacon?.from).toBe("portsmouth");
        expect(G.powers.england.cards).toContain("vq-014");
        expect(G.log.join("\n")).not.toContain("naval interception from Portsmouth");
    });

    it("resolves a single eligible stack automatically without a choice", () => {
        const G = game();
        const ctx = context([6, 6], "3");

        expect(sailToChannel(G, ctx)).toBeUndefined();

        expect(G.pendingInterceptionOrder).toBeUndefined();
        expect(G.log.join("\n")).toContain("naval interception from Portsmouth");
    });

    it("rejects an announcement from the wrong player or an ineligible stack", () => {
        const G = game();
        addNorthSeaFleet(G);
        expect(sailToChannel(G)).toBeUndefined();

        expect(chooseInterceptionOrder(G, orderContext([], "3"), {from: "portsmouth"})).toBe(INVALID_MOVE);
        expect(chooseInterceptionOrder(G, orderContext(), {from: "calais"})).toBe(INVALID_MOVE);
        expect(G.pendingInterceptionOrder).toBeDefined();
        expect(G.log.join("\n")).not.toContain("naval interception from");
    });
});
