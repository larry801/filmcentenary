import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {chooseMajorActivation, declareWar} from "./moves";
import {ownerOf} from "./ownership";
import {
    activateMajor,
    deactivateMajor,
    powerVp,
    resolveMajorDiplomacy,
    settleActivatedMajorVp,
    setupGame,
} from "./util";

/**
 * Two-player games are the currently supported Activated Major Power variant:
 * Spain/France vs England/Protestant, with the Ottoman starting as England's
 * ally and the Holy Roman Empire inactive.
 *
 * Scenario Book p. 13 adds a rule that only applies when a declaration of war
 * triggers the diplomatic check: "Remove the power declaring war and any power
 * listed as a 'Deactivate' power from those considered during this Diplomatic
 * Status check."  The winner then becomes the major's controlling ally instead
 * of deactivating it.
 */
const baseContext = (): Ctx => ({
    numPlayers: 2,
    currentPlayer: "0",
    playerID: "0",
    phase: "diplomacy",
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

interface Events {
    setActivePlayers: jest.Mock;
    endStage: jest.Mock;
}

const eventsMock = (): Events => ({setActivePlayers: jest.fn(), endStage: jest.fn()});

const diplomacyContext = (playerID: string, events: Events): Ctx => ({
    ...baseContext(),
    currentPlayer: playerID,
    playerID,
    events,
} as unknown as Ctx);

const warGame = (): VQGame => {
    const G = setupGame(baseContext());
    G.activePower = "spain";
    return G;
};

const finishActivation = (G: VQGame, playerID: string, events: Events) =>
    chooseMajorActivation(G, {...baseContext(), currentPlayer: playerID, playerID, events}, {});

describe("Activated Major Power control after a declaration of war", () => {
    it("removes the Deactivate power from a DOW-triggered check", () => {
        const G = warGame();
        // The Ottoman (a HRE Deactivate power) would win on influence alone.
        G.majorInfluence!.hre!.ottoman = 9;
        G.majorInfluence!.hre!.england = 5;
        G.majorInfluence!.hre!.france = 0;
        G.majorInfluence!.hre!.protestant = 0;
        G.majorInfluence!.hre!.spain = 0;
        const events = eventsMock();

        expect(declareWar(G, diplomacyContext("0", events), {target: "hre"})).toBeUndefined();

        // England (5 + 3) beats France/Protestant (3) once the Ottoman is removed.
        expect(G.pendingActivation).toEqual({power: "hre", ally: "england", aggressor: "spain"});
        expect(events.setActivePlayers).toHaveBeenCalledWith({value: {"1": "activateMajor"}});
        expect(ownerOf(G, "hre")).toBeUndefined();
    });

    it("also removes the aggressor from the same check", () => {
        const G = warGame();
        G.majorInfluence!.hre!.spain = 9;
        G.majorInfluence!.hre!.ottoman = 9;
        G.majorInfluence!.hre!.england = 2;
        G.majorInfluence!.hre!.france = 0;
        G.majorInfluence!.hre!.protestant = 0;
        const events = eventsMock();

        expect(declareWar(G, diplomacyContext("0", events), {target: "hre"})).toBeUndefined();

        // Only England/France/Protestant remain; England wins with 5 vs 3/3.
        expect(G.pendingActivation).toEqual({power: "hre", ally: "england", aggressor: "spain"});
    });

    it("hands control and the war to the winning ally when activation completes", () => {
        const G = warGame();
        const events = eventsMock();
        expect(declareWar(G, diplomacyContext("0", events), {target: "hre"})).toBeUndefined();

        expect(events.setActivePlayers).toHaveBeenCalledWith({value: {"1": "activateMajor"}});
        expect(finishActivation(G, "1", events)).toBeUndefined();

        expect(ownerOf(G, "hre")).toBe("1");
        expect(G.activatedMajors!.hre!.ally).toBe("england");
        expect(G.powers.hre.wars).toContain("spain");
        expect(G.powers.spain.wars).toContain("hre");
        expect(events.endStage).toHaveBeenCalled();
    });

    it("keeps the existing ally when an already-controlled major is attacked", () => {
        const G = warGame();
        expect(activateMajor(G, diplomacyContext("0", eventsMock()), "hre", "spain")).toBe(true);
        expect(ownerOf(G, "hre")).toBe("0");
        G.activePower = "england";
        // War declarations are paid with cards or treasures (rule 9.4).
        G.powers.england.treasures = [3];

        expect(declareWar(G, diplomacyContext("1", eventsMock()), {target: "hre"})).toBeUndefined();

        expect(G.pendingActivation).toBeUndefined();
        expect(ownerOf(G, "hre")).toBe("0");
        expect(G.activatedMajors!.hre!.ally).toBe("spain");
        expect(G.powers.hre.wars).toContain("england");
    });
});

describe("Activated Major Power diplomacy and VP settlement", () => {
    it("still lets a Deactivate power win an event-driven status check", () => {
        const G = warGame();
        const events = eventsMock();

        resolveMajorDiplomacy(G, diplomacyContext("0", events), "hre");

        expect(events.setActivePlayers).not.toHaveBeenCalled();
        expect(G.pendingActivation).toBeUndefined();
        expect(G.activatedMajors?.hre).toBeUndefined();
        expect(G.majorDiplomacyResolved).toContain("hre");
        expect(G.log.join("\n")).toContain("diplomacy");
    });

    it("settles changed VP to the new controlling ally on deactivation", () => {
        const G = warGame();
        expect(activateMajor(G, diplomacyContext("0", eventsMock()), "hre", "england")).toBe(true);
        const before = powerVp(G, "england");

        G.powers.hre.bonusVp += 5;
        settleActivatedMajorVp(G);
        expect(powerVp(G, "england")).toBe(before + 2);

        G.powers.hre.bonusVp -= 4;
        settleActivatedMajorVp(G);
        expect(powerVp(G, "england")).toBe(before + 1);

        deactivateMajor(G, "hre");
        expect(ownerOf(G, "hre")).toBeUndefined();
        expect(G.powers.hre.cards).toEqual([]);
    });
});
