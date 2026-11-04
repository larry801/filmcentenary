import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {VirginQueenGameDef} from "./game";
import {SCENARIO_OPTIONS, seatLabels, validateSetupData} from "./configuration";
import {canActivateMajor, controlledPowers, isActivatedMajor, ownerOf, participatingPowers, playerCount} from "./ownership";
import {scenarioSetup} from "./scenario";
import {chooseMajorActivation, declareWar} from "./moves";
import {atWar, checkVictory, powerVp, setupGame, winter} from "./util";

/**
 * Scenario Book p. 12: the four-player Campaign seats Spain, England, France
 * and the Protestant.  The Ottoman starts as England's activated ally and the
 * Holy Roman Empire starts inactive, exactly as in the two-player variant; the
 * four-player component-removal list is the same as the two-player list.
 */
const context = (numPlayers = 4): Ctx => ({
    numPlayers,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

const fourPlayerGame = () => setupGame(context(), {scenario: "campaign"});

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

describe("four-player campaign setup", () => {
    it("is an official campaign option with four labelled seats", () => {
        expect(validateSetupData({scenario: "campaign"}, 4)).toBeUndefined();
        expect(SCENARIO_OPTIONS.find((entry) => entry.id === "campaign")!.players).toEqual([2, 3, 4, 5, 6]);
        expect(seatLabels("campaign", 4)).toEqual(["西班牙", "英格兰", "法国", "新教联盟"]);
        // The existing two- and five-player seat labels are unchanged.
        expect(seatLabels("campaign", 2)).toEqual(["西班牙 / 法国", "英格兰 / 新教联盟"]);
        expect(seatLabels("campaign", 5)).toEqual(["奥斯曼帝国", "西班牙", "英格兰", "法国", "新教联盟"]);
        // Four-player Tournament support is covered by fourPlayerTournament.test.ts.
        expect(validateSetupData({scenario: "tournament"}, 4)).toBeUndefined();
    });

    it("seats four players, starts the Ottoman as England's ally and leaves the HRE inactive", () => {
        const G = fourPlayerGame();
        expect(G.scenario).toBe("campaign");
        expect(playerCount(G)).toBe(4);
        expect(G.playerPowers).toEqual({
            "0": ["spain"], "1": ["england"], "2": ["france"], "3": ["protestant"],
        });
        expect(G.activatedMajors!.ottoman).toEqual({ally: "england", baseline: powerVp(G, "ottoman")});
        expect(G.activatedMajors!.hre).toBeUndefined();
        expect(participatingPowers(G)).toEqual(["ottoman", "spain", "england", "france", "protestant"]);
        expect(ownerOf(G, "ottoman")).toBe("1");
        expect(ownerOf(G, "spain")).toBe("0");
        expect(ownerOf(G, "england")).toBe("1");
        expect(ownerOf(G, "france")).toBe("2");
        expect(ownerOf(G, "protestant")).toBe("3");
        expect(ownerOf(G, "hre")).toBeUndefined();
        expect(controlledPowers(G, "0")).toEqual(["spain"]);
        expect(controlledPowers(G, "1")).toEqual(["ottoman", "england"]);
        expect(isActivatedMajor(G, "ottoman")).toBe(true);
        expect(isActivatedMajor(G, "hre")).toBe(true);
        expect(canActivateMajor(G, "ottoman")).toBe(true);
        expect(canActivateMajor(G, "hre")).toBe(true);
        expect(G.activePower).toBe("ottoman");
        expect(G.powers.ottoman.cards).toEqual([]);
        expect(G.powers.hre.cards).toEqual([]);
        expect(checkVictory(G)).toBeUndefined();
    });

    it("sets up the printed Ottoman and HRE diplomatic influence tracks", () => {
        const G = fourPlayerGame();
        expect(G.majorInfluence).toEqual({
            ottoman: {england: 0, france: 0, protestant: 0, spain: 1},
            hre: {ottoman: 3, spain: 1, england: 1, france: 1, protestant: 1},
        });
    });

    it("applies the printed four-player card, royal, patronage and sea-captain removals", () => {
        const setup = scenarioSetup("campaign", 4);
        // The four-player list is identical to the two-player component list.
        expect(setup).toEqual(scenarioSetup("campaign", 2));
        for (const number of [1, 2, 34, 35, 72, 73]) {
            expect(setup.cardsRemoved).toContain(number);
            expect(setup.cardsInPlay).not.toContain(number);
        }
        for (const number of [4, 37]) {
            expect(setup.cardsInPlay).toContain(number);
            expect(setup.cardsRemoved).not.toContain(number);
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

        const G = fourPlayerGame();
        for (const id of ["vq-001", "vq-002", "vq-034", "vq-035", "vq-072", "vq-073"]) {
            expect(G.removed).toContain(id);
        }
        expect([...G.deck, ...G.futureDeck]).toContain("vq-004");
        expect([...G.deck, ...G.futureDeck]).toContain("vq-037");
    });

    it("gives each seated power its own national turn and the Ottoman turn to England", () => {
        const client = Client({game: VirginQueenGameDef, numPlayers: 4});
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
            expect(seats).toEqual(["1", "0", "1", "2", "3"]);
            expect(client.getState()!.ctx.phase).toBe("diplomacy");
        } finally {
            client.stop();
        }
    });

    it("keeps the French column on the Ottoman track across the winter reset", () => {
        const G = fourPlayerGame();
        G.majorDiplomacyResolved = ["ottoman"];
        winter(G, context());
        expect(G.majorInfluence!.ottoman).toEqual({spain: 1, england: 0, protestant: 0, france: 0});
        // Two-player still omits the French column.
        const two = setupGame({...context(2), random: {Die: () => 3, Shuffle: (values: unknown[]) => values}} as Ctx);
        two.majorDiplomacyResolved = ["ottoman"];
        winter(two, context(2));
        expect(two.majorInfluence!.ottoman).toEqual({spain: 1, england: 0, protestant: 0});
    });
});

describe("four-player HRE activation through a declaration of war", () => {
    it("resolves the diplomatic check and hands the HRE to England", () => {
        const G = fourPlayerGame();
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

        expect(chooseMajorActivation(G, diplomacyContext("1", events), {})).toBeUndefined();

        expect(ownerOf(G, "hre")).toBe("1");
        expect(G.activatedMajors!.hre!.ally).toBe("england");
        expect(isActivatedMajor(G, "hre")).toBe(true);
        expect(participatingPowers(G)).toContain("hre");
        expect(G.powers.hre.cards).toHaveLength(2);
        expect(G.majorDiplomacyResolved).toContain("hre");
        expect(events.endStage).toHaveBeenCalled();
    });
});
