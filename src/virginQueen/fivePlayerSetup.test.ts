import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {INVALID_MOVE} from "boardgame.io/core";
import {VirginQueenGameDef} from "./game";
import {SCENARIO_OPTIONS, seatLabels, validateSetupData} from "./configuration";
import {canActivateMajor, controlledPowers, isActivatedMajor, ownerOf, participatingPowers} from "./ownership";
import {scenarioSetup} from "./scenario";
import {chooseMajorActivation, declareWar} from "./moves";
import {atWar, checkVictory, setupGame} from "./util";

/**
 * Scenario Book pp. 12-13: the five-player game seats the Ottoman and leaves
 * the Holy Roman Empire inactive until it is activated through the diplomatic
 * influence track (#4 German Intervention or a declaration of war).
 */
const context = (numPlayers = 5): Ctx => ({
    numPlayers,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

const fivePlayerGame = () => setupGame(context(), {scenario: "campaign"});

interface Events {
    setActivePlayers: jest.Mock;
    endStage: jest.Mock;
}

const eventsMock = (): Events => ({setActivePlayers: jest.fn(), endStage: jest.fn()});

const diplomacyContext = (playerID: string, events: Events): Ctx => ({
    ...context(),
    currentPlayer: playerID,
    playerID,
    phase: "diplomacy",
    events,
} as unknown as Ctx);

describe("five-player campaign setup", () => {
    it("seats one player per power and keeps the HRE inactive", () => {
        expect(validateSetupData({scenario: "campaign"}, 5)).toBeUndefined();
        expect(SCENARIO_OPTIONS.find((entry) => entry.id === "campaign")!.players).toContain(5);
        expect(seatLabels("campaign", 5)).toEqual(["奥斯曼帝国", "西班牙", "英格兰", "法国", "新教联盟"]);

        const G = fivePlayerGame();
        expect(G.scenario).toBe("campaign");
        expect(G.playerPowers).toEqual({
            "0": ["ottoman"], "1": ["spain"], "2": ["england"], "3": ["france"], "4": ["protestant"],
        });
        expect(G.activatedMajors).toEqual({});
        expect(participatingPowers(G)).toEqual(["ottoman", "spain", "england", "france", "protestant"]);
        expect(G.activePower).toBe("ottoman");
        expect(ownerOf(G, "ottoman")).toBe("0");
        expect(ownerOf(G, "spain")).toBe("1");
        expect(ownerOf(G, "england")).toBe("2");
        expect(ownerOf(G, "france")).toBe("3");
        expect(ownerOf(G, "protestant")).toBe("4");
        expect(ownerOf(G, "hre")).toBeUndefined();
        expect(controlledPowers(G, "0")).toEqual(["ottoman"]);
        expect(G.powers.hre.cards).toEqual([]);
        expect(checkVictory(G)).toBeUndefined();
    });

    it("distinguishes the seated Ottoman from the activatable HRE", () => {
        const G = fivePlayerGame();
        expect(isActivatedMajor(G, "ottoman")).toBe(false);
        expect(isActivatedMajor(G, "hre")).toBe(true);
        expect(canActivateMajor(G, "ottoman")).toBe(false);
        expect(canActivateMajor(G, "hre")).toBe(true);
        expect(G.majorInfluence!.hre).toEqual({ottoman: 3, spain: 1, england: 1, france: 1, protestant: 1});
        expect(G.majorInfluence!.ottoman).toBeUndefined();
    });

    it("applies the printed five-player card, royal and patronage removals", () => {
        const setup = scenarioSetup("campaign", 5);
        expect(setup.cardsInPlay).toContain(4);
        expect(setup.cardsRemoved).not.toContain(4);
        for (const number of [34, 35, 37, 72]) {
            expect(setup.cardsInPlay).not.toContain(number);
            expect(setup.cardsRemoved).toContain(number);
        }
        expect(setup.royals.some((royal) => royal.nameEn === "Rudolf II")).toBe(false);
        expect(setup.patronage.vpAwards).not.toContain("vertumnus");
        expect(setup.patronage.vpAwards).not.toContain("lawsPlanetaryMotion");
        for (const patron of ["mercator", "arcimboldo", "brahe", "spranger", "kepler"]) {
            expect(setup.patronage.artists).not.toContain(patron);
            expect(setup.patronage.scientists).not.toContain(patron);
        }
        const seaCaptains = Object.values(setup.powerCard).flatMap((card) => card.seaCaptains ?? []);
        expect(seaCaptains).not.toContain("henszlein");

        const G = fivePlayerGame();
        expect([...G.deck, ...G.futureDeck]).toContain("vq-004");
        expect(G.removed).toContain("vq-034");
        expect(G.removed).toContain("vq-035");
        expect(G.removed).toContain("vq-037");
        expect(G.removed).toContain("vq-072");
    });

    it("gives each seated power its own national turn in impulse order", () => {
        const client = Client({game: VirginQueenGameDef, numPlayers: 5});
        client.start();
        const visited: string[] = [];
        const seats: string[] = [];
        try {
            for (let index = 0; index < 5; index++) {
                const state = client.getState()!;
                expect(state.ctx.phase).toBe("cardDraw");
                visited.push(state.G.activePower);
                seats.push(state.ctx.currentPlayer);
                expect(ownerOf(state.G, state.G.activePower)).toBe(state.ctx.currentPlayer);
                client.moves.endPhaseTurn();
            }
            expect(visited).toEqual(["ottoman", "spain", "england", "france", "protestant"]);
            expect(seats).toEqual(["0", "1", "2", "3", "4"]);
            expect(client.getState()!.ctx.phase).toBe("diplomacy");
        } finally {
            client.stop();
        }
    });
});

describe("five-player HRE activation through a declaration of war", () => {
    it("resolves the HRE diplomatic check and hands control to the winning ally", () => {
        const G = fivePlayerGame();
        // Cards are dealt in the Card Draw phase; seed hands so the activation
        // card-deal cap is meaningful in this isolated diplomacy test.
        G.powers.england.cards = ["vq-009", "vq-010"];
        G.powers.spain.treasures = [3];
        G.activePower = "spain";
        G.majorInfluence!.hre = {ottoman: 0, spain: 0, england: 5, france: 0, protestant: 0};
        const events = eventsMock();

        expect(declareWar(G, diplomacyContext("1", events), {target: "hre"})).toBeUndefined();

        expect(G.pendingActivation).toEqual({power: "hre", ally: "england", aggressor: "spain"});
        expect(events.setActivePlayers).toHaveBeenCalledWith({value: {"2": "activateMajor"}});
        expect(ownerOf(G, "hre")).toBeUndefined();
        expect(atWar(G, "spain", "hre")).toBe(true);

        expect(chooseMajorActivation(G, diplomacyContext("2", events), {})).toBeUndefined();

        expect(ownerOf(G, "hre")).toBe("2");
        expect(G.activatedMajors!.hre!.ally).toBe("england");
        expect(G.activatedMajors!.hre!.baseline).toBeGreaterThan(0);
        expect(isActivatedMajor(G, "hre")).toBe(true);
        expect(participatingPowers(G)).toContain("hre");
        expect(G.powers.hre.cards).toHaveLength(2);
        expect(G.majorDiplomacyResolved).toContain("hre");
        expect(events.endStage).toHaveBeenCalled();
    });

    it("lets the activating player add one war and rejects another player's choice", () => {
        const G = fivePlayerGame();
        G.powers.spain.treasures = [3];
        G.activePower = "spain";
        G.majorInfluence!.hre = {ottoman: 0, spain: 0, england: 5, france: 0, protestant: 0};
        const events = eventsMock();
        expect(declareWar(G, diplomacyContext("1", events), {target: "hre"})).toBeUndefined();

        // The French seat does not control the winning ally.
        expect(chooseMajorActivation(G, diplomacyContext("3", events), {})).toBe(INVALID_MOVE);
        expect(ownerOf(G, "hre")).toBeUndefined();

        expect(chooseMajorActivation(G, diplomacyContext("2", events), {war: "france"})).toBeUndefined();
        expect(ownerOf(G, "hre")).toBe("2");
        expect(atWar(G, "hre", "france")).toBe(true);
    });
});
