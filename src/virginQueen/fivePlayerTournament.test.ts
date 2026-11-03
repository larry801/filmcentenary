import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {INVALID_MOVE} from "boardgame.io/core";
import {VirginQueenGameDef} from "./game";
import {SCENARIO_OPTIONS, seatLabels, validateSetupData} from "./configuration";
import {canActivateMajor, controlledPowers, isActivatedMajor, ownerOf, participatingPowers} from "./ownership";
import {scenarioSetup} from "./scenario";
import {cardById} from "./constant/cards";
import {chooseMajorActivation, declareWar, endImpulse, playCard} from "./moves";
import {atWar, checkVictory, homeCardChoiceRequired, setupGame} from "./util";

/**
 * Scenario Book pp. 8-12 and p. 16: the Tournament scenario is played with
 * five players by seating the Ottoman and leaving the HRE inactive.  The
 * extended example of play explicitly starts "a five-player Tournament
 * Scenario game" on Turn 3 with the printed five-player removals and #4
 * German Intervention added to the deck.
 */
const context = (numPlayers = 5): Ctx => ({
    numPlayers,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

const tournamentGame = () => setupGame(context(), {scenario: "tournament"});

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

describe("five-player Tournament setup", () => {
    it("is offered as an official five-player configuration", () => {
        expect(validateSetupData({scenario: "tournament"}, 5)).toBeUndefined();
        expect(SCENARIO_OPTIONS.find((entry) => entry.id === "tournament")!.players).toContain(5);
        expect(seatLabels("tournament", 5)).toEqual(["奥斯曼帝国", "西班牙", "英格兰", "法国", "新教联盟"]);
        expect(validateSetupData({scenario: "tournament"}, 6)).toBeUndefined();
        expect(validateSetupData({scenario: "tournament"}, 2)).toBeUndefined();
    });

    it("seats one player per power on Turn 3 with the HRE inactive", () => {
        const G = tournamentGame();
        expect(G.scenario).toBe("tournament");
        expect(G.startTurn).toBe(3);
        expect(G.endTurn).toBe(6);
        expect(G.year).toBe(3);
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

        // The inactive HRE keeps its printed Tournament garrison and leader.
        expect(G.spaces.vienna.land.hre).toEqual({regular: 2, merc: 2, cav: 0});
        expect(G.spaces.vienna.leaders).toContain("schwendi");
        expect(G.spaces.prague.land.hre?.regular).toBe(1);
    });

    it("adds German Intervention and applies the combined Tournament/five-player removals", () => {
        const setup = scenarioSetup("tournament", 5);
        for (const number of [11, 34, 35, 37, 58, 72]) {
            expect(setup.cardsInPlay).not.toContain(number);
            expect(setup.cardsRemoved).toContain(number);
        }
        expect(setup.cardsInPlay).toContain(4);
        expect(setup.cardsRemoved).not.toContain(4);
        expect(setup.cardsInPlay).toHaveLength(106);
        expect(setup.cardsRemoved).toEqual([11, 34, 35, 37, 58, 72]);

        expect(setup.royals.some((royal) => royal.nameEn === "Rudolf II")).toBe(false);
        for (const patron of ["mercator", "arcimboldo", "brahe", "spranger", "kepler"]) {
            expect(setup.patronage.artists).not.toContain(patron);
            expect(setup.patronage.scientists).not.toContain(patron);
        }
        for (const award of ["vertumnus", "lawsPlanetaryMotion", "fightBetweenCarnivalAndLent", "elegyForSuleiman"]) {
            expect(setup.patronage.vpAwards).not.toContain(award);
        }
        expect(Object.values(setup.powerCard).flatMap((card) => card.seaCaptains ?? [])).not.toContain("henszlein");

        const G = tournamentGame();
        expect([...G.deck, ...G.futureDeck]).toContain("vq-004");
        for (const id of ["vq-011", "vq-034", "vq-035", "vq-037", "vq-058", "vq-072"]) {
            expect(G.removed).toContain(id);
        }
        expect(G.removed).toHaveLength(6);
    });

    it("applies the five-player HRE influence track and activation state", () => {
        const G = tournamentGame();
        expect(G.majorInfluence!.hre).toEqual({ottoman: 3, spain: 1, england: 1, france: 1, protestant: 1});
        expect(G.majorInfluence!.ottoman).toBeUndefined();
        expect(isActivatedMajor(G, "hre")).toBe(true);
        expect(canActivateMajor(G, "hre")).toBe(true);
        expect(isActivatedMajor(G, "ottoman")).toBe(false);
        expect(canActivateMajor(G, "ottoman")).toBe(false);
        // Mary is captured and Morisco Revolt is on the board as printed.
        expect(G.espionage.mary).toBe("captured");
        expect(G.morisco).toEqual({space: "granada", units: 2});
        expect(G.spaces.granada.land.ottoman?.regular).toBe(2);
    });

    it("runs the five seated national turns in impulse order and skips the HRE", () => {
        const game = {...VirginQueenGameDef, setup: (ctx: Ctx) => setupGame(ctx, {scenario: "tournament"})};
        const client = Client({game, numPlayers: 5});
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
            expect(cardDrawSeats).toEqual(["0", "1", "2", "3", "4"]);
            expect(client.getState()!.ctx.phase).toBe("diplomacy");

            // Drive the remaining pre-action phases so the first national
            // action turn (Ottoman) can be exercised.
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
            expect(action.ctx.currentPlayer).toBe("0");
            expect(ownerOf(action.G, "ottoman")).toBe("0");
            client.updatePlayerID(action.ctx.currentPlayer);
            const actionSeat = client.getState()!;

            // One national action turn: the Ottoman spends a card, then the
            // impulse passes to Spain's seat rather than the inactive HRE.
            const playable = actionSeat.G.powers.ottoman.cards.find((id) => cardById(id).officialKind !== "mandatory");
            expect(playable).toBeDefined();
            client.moves.playCard({cardId: playable!});
            expect(client.getState()!.G.powers.ottoman.cp).toBeGreaterThan(0);
            client.moves.endImpulse();
            const nextTurn = client.getState()!;
            expect(nextTurn.G.activePower).toBe("spain");
            expect(nextTurn.ctx.currentPlayer).toBe("1");
            expect(ownerOf(nextTurn.G, "spain")).toBe("1");
        } finally {
            client.stop();
        }
    });
});

describe("five-player Tournament HRE activation", () => {
    it("resolves the five-player HRE check with the printed influence and ally control", () => {
        const G = tournamentGame();
        G.powers.england.cards = ["vq-009", "vq-010"];
        G.powers.spain.treasures = [3];
        G.activePower = "spain";
        G.majorInfluence!.hre = {ottoman: 0, spain: 0, england: 5, france: 0, protestant: 0};
        const events = eventsMock();

        expect(declareWar(G, diplomacyContext("1", events), {target: "hre"})).toBeUndefined();
        expect(G.pendingActivation).toEqual({power: "hre", ally: "england", aggressor: "spain"});
        expect(events.setActivePlayers).toHaveBeenCalledWith({value: {"2": "activateMajor"}});
        expect(atWar(G, "spain", "hre")).toBe(true);

        // Only the winning ally's seat may choose the activation options.
        expect(chooseMajorActivation(G, diplomacyContext("3", events), {})).toBe(INVALID_MOVE);
        expect(chooseMajorActivation(G, diplomacyContext("2", events), {})).toBeUndefined();
        expect(ownerOf(G, "hre")).toBe("2");
        expect(participatingPowers(G)).toContain("hre");
        expect(G.majorDiplomacyResolved).toContain("hre");
    });
});
