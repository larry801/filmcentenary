import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {INVALID_MOVE} from "boardgame.io/core";
import {VirginQueenGameDef} from "./game";
import {SCENARIO_OPTIONS, seatLabels, validateSetupData} from "./configuration";
import {canActivateMajor, controlledPowers, isActivatedMajor, ownerOf, participatingPowers, playerCount} from "./ownership";
import {scenarioSetup} from "./scenario";
import {cardById} from "./constant/cards";
import {Power} from "./constant/general";
import {chooseMajorActivation, declareWar, endImpulse, playCard} from "./moves";
import {atWar, checkVictory, homeCardChoiceRequired, powerVp, setupGame} from "./util";

/**
 * Scenario Book (2024 Living) pp. 8-12:
 *
 * - p. 9, Tournament "Cards in Play": games with fewer than six players are
 *   referred to "Games with 2 to 5 players" below.
 * - p. 10, Tournament Special Rule 1: the Morisco unrest choice goes to
 *   "England if the Ottoman is inactive in a 4-player game", explicitly
 *   contemplating a four-player Tournament.
 * - pp. 11-12, four-player configuration: Spain, England, France and the
 *   Protestant; the Ottoman starts as England's activated ally; the HRE starts
 *   inactive; #4 German Intervention and #37 The Sublime Porte are added; the
 *   same card/royal/patronage/sea-captain removals as 2- and 3-player games.
 *
 * The Tournament setup itself supplies the Turn 3-6 board, the pre-played
 * Morisco Revolt (#28), and the #11/#58 removals.
 */
const context = (numPlayers = 4): Ctx => ({
    numPlayers,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

const fourPlayerTournament = () => setupGame(context(), {scenario: "tournament"});

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

describe("four-player Tournament setup", () => {
    it("is offered as an official four-player configuration", () => {
        expect(SCENARIO_OPTIONS.find((entry) => entry.id === "tournament")!.players).toEqual([2, 4, 5, 6]);
        expect(validateSetupData({scenario: "tournament"}, 4)).toBeUndefined();
        // Existing five- and six-player support is unchanged.
        expect(validateSetupData({scenario: "tournament"}, 5)).toBeUndefined();
        expect(validateSetupData({scenario: "tournament"}, 6)).toBeUndefined();
        // Three-player Tournament remains outside the official configuration list.
        expect(validateSetupData({scenario: "tournament"}, 3)).toContain("2、4、5、6");
        expect(seatLabels("tournament", 4)).toEqual(["西班牙", "英格兰", "法国", "新教联盟"]);
    });

    it("seats four players and starts the Ottoman as England's activated ally", () => {
        const G = fourPlayerTournament();
        expect(G.scenario).toBe("tournament");
        expect(playerCount(G)).toBe(4);
        expect(G.startTurn).toBe(3);
        expect(G.endTurn).toBe(6);
        expect(G.year).toBe(3);
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
        expect(controlledPowers(G, "1")).toEqual(["ottoman", "england"]);
        expect(isActivatedMajor(G, "ottoman")).toBe(true);
        expect(isActivatedMajor(G, "hre")).toBe(true);
        expect(canActivateMajor(G, "ottoman")).toBe(true);
        expect(canActivateMajor(G, "hre")).toBe(true);
        expect(G.activePower).toBe("ottoman");
        expect(G.powers.ottoman.cards).toEqual([]);
        expect(G.powers.hre.cards).toEqual([]);
        expect(checkVictory(G)).toBeUndefined();

        // Printed four-player influence tracks (Scenario Book p. 12), including
        // the French column on the Ottoman track that 2-player games omit.
        expect(G.majorInfluence).toEqual({
            ottoman: {england: 0, france: 0, protestant: 0, spain: 1},
            hre: {ottoman: 3, spain: 1, england: 1, france: 1, protestant: 1},
        });
    });

    it("keeps the printed Tournament board and Turn 3 VP track", () => {
        const G = fourPlayerTournament();
        expect(G.protestantSpacesStart).toBe(30);
        expect(G.espionage.mary).toBe("captured");
        expect(G.morisco).toEqual({space: "granada", units: 2});
        expect(G.spaces.granada.unrest).toBe(true);
        expect(G.spaces.granada.land.ottoman).toEqual({regular: 2, merc: 0, cav: 0});
        // Istanbul is at the reduced Turn 3 strength, not the Campaign setup.
        expect(G.spaces.istanbul.land.ottoman).toEqual({regular: 6, merc: 0, cav: 1});
        expect(G.spaces.istanbul.naval.ottoman).toEqual({galley: 5, galleon: 0, racebuilt: 0, corsair: 0});
        expect(G.spaces.vienna.land.hre).toEqual({regular: 2, merc: 2, cav: 0});
        expect(G.spaces.vienna.leaders).toContain("schwendi");
        expect(G.spaces.london.leaders).toContain("leicester");
        expect(G.spaces.edinburgh.land.scotland).toEqual({regular: 2, merc: 0, cav: 0});

        const startVp: Record<Power, number> = {
            ottoman: 14, spain: 15, england: 11, france: 10, hre: 8, protestant: 10,
        };
        for (const [power, vp] of Object.entries(startVp)) {
            expect(powerVp(G, power as Power)).toBe(vp);
        }
    });

    it("applies the printed four-player additions and removals", () => {
        const setup = scenarioSetup("tournament", 4);
        const printedRemovals = [1, 2, 11, 34, 35, 58, 72, 73];
        expect(setup.cardsRemoved).toEqual(printedRemovals);
        expect(setup.cardsInPlay).toHaveLength(104);
        for (const number of printedRemovals) {
            expect(setup.cardsInPlay).not.toContain(number);
        }
        // Four-player cards added to play (#4/#37) override the 6-player removals.
        for (const number of [4, 37]) {
            expect(setup.cardsInPlay).toContain(number);
            expect(setup.cardsRemoved).not.toContain(number);
        }
        expect(setup.royals.some((royal) => royal.nameEn === "Rudolf II")).toBe(false);
        for (const patron of ["sinan", "seydiAliReis", "taqiAlDin", "baki", "mercator",
            "arcimboldo", "brahe", "spranger", "kepler"]) {
            expect(setup.patronage.artists).not.toContain(patron);
            expect(setup.patronage.scientists).not.toContain(patron);
        }
        for (const award of ["suleimaniyeMosque", "elegyForSuleiman", "vertumnus",
            "lawsPlanetaryMotion", "mirrorOfCountries", "fightBetweenCarnivalAndLent"]) {
            expect(setup.patronage.vpAwards).not.toContain(award);
        }
        expect(setup.patronage.scienceBonuses).not.toContain("excavation");
        const seaCaptains = Object.values(setup.powerCard).flatMap((card) => card.seaCaptains ?? []);
        expect(seaCaptains).not.toContain("muratReis");
        expect(seaCaptains).not.toContain("henszlein");

        const G = fourPlayerTournament();
        expect([...G.deck, ...G.futureDeck]).toContain("vq-004");
        expect([...G.deck, ...G.futureDeck]).toContain("vq-037");
        expect(G.removed).toHaveLength(8);
        for (const id of ["vq-001", "vq-002", "vq-011", "vq-034", "vq-035",
            "vq-058", "vq-072", "vq-073"]) {
            expect(G.removed).toContain(id);
        }

        // Existing five- and six-player Tournament removal lists are unchanged.
        expect(scenarioSetup("tournament", 5).cardsRemoved).toEqual([11, 34, 35, 37, 58, 72]);
        expect(scenarioSetup("tournament", 6).cardsRemoved).toEqual([4, 11, 37, 58]);
        // Four-player Campaign remains on its own list.
        expect(scenarioSetup("campaign", 4).cardsRemoved).toEqual([1, 2, 34, 35, 72, 73]);
    });

    it("runs five national turns in impulse order and skips the inactive HRE", () => {
        const game = {...VirginQueenGameDef, setup: (ctx: Ctx) => setupGame(ctx, {scenario: "tournament"})};
        const client = Client({game, numPlayers: 4});
        client.start();
        const cardDraw: string[] = [];
        const cardDrawSeats: string[] = [];
        try {
            for (let index = 0; index < 5; index++) {
                const state = client.getState()!;
                expect(state.ctx.phase).toBe("cardDraw");
                cardDraw.push(state.G.activePower);
                cardDrawSeats.push(state.ctx.currentPlayer);
                expect(ownerOf(state.G, state.G.activePower)).toBe(state.ctx.currentPlayer);
                client.updatePlayerID(state.ctx.currentPlayer);
                client.moves.endPhaseTurn();
            }
            expect(cardDraw).toEqual(["ottoman", "spain", "england", "france", "protestant"]);
            expect(cardDrawSeats).toEqual(["1", "0", "1", "2", "3"]);
            expect(client.getState()!.ctx.phase).toBe("diplomacy");

            for (const phase of ["diplomacy", "spring"] as const) {
                for (let index = 0; index < 5; index++) {
                    const state = client.getState()!;
                    expect(state.ctx.phase).toBe(phase);
                    expect(state.G.activePower).toBe(["ottoman", "spain", "england", "france", "protestant"][index]);
                    client.updatePlayerID(state.ctx.currentPlayer);
                    const seatState = client.getState()!;
                    if (phase === "spring" && homeCardChoiceRequired(seatState.G, seatState.G.activePower)) {
                        const home = seatState.G.powers[seatState.G.activePower].cards.find((id) => cardById(id).kind === "home");
                        expect(home).toBeDefined();
                        client.moves.chooseHomeCard({cardId: home!});
                    }
                    client.moves.endPhaseTurn();
                }
            }

            const action = client.getState()!;
            expect(action.ctx.phase).toBe("action");
            expect(action.G.activePower).toBe("ottoman");
            expect(action.ctx.currentPlayer).toBe("1");
            expect(ownerOf(action.G, "ottoman")).toBe("1");
            client.updatePlayerID(action.ctx.currentPlayer);
            const actionSeat = client.getState()!;

            // The Ottoman is England's activated major, so the first action
            // turn belongs to seat 1; after it, the impulse passes to Spain.
            const playable = actionSeat.G.powers.ottoman.cards.find((id) => cardById(id).officialKind !== "mandatory");
            expect(playable).toBeDefined();
            client.moves.playCard({cardId: playable!});
            expect(client.getState()!.G.powers.ottoman.cp).toBeGreaterThan(0);
            client.moves.endImpulse();
            const nextTurn = client.getState()!;
            expect(nextTurn.G.activePower).toBe("spain");
            expect(nextTurn.ctx.currentPlayer).toBe("0");
            expect(ownerOf(nextTurn.G, "spain")).toBe("0");
        } finally {
            client.stop();
        }
    });
});

describe("four-player Tournament HRE activation", () => {
    it("resolves the four-player HRE check and hands it to England", () => {
        const G = fourPlayerTournament();
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

        // Only the winning ally's seat may choose the activation options.
        expect(chooseMajorActivation(G, diplomacyContext("0", events), {})).toBe(INVALID_MOVE);
        expect(chooseMajorActivation(G, diplomacyContext("1", events), {})).toBeUndefined();
        expect(ownerOf(G, "hre")).toBe("1");
        expect(G.activatedMajors!.hre!.ally).toBe("england");
        expect(participatingPowers(G)).toContain("hre");
        expect(G.powers.hre.cards).toHaveLength(2);
        expect(G.majorDiplomacyResolved).toContain("hre");
        expect(events.endStage).toHaveBeenCalled();
    });
});
