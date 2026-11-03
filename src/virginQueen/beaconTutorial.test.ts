import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {moveNaval} from "./moves";
import {chooseBattle} from "./combat";
import {chooseInterception, interceptionOptions} from "./interception";
import {ownerOf} from "./ownership";
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

describe("Beacon Fires (#14) in the two-player tutorial", () => {
    it("offers the response for a home-port interception before anything is played", () => {
        const G = sailIntoIonian();

        expect(G.pendingIntercept?.phase).toBe("naval");
        expect(optionIds(G)).toEqual(expect.arrayContaining(["intercept:messina", "beacon:messina"]));
        // Offering is not playing: the card stays in hand and nothing is rolled.
        expect(G.powers.spain.cards).toContain("vq-014");
        expect(G.discard).not.toContain("vq-014");
        expect(G.lastRolls).toBeFalsy();
        expect(G.log.join("\n")).not.toContain("Interception from");
    });

    it("plays it for an automatic interception and two extra naval battle dice", () => {
        const G = sailIntoIonian();
        const spain = ownerOf(G, "spain")!;

        expect(chooseInterception(G, context([], spain), {choice: "beacon:messina"})).toBeUndefined();

        // The interception succeeds without a roll and the card is consumed.
        expect(G.pendingIntercept).toBeUndefined();
        expect(G.pendingBattle).toMatchObject({
            phase: "naval", location: "ionian", attacker: "ottoman", defender: "spain",
            intercepted: true, step: "defend",
        });
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

        // Declining #14 means choosing the ordinary interception option instead.
        expect(chooseInterception(G, context([6, 6], spain), {choice: "intercept:messina"})).toBeUndefined();

        expect(G.pendingIntercept).toBeUndefined();
        expect(G.pendingBattle).toMatchObject({phase: "naval", location: "ionian", intercepted: true});
        expect(G.powers.spain.cards).toContain("vq-014");
        expect(G.discard).not.toContain("vq-014");
        expect(G.navalDiceBonus).toBeUndefined();
        expect(G.log.join("\n")).toContain("Interception from messina");
        expect(G.log.join("\n")).not.toContain("Beacon Fires");

        rollBattle(G);
        // No bonus: the two galleys keep their normal 4 dice.
        expect(G.pendingBattle!.rolls!.defender).toHaveLength(4);
        expect(G.pendingBattle!.rolls!.attacker).toHaveLength(4);
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
        expect(G.powers.spain.cards).toContain("vq-014");
    });

    it("does not offer the response without the card in hand", () => {
        const G = sailIntoIonian(false);

        const ids = optionIds(G);
        expect(ids).toContain("intercept:messina");
        expect(ids).not.toContain("beacon:messina");
    });

    it("rejects the response from the active power and when the card was lost", () => {
        const G = sailIntoIonian();

        // Only the intercepting power owns the response window.
        expect(chooseInterception(G, context([], ownerOf(G, "ottoman")!), {choice: "beacon:messina"})).toBe(INVALID_MOVE);
        expect(G.pendingIntercept).toBeDefined();
        expect(G.powers.spain.cards).toContain("vq-014");
        expect(G.navalDiceBonus).toBeUndefined();

        // A stale option cannot play a card that is no longer held.
        G.powers.spain.cards = G.powers.spain.cards.filter((id) => id !== "vq-014");
        expect(chooseInterception(G, context([], ownerOf(G, "spain")!), {choice: "beacon:messina"})).toBe(INVALID_MOVE);
        expect(G.pendingIntercept).toBeDefined();
        expect(G.pendingIntercept!.attempted).toEqual([]);
        expect(G.navalDiceBonus).toBeUndefined();
    });
});
