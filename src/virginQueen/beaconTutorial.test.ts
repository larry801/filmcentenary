import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {moveNaval, respondBeaconFires} from "./moves";
import {chooseBattle} from "./combat";
import {chooseInterception, interceptionOptions} from "./interception";
import {ownerOf} from "./ownership";
import {tutorialLesson} from "./tutorial";
import {setupGame} from "./util";

const context = (values: number[] = [], playerID = "0"): Ctx => ({
    currentPlayer: "0",
    playerID,
    phase: "action",
    activePlayers: null,
    numPlayers: 2,
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

/** Context for the intercepting power while the shared beaconResponse stage is open. */
const beaconContext = (G: VQGame, values: number[] = [], playerID = ownerOf(G, "spain")!): Ctx => {
    const ctx = context(values, playerID);
    (ctx as unknown as {activePlayers: Record<string, string>}).activePlayers = {[playerID]: "beaconResponse"};
    return ctx;
};

const tutorialGame = (): VQGame => setupGame({...context(), phase: "action"} as Ctx, {scenario: "tutorial"});

/** The Ottoman sails from the Aegean into the Ionian Sea, where Spain may intercept from Messina. */
const sailIntoIonian = (withBeacon = true): VQGame => {
    const G = tutorialGame();
    G.powers.ottoman.cp = 1;
    if (withBeacon) G.powers.spain.cards.push("vq-014");
    G.seaZones.aegean.naval.ottoman = {galley: 2, galleon: 0, racebuilt: 0, corsair: 0};
    expect(moveNaval(G, context([], ownerOf(G, "ottoman")!), {from: "aegean", to: "ionian"})).toBeUndefined();
    return G;
};

const optionIds = (G: VQGame): string[] => interceptionOptions(G).map((entry) => entry.id);

/** Resolve the battle to its dice-roll step (defend -> attacker cards -> defender cards). */
const rollBattle = (G: VQGame): void => {
    const spain = ownerOf(G, "spain")!;
    const ottoman = ownerOf(G, "ottoman")!;
    expect(chooseBattle(G, context([], spain), {choice: "fight"})).toBeUndefined();
    expect(chooseBattle(G, context([], ottoman), {choice: "done"})).toBeUndefined();
    expect(chooseBattle(G, context([], spain), {choice: "done"})).toBeUndefined();
};

/** Select the Messina stack; a home-port stack holding #14 pauses on beaconResponse. */
const chooseMessina = (G: VQGame): Ctx => {
    const spain = ownerOf(G, "spain")!;
    const ctx = context([], spain);
    expect(chooseInterception(G, ctx, {choice: "intercept:messina"})).toBeUndefined();
    return ctx;
};

describe("Beacon Fires (#14) in the two-player tutorial", () => {
    it("pauses on the shared beacon response for a home-port interception before anything is played", () => {
        const G = sailIntoIonian();
        const spain = ownerOf(G, "spain")!;

        expect(G.pendingIntercept?.phase).toBe("naval");
        expect(optionIds(G)).toEqual(expect.arrayContaining(["intercept:messina", "done"]));
        // No separate interceptChoice option: the shared response stage decides.
        expect(optionIds(G).some((id) => id.startsWith("beacon:"))).toBe(false);
        expect(G.pendingBeacon).toBeUndefined();

        const ctx = chooseMessina(G);

        expect(G.pendingBeacon).toEqual({
            power: "ottoman",
            defender: "spain",
            from: "messina",
            moveFrom: "aegean",
            to: "ionian",
            destinationHadEnemy: false,
        });
        expect(ctx.events!.setActivePlayers).toHaveBeenCalledWith({value: {[spain]: "beaconResponse"}});
        // Offering is not playing: nothing is rolled, moved or consumed yet.
        expect(G.pendingIntercept).toBeDefined();
        expect(G.pendingIntercept!.attempted).toEqual([]);
        expect(G.pendingBattle).toBeUndefined();
        expect(G.powers.spain.cards).toContain("vq-014");
        expect(G.discard).not.toContain("vq-014");
        expect(G.lastRolls).toBeFalsy();
        expect(G.log.join("\n")).not.toContain("Interception from");
        // The tutorial lesson follows the same stage instead of the choice list.
        expect(tutorialLesson(G, "action")).toMatchObject({title: "响应：是否打出烽火", power: "spain"});
    });

    it("plays it for an automatic interception and two extra naval battle dice", () => {
        const G = sailIntoIonian();
        const spain = ownerOf(G, "spain")!;
        chooseMessina(G);

        const ctx = beaconContext(G);
        expect(respondBeaconFires(G, ctx, {choice: "play"})).toBeUndefined();

        // The interception succeeds without a roll and the card is consumed.
        expect(G.pendingBeacon).toBeUndefined();
        expect(G.pendingIntercept).toBeUndefined();
        expect(G.pendingBattle).toMatchObject({
            phase: "naval", location: "ionian", attacker: "ottoman", defender: "spain",
            intercepted: true, step: "defend",
        });
        expect(ctx.events!.endStage).toHaveBeenCalled();
        expect(G.powers.spain.cards).not.toContain("vq-014");
        expect(G.discard).toContain("vq-014");
        expect(G.log.join("\n")).toContain("plays Beacon Fires: interception succeeds automatically.");
        expect(G.log.join("\n")).toContain("intercepts the naval move into ionian");
        expect(G.log.join("\n")).not.toContain("Interception from");
        expect(G.lastRolls).toBeFalsy();
        // Same transient bonus field as the full-game response window.
        expect(G.navalDiceBonus).toEqual({power: "spain", amount: 2});
        // The bonus is no longer smuggled in as a played Combat card.
        expect(G.pendingBattle!.cards.spain).toBeUndefined();

        // Spain's two galleys roll 2 dice each in a Mediterranean sea zone,
        // plus Beacon Fires' 2 = 6.  The Ottoman rolls its normal 4.
        rollBattle(G);
        expect(G.pendingBattle!.rolls!.defender).toHaveLength(6);
        expect(G.pendingBattle!.rolls!.attacker).toHaveLength(4);
        expect(G.navalDiceBonus).toBeUndefined();
    });

    it("keeps the card and resolves an ordinary roll when the response is declined", () => {
        const G = sailIntoIonian();
        const spain = ownerOf(G, "spain")!;
        chooseMessina(G);

        const ctx = beaconContext(G, [6, 6], spain);
        expect(respondBeaconFires(G, ctx, {choice: "decline"})).toBeUndefined();

        expect(G.pendingBeacon).toBeUndefined();
        expect(G.pendingIntercept).toBeUndefined();
        expect(G.pendingBattle).toMatchObject({phase: "naval", location: "ionian", intercepted: true});
        expect(G.powers.spain.cards).toContain("vq-014");
        expect(G.discard).not.toContain("vq-014");
        expect(G.navalDiceBonus).toBeUndefined();
        expect(G.log.join("\n")).toContain("declines Beacon Fires.");
        expect(G.log.join("\n")).toContain("Interception from messina");
        expect(G.log.join("\n")).not.toContain("plays Beacon Fires");

        rollBattle(G);
        // No bonus: the two galleys keep their normal 4 dice.
        expect(G.pendingBattle!.rolls!.defender).toHaveLength(4);
        expect(G.pendingBattle!.rolls!.attacker).toHaveLength(4);
    });

    it("reopens the choice for the next home-port stack after a failed decline", () => {
        const G = sailIntoIonian();
        // A second Spanish home-port fleet within reach of the Ionian Sea.
        G.spaces.malta.naval.spain = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
        const spain = ownerOf(G, "spain")!;

        expect(optionIds(G)).toEqual(expect.arrayContaining(["intercept:messina", "intercept:malta"]));
        chooseMessina(G);

        const ctx = beaconContext(G, [1, 1], spain);
        expect(respondBeaconFires(G, ctx, {choice: "decline"})).toBeUndefined();

        // The declined roll failed, so the interception choice stays open.
        expect(G.pendingBeacon).toBeUndefined();
        expect(G.pendingIntercept).toBeDefined();
        expect(G.pendingBattle).toBeUndefined();
        expect(G.interceptedThisImpulse?.spaces).toContain("messina");
        expect(ctx.events!.setActivePlayers).toHaveBeenCalledWith({value: {[spain]: "interceptChoice"}});
        const ids = optionIds(G);
        expect(ids).not.toContain("intercept:messina");
        expect(ids).toContain("intercept:malta");

        // The remaining home-port stack gets its own #14 response window.
        expect(chooseInterception(G, context([], spain), {choice: "intercept:malta"})).toBeUndefined();
        expect(G.pendingBeacon).toMatchObject({from: "malta"});
        expect(G.powers.spain.cards).toContain("vq-014");
    });

    it("does not offer the response for a fleet outside its home port", () => {
        const G = tutorialGame();
        G.powers.ottoman.cp = 1;
        G.powers.spain.cards.push("vq-014");
        G.seaZones.aegean.naval.ottoman = {galley: 2, galleon: 0, racebuilt: 0, corsair: 0};
        // Move the Spanish fleet out of Messina into the Adriatic Sea.
        delete G.spaces.messina.naval.spain;
        G.seaZones.adriatic.naval.spain = {galley: 2, galleon: 0, racebuilt: 0, corsair: 0};

        expect(moveNaval(G, context([], ownerOf(G, "ottoman")!), {from: "aegean", to: "ionian"})).toBeUndefined();

        const ids = optionIds(G);
        expect(ids).toContain("intercept:adriatic");
        expect(ids).not.toContain("beacon:adriatic");

        // A fleet at sea rolls normally: there is no #14 response window.
        expect(chooseInterception(G, context([6, 6], ownerOf(G, "spain")!), {choice: "intercept:adriatic"})).toBeUndefined();
        expect(G.pendingBeacon).toBeUndefined();
        expect(G.pendingBattle).toMatchObject({phase: "naval", location: "ionian", intercepted: true});
        expect(G.powers.spain.cards).toContain("vq-014");
    });

    it("does not offer the response without the card in hand", () => {
        const G = sailIntoIonian(false);

        const ids = optionIds(G);
        expect(ids).toContain("intercept:messina");
        expect(ids).not.toContain("beacon:messina");

        expect(chooseInterception(G, context([6, 6], ownerOf(G, "spain")!), {choice: "intercept:messina"})).toBeUndefined();
        expect(G.pendingBeacon).toBeUndefined();
        expect(G.pendingBattle).toMatchObject({phase: "naval", location: "ionian", intercepted: true});
    });

    it("rejects the interception and the response from the wrong power", () => {
        const G = sailIntoIonian();
        const spain = ownerOf(G, "spain")!;
        const ottoman = ownerOf(G, "ottoman")!;

        // Only the intercepting power owns the response window.
        expect(chooseInterception(G, context([], ottoman), {choice: "intercept:messina"})).toBe(INVALID_MOVE);
        expect(G.pendingBeacon).toBeUndefined();
        expect(G.powers.spain.cards).toContain("vq-014");
        expect(G.navalDiceBonus).toBeUndefined();

        chooseMessina(G);
        // The tutorial path uses the same respondBeaconFires move and guards.
        expect(respondBeaconFires(G, context([], spain), {choice: "play"})).toBe(INVALID_MOVE);
        expect(respondBeaconFires(G, beaconContext(G, [], ottoman), {choice: "decline"})).toBe(INVALID_MOVE);
        expect(G.pendingBeacon).toBeDefined();

        // A stale response cannot play a card that is no longer held.
        G.powers.spain.cards = G.powers.spain.cards.filter((id) => id !== "vq-014");
        expect(respondBeaconFires(G, beaconContext(G, [], spain), {choice: "play"})).toBe(INVALID_MOVE);
        expect(G.pendingBeacon).toBeDefined();
        expect(G.pendingIntercept).toBeDefined();
        expect(G.pendingIntercept!.attempted).toEqual([]);
        expect(G.navalDiceBonus).toBeUndefined();
    });
});
