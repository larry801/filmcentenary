import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {INVALID_MOVE} from "boardgame.io/core";
import {VirginQueenGameDef} from "./game";
import {SCENARIO_OPTIONS, seatLabels, validateSetupData} from "./configuration";
import {canActivateMajor, controlledPowers, isActivatedMajor, ownerOf, participatingPowers} from "./ownership";
import {scenarioSetup} from "./scenario";
import {chooseMajorActivation, declareWar} from "./moves";
import {atWar, checkVictory, powerVp, setupGame} from "./util";

/**
 * Scenario Book p. 12: the 3-player Campaign seats Spain, England+Protestant
 * and France.  The Ottoman starts as England's activated ally; the Holy Roman
 * Empire starts inactive and is activated through diplomacy.  The printed
 * card/patronage/royal/sea-captain removals are the same list as the 2-player
 * configuration, but France keeps its influence marker in the Ottoman column.
 */
const context = (numPlayers = 3): Ctx => ({
    numPlayers,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

const threePlayerGame = () => setupGame(context(), {scenario: "campaign"});

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

describe("three-player campaign setup", () => {
    it("seats Spain, England+Protestant and France with the Ottoman pre-activated", () => {
        expect(validateSetupData({scenario: "campaign"}, 3)).toBeUndefined();
        expect(SCENARIO_OPTIONS.find((entry) => entry.id === "campaign")!.players).toContain(3);
        expect(seatLabels("campaign", 3)).toEqual(["西班牙", "英格兰 / 新教联盟", "法国"]);

        const G = threePlayerGame();
        expect(G.scenario).toBe("campaign");
        expect(G.playerPowers).toEqual({
            "0": ["spain"], "1": ["england", "protestant"], "2": ["france"],
        });
        expect(G.activatedMajors!.ottoman).toEqual({ally: "england", baseline: powerVp(G, "ottoman")});
        expect(G.activatedMajors!.hre).toBeUndefined();
        expect(participatingPowers(G)).toEqual(["ottoman", "spain", "england", "france", "protestant"]);
        expect(ownerOf(G, "ottoman")).toBe("1");
        expect(ownerOf(G, "spain")).toBe("0");
        expect(ownerOf(G, "england")).toBe("1");
        expect(ownerOf(G, "france")).toBe("2");
        expect(ownerOf(G, "protestant")).toBe("1");
        expect(ownerOf(G, "hre")).toBeUndefined();
        expect(controlledPowers(G, "0")).toEqual(["spain"]);
        expect(controlledPowers(G, "1")).toEqual(["ottoman", "england", "protestant"]);
        expect(controlledPowers(G, "2")).toEqual(["france"]);
        expect(G.powers.hre.cards).toEqual([]);
        expect(G.activePower).toBe("ottoman");
        expect(checkVictory(G)).toBeUndefined();
    });

    it("keeps the Ottoman influence track and makes only the HRE activatable", () => {
        const G = threePlayerGame();
        expect(isActivatedMajor(G, "ottoman")).toBe(true);
        expect(isActivatedMajor(G, "hre")).toBe(true);
        expect(canActivateMajor(G, "hre")).toBe(true);
        expect(G.majorInfluence!.ottoman).toEqual({spain: 1, england: 0, france: 0, protestant: 0});
        expect(G.majorInfluence!.hre).toEqual({ottoman: 3, spain: 1, england: 1, france: 1, protestant: 1});
    });

    it("applies the printed three-player card, royal and patronage removals", () => {
        const setup = scenarioSetup("campaign", 3);
        for (const number of [4, 37]) {
            expect(setup.cardsInPlay).toContain(number);
            expect(setup.cardsRemoved).not.toContain(number);
        }
        for (const number of [1, 2, 34, 35, 72, 73]) {
            expect(setup.cardsInPlay).not.toContain(number);
            expect(setup.cardsRemoved).toContain(number);
        }
        expect(setup.royals.some((royal) => royal.nameEn === "Rudolf II")).toBe(false);
        for (const award of ["suleimaniyeMosque", "elegyForSuleiman", "vertumnus", "lawsPlanetaryMotion", "mirrorOfCountries"]) {
            expect(setup.patronage.vpAwards).not.toContain(award);
        }
        expect(setup.patronage.scienceBonuses).not.toContain("excavation");
        for (const patron of ["sinan", "seydiAliReis", "taqiAlDin", "baki", "mercator", "arcimboldo", "brahe", "spranger", "kepler"]) {
            expect(setup.patronage.artists).not.toContain(patron);
            expect(setup.patronage.scientists).not.toContain(patron);
        }
        const seaCaptains = Object.values(setup.powerCard).flatMap((card) => card.seaCaptains ?? []);
        expect(seaCaptains).not.toContain("muratReis");
        expect(seaCaptains).not.toContain("henszlein");

        const G = threePlayerGame();
        expect([...G.deck, ...G.futureDeck]).toEqual(expect.arrayContaining(["vq-004", "vq-037"]));
        for (const id of ["vq-001", "vq-002", "vq-034", "vq-035", "vq-072", "vq-073"]) {
            expect(G.removed).toContain(id);
        }
    });

    it("gives every participating power a national turn in impulse order", () => {
        const client = Client({game: VirginQueenGameDef, numPlayers: 3});
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
            expect(seats).toEqual(["1", "0", "1", "2", "1"]);
            expect(client.getState()!.ctx.phase).toBe("diplomacy");
        } finally {
            client.stop();
        }
    });
});

describe("three-player HRE activation through a declaration of war", () => {
    it("resolves the HRE diplomatic check and hands control to England", () => {
        const G = threePlayerGame();
        // Cards are dealt in the Card Draw phase; seed England's hand so the
        // activation card-deal cap is meaningful in this isolated diplomacy test.
        G.powers.england.cards = ["vq-009", "vq-010"];
        G.powers.spain.treasures = [3];
        G.activePower = "spain";
        G.majorInfluence!.hre = {ottoman: 0, spain: 0, england: 5, france: 0, protestant: 0};
        const events = eventsMock();

        expect(declareWar(G, diplomacyContext("0", events), {target: "hre"})).toBeUndefined();

        expect(G.pendingActivation).toEqual({power: "hre", ally: "england", aggressor: "spain"});
        expect(events.setActivePlayers).toHaveBeenCalledWith({value: {"1": "activateMajor"}});
        expect(ownerOf(G, "hre")).toBeUndefined();
        expect(atWar(G, "spain", "hre")).toBe(true);

        // The French seat does not control the winning ally.
        expect(chooseMajorActivation(G, diplomacyContext("2", events), {})).toBe(INVALID_MOVE);
        expect(ownerOf(G, "hre")).toBeUndefined();

        expect(chooseMajorActivation(G, diplomacyContext("1", events), {})).toBeUndefined();

        expect(ownerOf(G, "hre")).toBe("1");
        expect(G.activatedMajors!.hre!.ally).toBe("england");
        expect(G.activatedMajors!.hre!.baseline).toBeGreaterThan(0);
        expect(isActivatedMajor(G, "hre")).toBe(true);
        expect(participatingPowers(G)).toContain("hre");
        expect(G.powers.hre.cards).toHaveLength(2);
        expect(G.majorDiplomacyResolved).toContain("hre");
        expect(events.endStage).toHaveBeenCalled();
    });
});
