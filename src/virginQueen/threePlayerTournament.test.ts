import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {VirginQueenGameDef} from "./game";
import {SCENARIO_OPTIONS, seatLabels, validateSetupData} from "./configuration";
import {controlledPowers, ownerOf, participatingPowers} from "./ownership";
import {scenarioSetup} from "./scenario";
import {cardById} from "./constant/cards";
import {homeCardChoiceRequired, powerVp, setupGame} from "./util";

/**
 * Scenario Book pp. 8-12: the Tournament scenario is a Turn 3-6 setup, and the
 * generic "Games with 2 to 5 players" modifications apply to it exactly as they
 * do to the Campaign.  The three-player configuration seats Spain,
 * England+Protestant and France; the Ottoman starts as England's activated
 * ally and the HRE starts inactive.  There is no separate three-player
 * Tournament setup table, so this is the Tournament setup plus the p. 12
 * three-player removals/influence changes.
 */
const context = (numPlayers = 3): Ctx => ({
    numPlayers,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

const tournamentGame = () => setupGame(context(), {scenario: "tournament"});

describe("three-player Tournament setup", () => {
    it("is offered as an official configuration without disturbing existing ones", () => {
        expect(validateSetupData({scenario: "tournament"}, 3)).toBeUndefined();
        expect(SCENARIO_OPTIONS.find((entry) => entry.id === "tournament")!.players).toEqual([2, 3, 4, 5, 6]);
        expect(seatLabels("tournament", 3)).toEqual(["西班牙", "英格兰 / 新教联盟", "法国"]);

        expect(validateSetupData({scenario: "tournament"}, 2)).toBeUndefined();
        expect(validateSetupData({scenario: "tournament"}, 4)).toBeUndefined();
        expect(validateSetupData({scenario: "tournament"}, 5)).toBeUndefined();
        expect(validateSetupData({scenario: "tournament"}, 6)).toBeUndefined();
        expect(SCENARIO_OPTIONS.find((entry) => entry.id === "campaign")!.players).toEqual([2, 3, 4, 5, 6]);
    });

    it("seats Spain, England+Protestant and France with the Ottoman pre-activated", () => {
        const G = tournamentGame();
        expect(G.scenario).toBe("tournament");
        expect(G.startTurn).toBe(3);
        expect(G.endTurn).toBe(6);
        expect(G.year).toBe(3);
        expect(G.playerPowers).toEqual({
            "0": ["spain"], "1": ["england", "protestant"], "2": ["france"],
        });
        expect(G.activatedMajors!.ottoman).toEqual({ally: "england", baseline: powerVp(G, "ottoman")});
        expect(G.activatedMajors!.hre).toBeUndefined();
        expect(participatingPowers(G)).toEqual(["ottoman", "spain", "england", "france", "protestant"]);
        expect(G.activePower).toBe("ottoman");

        expect(ownerOf(G, "ottoman")).toBe("1");
        expect(ownerOf(G, "spain")).toBe("0");
        expect(ownerOf(G, "england")).toBe("1");
        expect(ownerOf(G, "france")).toBe("2");
        expect(ownerOf(G, "protestant")).toBe("1");
        expect(ownerOf(G, "hre")).toBeUndefined();
        expect(controlledPowers(G, "0")).toEqual(["spain"]);
        expect(controlledPowers(G, "1")).toEqual(["ottoman", "england", "protestant"]);
        expect(controlledPowers(G, "2")).toEqual(["france"]);

        // The inactive HRE keeps the printed Tournament garrison but no hand.
        expect(G.powers.hre.cards).toEqual([]);
        expect(G.spaces.vienna.land.hre).toEqual({regular: 2, merc: 2, cav: 0});
        expect(G.spaces.vienna.leaders).toContain("schwendi");
        expect(G.spaces.prague.land.hre?.regular).toBe(1);
    });

    it("keeps the printed three-player influence tracks and the Tournament state", () => {
        const G = tournamentGame();
        expect(G.majorInfluence!.ottoman).toEqual({spain: 1, england: 0, france: 0, protestant: 0});
        expect(G.majorInfluence!.hre).toEqual({ottoman: 3, spain: 1, england: 1, france: 1, protestant: 1});

        // Tournament-only state: Mary is captured and Morisco Revolt is already
        // on the board in Granada, with the printed VP track.
        expect(G.espionage.mary).toBe("captured");
        expect(G.morisco).toEqual({space: "granada", units: 2});
        expect(G.spaces.granada.land.ottoman?.regular).toBe(2);
        expect(G.spaces.granada.unrest).toBe(true);
        expect(powerVp(G, "ottoman")).toBe(14);
        expect(powerVp(G, "spain")).toBe(15);
        expect(powerVp(G, "england")).toBe(11);
        expect(powerVp(G, "france")).toBe(10);
        expect(powerVp(G, "protestant")).toBe(10);
    });

    it("combines the Tournament removals with the three-player component removals", () => {
        const setup = scenarioSetup("tournament", 3);
        expect(setup.cardsInPlay).toHaveLength(104);
        expect(setup.cardsRemoved).toEqual([1, 2, 11, 34, 35, 58, 72, 73]);
        for (const number of [1, 2, 11, 34, 35, 58, 72, 73]) {
            expect(setup.cardsInPlay).not.toContain(number);
            expect(setup.cardsRemoved).toContain(number);
        }
        expect(setup.cardsInPlay).toEqual(expect.arrayContaining([4, 37]));

        expect(setup.royals.some((royal) => royal.nameEn === "Rudolf II")).toBe(false);
        for (const patron of ["sinan", "seydiAliReis", "taqiAlDin", "baki", "mercator", "arcimboldo", "brahe", "spranger", "kepler"]) {
            expect(setup.patronage.artists).not.toContain(patron);
            expect(setup.patronage.scientists).not.toContain(patron);
        }
        for (const award of ["suleimaniyeMosque", "elegyForSuleiman", "vertumnus", "lawsPlanetaryMotion", "mirrorOfCountries"]) {
            expect(setup.patronage.vpAwards).not.toContain(award);
        }
        expect(setup.patronage.scienceBonuses).not.toContain("excavation");
        const seaCaptains = Object.values(setup.powerCard).flatMap((card) => card.seaCaptains ?? []);
        expect(seaCaptains).not.toContain("muratReis");
        expect(seaCaptains).not.toContain("henszlein");

        const G = tournamentGame();
        expect([...G.deck, ...G.futureDeck]).toEqual(expect.arrayContaining(["vq-004", "vq-037"]));
        expect(G.removed).toEqual(["vq-001", "vq-002", "vq-011", "vq-034", "vq-035", "vq-058", "vq-072", "vq-073"]);
    });

    it("preserves the existing two-, five- and six-player Tournament removals", () => {
        expect(scenarioSetup("tournament", 6).cardsRemoved).toEqual([4, 11, 37, 58]);
        expect(scenarioSetup("tournament", 5).cardsRemoved).toEqual([11, 34, 35, 37, 58, 72]);
        expect(scenarioSetup("tournament", 2).cardsRemoved).toEqual([1, 2, 11, 34, 35, 58, 72, 73]);
    });

    it("runs one national-turn path from Card Draw to Spain's action impulse", () => {
        const game = {...VirginQueenGameDef, setup: (ctx: Ctx) => setupGame(ctx, {scenario: "tournament"})};
        const client = Client({game, numPlayers: 3});
        client.start();
        try {
            const cardDraw: string[] = [];
            const cardDrawSeats: string[] = [];
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
            expect(cardDrawSeats).toEqual(["1", "0", "1", "2", "1"]);
            expect(client.getState()!.ctx.phase).toBe("diplomacy");

            for (const phase of ["diplomacy", "spring"] as const) {
                for (let index = 0; index < 5; index++) {
                    const state = client.getState()!;
                    expect(state.ctx.phase).toBe(phase);
                    expect(state.G.activePower).toBe(["ottoman", "spain", "england", "france", "protestant"][index]);
                    expect(state.ctx.currentPlayer).toBe(["1", "0", "1", "2", "1"][index]);
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
            client.updatePlayerID(action.ctx.currentPlayer);
            const actionSeat = client.getState()!;
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
