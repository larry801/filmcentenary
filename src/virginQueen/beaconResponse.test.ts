import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {moveNaval, respondBeaconFires} from "./moves";
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

/** Context for the intercepting power while the beaconResponse stage is open. */
const beaconContext = (values: number[] = [], playerID = "2", currentPlayer = "3"): Ctx => {
    const ctx = context(values, playerID, currentPlayer);
    (ctx as unknown as {activePlayers: Record<string, string>}).activePlayers = {[playerID]: "beaconResponse"};
    return ctx;
};

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

/** Campaign setup: France sails from Calais (its home port) into the empty English Channel. */
const sailToChannel = (G: VQGame, ctx: Ctx = context([], "3")): void | typeof INVALID_MOVE => {
    G.powers.france.cp = 1;
    return moveNaval(G, ctx, {from: "calais", to: "englishChannel"});
};

describe("Beacon Fires response (card #14)", () => {
    it("offers the response before the roll for a home-port interception", () => {
        const G = game();
        G.powers.england.cards.push("vq-014");
        const ctx = context([6, 6], "3");

        expect(sailToChannel(G, ctx)).toBeUndefined();

        expect(G.pendingBeacon).toEqual({
            power: "france",
            defender: "england",
            from: "portsmouth",
            moveFrom: "calais",
            to: "englishChannel",
            destinationHadEnemy: false,
        });
        expect(ctx.events!.setActivePlayers).toHaveBeenCalledWith({value: {2: "beaconResponse"}});
        // The response is offered before the interception die roll.
        expect(G.log.join("\n")).not.toContain("naval interception from");
        expect(G.log.join("\n")).not.toContain("intercepts the naval move");
        // Nothing is consumed merely by offering the response.
        expect(G.powers.england.cards).toContain("vq-014");
        expect(G.discard).not.toContain("vq-014");
    });

    it("plays the response to make the interception automatic and add two battle dice", () => {
        const G = game();
        G.powers.england.cards.push("vq-014");
        expect(sailToChannel(G)).toBeUndefined();

        const ctx = beaconContext([6, 6, 6, 6, 6, 6]);
        expect(respondBeaconFires(G, ctx, {choice: "play"})).toBeUndefined();

        expect(G.pendingBeacon).toBeUndefined();
        expect(G.powers.england.cards).not.toContain("vq-014");
        expect(G.discard).toContain("vq-014");
        expect(G.log.join("\n")).toContain("plays Beacon Fires: interception succeeds automatically");
        expect(G.log.join("\n")).toContain("intercepts the naval move into");
        expect(ctx.events!.endStage).toHaveBeenCalled();
        // No interception roll is made: the +2 dice belong to the battle.
        // England's single galleon rolls 2 dice, plus Beacon Fires' 2 = 4.
        expect(G.lastRolls).toContain("vs England");
        expect(G.lastRolls).toContain("(4 dice)");
    });

    it("resumes the ordinary interception roll when the response is declined", () => {
        const G = game();
        G.powers.england.cards.push("vq-014");
        expect(sailToChannel(G)).toBeUndefined();

        const ctx = beaconContext([6, 6, 6, 6, 6, 6]);
        expect(respondBeaconFires(G, ctx, {choice: "decline"})).toBeUndefined();

        expect(G.pendingBeacon).toBeUndefined();
        expect(G.powers.england.cards).toContain("vq-014");
        expect(G.log.join("\n")).toContain("naval interception from Portsmouth");
        expect(G.log.join("\n")).toContain("intercepts the naval move into");
        expect(G.lastRolls).toContain("vs England");
        expect(G.lastRolls).toContain("(2 dice)");
        expect(G.navalDiceBonus).toBeUndefined();
    });

    it("rejects the response outside the interception window", () => {
        const G = game();
        G.powers.england.cards.push("vq-014");

        expect(respondBeaconFires(G, beaconContext(), {choice: "play"})).toBe(INVALID_MOVE);
        expect(G.powers.england.cards).toContain("vq-014");
    });

    it("rejects the response from a power other than the intercepting power", () => {
        const G = game();
        G.powers.england.cards.push("vq-014");
        expect(sailToChannel(G)).toBeUndefined();

        // Player 3 commands France and is the active power, not the responder.
        expect(respondBeaconFires(G, beaconContext([], "3"), {choice: "play"})).toBe(INVALID_MOVE);
        expect(G.pendingBeacon).toBeDefined();
        expect(G.powers.england.cards).toContain("vq-014");
    });

    it("does not offer the response when the interception is not from a home port", () => {
        const G = game();
        G.powers.england.cards.push("vq-014");
        // Put the English fleet at sea instead of its home port.
        delete G.spaces.portsmouth.naval.england;
        G.seaZones.northSea.naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        const ctx = context([6, 6, 6, 6, 6, 6], "3");

        expect(sailToChannel(G, ctx)).toBeUndefined();

        expect(G.pendingBeacon).toBeUndefined();
        expect(ctx.events!.setActivePlayers).not.toHaveBeenCalledWith({value: {2: "beaconResponse"}});
        expect(G.powers.england.cards).toContain("vq-014");
        // The ordinary roll still intercepts; #14 was simply not playable there.
        expect(G.log.join("\n")).toContain("naval interception from northSea");
        expect(G.log.join("\n")).toContain("intercepts the naval move into");
    });
});
