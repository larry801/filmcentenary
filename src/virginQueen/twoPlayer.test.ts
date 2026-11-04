import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {INVALID_MOVE} from "boardgame.io/core";
import {Local} from "boardgame.io/multiplayer";
import {VirginQueenGameDef} from "./game";
import {SCENARIO_OPTIONS, validateSetupData} from "./configuration";
import {ownerOf, controlledPowers} from "./ownership";
import {activateMajor, checkVictory, controlledKeys, dealYear, deactivateMajor, drawCount, powerVp, setupGame, settleActivatedMajorVp, winter} from "./util";
import {buildFortress, declareWar, influence, moveLand, navalTransport, piracy} from "./moves";
import {battleOptions, chooseBattle, startBattle} from "./combat";
import {tutorialEventOptions} from "./tutorialEvents";
import {homeCardChoiceRequired} from "./util";
import {choosePiracy, piracyOptions} from "./piracy";
import {scenarioSetup} from "./scenario";
import {cardById} from "./constant/cards";

const context = (numPlayers = 2): Ctx => ({numPlayers, random: {Die: () => 3, Shuffle: (values: unknown[]) => values}} as unknown as Ctx);

describe("Virgin Queen configurations and ownership", () => {
    test.each(SCENARIO_OPTIONS.flatMap((scenario) => scenario.players.map((count) => [scenario.id, count] as const)))("sets up %s with %i players", (scenario, count) => {
        const G = setupGame(context(count), {scenario});
        expect(validateSetupData({scenario}, count)).toBeUndefined();
        expect(G.scenario).toBe(scenario);
        expect(checkVictory(G)).toBeUndefined();
    });

    it("rejects illegal scenarios and player counts at the game boundary", () => {
        expect(validateSetupData({scenario: "tutorial"}, 6)).toContain("仅支持 2");
        expect(validateSetupData({scenario: "campaign"}, 3)).toBeUndefined();
        expect(validateSetupData({scenario: "campaign"}, 4)).toBeUndefined();
        expect(validateSetupData({scenario: "tournament"}, 4)).toBeUndefined();
        expect(validateSetupData({scenario: "typo"}, 2)).toContain("非法剧本");
        expect(validateSetupData({scenario: null}, 2)).toContain("非法剧本");
        expect(() => setupGame(context(7))).toThrow();
        expect(() => setupGame(context(3), {scenario: "tournament"})).toThrow();
    });

    it("maps all controlled powers and preserves legacy six-player ownership", () => {
        const G = setupGame(context());
        expect(controlledPowers(G, "0")).toEqual(["spain", "france"]);
        expect(controlledPowers(G, "1")).toEqual(["ottoman", "england", "protestant"]);
        expect(ownerOf(G, "hre")).toBeUndefined();
        expect(ownerOf(setupGame(context(6)), "france")).toBe("3");
    });

    it("shows every controlled hand while hiding opponents and the deck", () => {
        const G = setupGame(context());
        dealYear(G, context());
        const view = VirginQueenGameDef.playerView!(G, context(), "0");
        expect(view.powers.spain.cards.length).toBeGreaterThan(0);
        expect(view.powers.france.cards.length).toBeGreaterThan(0);
        expect(view.powers.england.cards).toEqual([]);
        expect(view.powers.ottoman.cards).toEqual([]);
        expect(view.powers.hre.cards).toEqual([]);
        expect(view.deck).toEqual([]);
        expect(VirginQueenGameDef.playerView!(G, context(), null).powers.spain.cards).toEqual([]);
    });

    it("removes official two-player components for all future turns", () => {
        const G = setupGame(context());
        for (const year of [1, 3, 7]) {
            G.year = year;
            dealYear(G, context());
            const allCards = [...G.deck, ...G.futureDeck, ...Object.values(G.powers).flatMap((power) => power.cards)];
            expect(allCards).not.toContain("vq-001");
            expect(allCards).not.toContain("vq-002");
            expect(allCards).not.toContain("vq-034");
            expect(allCards).not.toContain("vq-035");
            expect(G.powers.hre.cards).toEqual([]);
        }
        expect(G.royals.some((royal) => royal.name === "Rudolf II")).toBe(false);
        expect(G.scienceBonusesAvailable).not.toContain("excavation");
        expect(scenarioSetup("campaign", 2).cardsInPlay).toEqual(expect.arrayContaining([4, 37]));
    });

    it("settles full pairs of VP, preserves the remainder, and clears a deactivated hand", () => {
        const G = setupGame(context());
        const before = powerVp(G, "england");
        G.powers.ottoman.bonusVp += 5;
        settleActivatedMajorVp(G);
        expect(powerVp(G, "england")).toBe(before + 2);
        G.powers.ottoman.bonusVp -= 4;
        deactivateMajor(G, "ottoman");
        expect(powerVp(G, "england")).toBe(before + 1);
        expect(ownerOf(G, "ottoman")).toBeUndefined();
        expect(G.powers.ottoman.cards).toEqual([]);
        expect(G.powers.spain.wars).not.toContain("ottoman");
    });

    it("caps activation cards at the new enemy hand and maps control to the ally", () => {
        const G = setupGame(context());
        G.powers.england.cards = ["vq-007", "vq-008"];
        expect(activateMajor(G, context(), "hre", "spain", {war: "england"})).toBe(true);
        expect(G.powers.hre.cards).toHaveLength(2);
        expect(ownerOf(G, "hre")).toBe("0");
        expect(G.powers.hre.wars).toContain("england");
    });

    it("rejects same-player warfare, piracy, and French influence over the Ottoman", () => {
        const G = setupGame(context());
        G.activePower = "spain";
        expect(declareWar(G, {...context(), phase: "diplomacy", currentPlayer: "0"}, {target: "france"})).toBe(INVALID_MOVE);
        expect(piracy(G, {...context(), phase: "action", currentPlayer: "0"}, {zone: "gulfOfLyon", target: "france"})).toBe(INVALID_MOVE);
        G.activePower = "france";
        G.powers.france.cp = 2;
        expect(influence(G, {...context(), phase: "action", currentPlayer: "0"}, {target: "ottoman"})).toBe(INVALID_MOVE);
    });
});

describe("Lepanto tutorial", () => {
    it("uses the printed setup, deck and tutorial power-card tracks", () => {
        const G = setupGame(context(), {scenario: "tutorial"});
        expect(powerVp(G, "ottoman")).toBe(13);
        expect(controlledKeys(G, "ottoman")).toHaveLength(6);
        expect(controlledKeys(G, "spain")).toHaveLength(8);
        expect(drawCount(G, "ottoman")).toBe(4);
        expect(drawCount(G, "spain")).toBe(5);
        expect(G.deck).toHaveLength(28);
        expect(G.deck.every((id) => cardById(id).officialNumber! >= 4 && cardById(id).officialNumber! <= 31)).toBe(true);
        dealYear(G, context());
        expect(G.powers.hre.cards).toEqual([]);
        expect(G.powers.spain.treasures).toEqual([]);
        expect(G.powers.ottoman.cards).toHaveLength(6);
    });

    it("rejects forbidden systems and movement without spending command points", () => {
        const G = setupGame(context(), {scenario: "tutorial"});
        G.powers.ottoman.cp = 5;
        const ctx = {...context(), phase: "action", currentPlayer: "0"};
        expect(buildFortress(G, ctx, {space: "sofia"})).toBe(INVALID_MOVE);
        expect(moveLand(G, ctx, {from: "istanbul", to: "paris"})).toBe(INVALID_MOVE);
        expect(G.powers.ottoman.cp).toBe(5);
    });

    it("checks 20 VP at winter and awards the third-turn time limit to Spain", () => {
        const G = setupGame(context(), {scenario: "tutorial"});
        G.powers.ottoman.bonusVp += 7;
        expect(checkVictory(G)).toBeUndefined();
        winter(G, context());
        expect(checkVictory(G)).toEqual({winner: "ottoman", reason: "standard"});
        const late = setupGame(context(), {scenario: "tutorial"});
        late.year = 3;
        winter(late, context());
        expect(checkVictory(late)).toEqual({winner: "spain", reason: "timeLimit"});
    });

    it("enforces Selim's accession by turn three without dealing him early", () => {
        const G = setupGame(context(), {scenario: "tutorial"});
        G.deck = ["vq-006"];
        G.year = 2;
        winter(G, context());
        expect(G.year).toBe(3);
        expect(G.powers.ottoman.ruler).toBe("selimII");
        expect(G.removed).toContain("vq-006");
        expect(G.deck).not.toContain("vq-006");
        expect(G.tutorialEffects!.cyprusTarget).toBe("cyprus");
    });
});

describe("national turns through the client reducer", () => {
    it("advances a two-player tournament from Card Draw to diplomacy for both clients", () => {
        const game = {...VirginQueenGameDef, setup: (ctx: Ctx) => setupGame(ctx, {scenario: "tournament"})};
        const multiplayer = Local();
        const clients = ["0", "1"].map((playerID) => Client({game, multiplayer, numPlayers: 2, playerID}));
        for (const client of clients) client.start();
        try {
            for (const power of ["ottoman", "spain", "england", "france", "protestant"]) {
                const state = clients[0].getState()!;
                expect(state.ctx.phase).toBe("cardDraw");
                expect(state.G.activePower).toBe(power);
                clients[Number(state.ctx.currentPlayer)].moves.endPhaseTurn();
            }
            for (const client of clients) {
                expect(client.getState()!.ctx.phase).toBe("diplomacy");
            }
        } finally {
            for (const client of clients) client.stop();
        }
    });

    it("gives the same player consecutive national turns and skips inactive HRE", () => {
        const client = Client({game: VirginQueenGameDef, numPlayers: 2});
        client.start();
        const visited: string[] = [];
        const seats: string[] = [];
        for (let index = 0; index < 5; index++) {
            const state = client.getState()!;
            expect(state.ctx.phase).toBe("cardDraw");
            visited.push(state.G.activePower);
            seats.push(state.ctx.currentPlayer);
            client.moves.endPhaseTurn();
        }
        expect(visited).toEqual(["ottoman", "spain", "england", "france", "protestant"]);
        expect(seats).toEqual(["1", "0", "1", "0", "1"]);
        expect(client.getState()!.ctx.phase).toBe("diplomacy");
        client.stop();
    });

    it("finishes three tutorial turns through mandatory events and maps Spain's victory to its seat", () => {
        const client = Client({game: {...VirginQueenGameDef, seed: "lepanto-three-turns",
            setup: (ctx: Ctx) => setupGame(ctx, {scenario: "tutorial"})}, numPlayers: 2});
        client.start();
        const years = new Set<number>();
        for (let step = 0; step < 150 && !client.getState()!.ctx.gameover; step++) {
            const turn = client.getState()!.ctx;
            client.updatePlayerID(turn.activePlayers ? Object.keys(turn.activePlayers)[0] : turn.currentPlayer);
            const {G, ctx, _stateID} = client.getState()!;
            years.add(G.year);
            if (G.pendingAction) {
                client.moves.respondAction({choice: "continue"});
            } else if (G.pendingActivation) {
                client.moves.chooseMajorActivation({});
            } else if (G.pendingTutorialEvent) {
                const options = tutorialEventOptions(G);
                expect(options.length).toBeGreaterThan(0);
                client.moves.chooseTutorialEvent({choice: options[0].id});
            } else if (ctx.phase === "spring" && homeCardChoiceRequired(G, G.activePower)) {
                client.moves.chooseHomeCard({cardId: G.powers[G.activePower].cards.find((id) => cardById(id).kind === "home")});
            } else if (ctx.phase === "action") {
                const mandatory = G.powers[G.activePower].cards.find((id) => cardById(id).officialKind === "mandatory");
                if (mandatory && !G.powers[G.activePower].cardPlayed) client.moves.playCard({cardId: mandatory, asEvent: true});
                else client.moves.endImpulse();
            } else client.moves.endPhaseTurn();
            expect({phase: client.getState()!.ctx.phase, stateID: client.getState()!._stateID})
                .not.toEqual({phase: ctx.phase, stateID: _stateID});
        }
        expect([...years]).toEqual(expect.arrayContaining([1, 2, 3]));
        expect(client.getState()!.ctx.gameover).toEqual({winner: "1", power: "spain", reason: "timeLimit"});
        client.stop();
    });
});

describe("tutorial battle responses", () => {
    it("offers naval avoidance before cards and only permits Galleasses after both rolls", () => {
        const G = setupGame(context(), {scenario: "tutorial"});
        const ship = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
        G.seaZones.aegean.naval = {ottoman: {...ship}, spain: {...ship}, venice: {...ship}};
        G.powers.spain.cards = ["vq-012"];
        G.powers.ottoman.cards = [];
        const ctx = {...context(), playerID: "1"};
        startBattle(G, ctx, "naval", "aegean", "ottoman", ["spain", "venice"], "istanbul");
        expect(battleOptions(G).some((option) => option.id.startsWith("avoid:"))).toBe(true);
        chooseBattle(G, ctx, {choice: "fight"});
        chooseBattle(G, {...ctx, playerID: "0"}, {choice: "done"});
        expect(battleOptions(G).some((option) => option.id.startsWith("card:vq-012"))).toBe(false);
        chooseBattle(G, ctx, {choice: "done"});
        chooseBattle(G, {...ctx, playerID: "0"}, {choice: "done"});
        const before = G.pendingBattle!.rolls!.defender.length;
        expect(battleOptions(G).map((option) => option.id)).toContain("card:vq-012:defender");
        chooseBattle(G, ctx, {choice: "card:vq-012:defender"});
        expect(G.pendingBattle!.rolls!.defender).toHaveLength(before + 5);
        expect(G.powers.spain.cards).not.toContain("vq-012");
    });

    it("validates transport capacity and leaves unselected units in their original port", () => {
        const G = setupGame(context(), {scenario: "tutorial"});
        G.powers.ottoman.cp = 3;
        G.powers.spain.cards = [];
        G.seaZones.aegean.naval.ottoman = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
        const ctx = {...context(), currentPlayer: "0", phase: "action"};
        const route = {from: "istanbul", to: "athens", zones: ["aegean"], leaders: []};
        expect(navalTransport(G, ctx, {...route, units: {regular: 6}})).toBe(INVALID_MOVE);
        expect(G.powers.ottoman.cp).toBe(3);
        expect(navalTransport(G, ctx, {...route, units: {regular: 2}})).toBeUndefined();
        expect(G.powers.ottoman.cp).toBe(1);
        expect(G.spaces.istanbul.land.ottoman!.regular).toBe(6);
        expect(G.spaces.athens.land.ottoman!.regular).toBe(3);
    });

    it("rejects the wrong responder and resumes a serialized battle through casualties and retreat", () => {
        let G = setupGame(context(), {scenario: "tutorial"});
        G.spaces.belgrade.land = {ottoman: {regular: 4, merc: 0, cav: 0}, spain: {regular: 2, merc: 0, cav: 0}};
        G.spaces.belgrade.leaders = [];
        G.spaces.buda.control = "spain";
        G.spaces.buda.land = {};
        G.powers.ottoman.cards = [];
        G.powers.spain.cards = [];
        const events = {setActivePlayers: jest.fn(), endStage: jest.fn()};
        const ctx = {...context(), events} as unknown as Ctx;
        startBattle(G, ctx, "field", "belgrade", "ottoman", ["spain"], "sofia");
        expect(chooseBattle(G, {...ctx, playerID: "0"}, {choice: "fight"})).toBe(INVALID_MOVE);
        expect(chooseBattle(G, {...ctx, playerID: "1"}, {choice: "invalid"})).toBe(INVALID_MOVE);
        chooseBattle(G, {...ctx, playerID: "1"}, {choice: "fight"});
        G = JSON.parse(JSON.stringify(G));
        const hitsCtx = {...ctx, random: {...ctx.random, Die: () => 6}} as Ctx;
        for (let step = 0; step < 20 && G.pendingBattle; step++) {
            const options = battleOptions(G);
            expect(options.length).toBeGreaterThan(0);
            const choice = options.find((entry) => entry.id === "done") ?? options[0];
            chooseBattle(G, {...hitsCtx, playerID: ownerOf(G, G.pendingBattle.responding)}, {choice: choice.id});
        }
        expect(G.pendingBattle).toBeUndefined();
        expect(events.endStage).toHaveBeenCalled();
        expect(G.spaces.belgrade.land.spain?.regular ?? 0).toBe(0);
    });
});

describe("two-client tutorial and spectator", () => {
    it("routes Storms to Spain, hides hands, and restores the active impulse after the response", () => {
        const game = {...VirginQueenGameDef, seed: "storms-response", setup: (ctx: Ctx) => {
            const G = setupGame(ctx, {scenario: "tutorial"});
            G.dealtYear = G.year;
            G.powers.ottoman.cards = ["vq-001"];
            G.powers.spain.cards = ["vq-015"];
            return G;
        }};
        const multiplayer = Local();
        const clients = ["0", "1", null].map((playerID) => Client({game, multiplayer, numPlayers: 2, playerID}));
        for (const client of clients) client.start();
        try {
            for (let step = 0; step < 4; step++) {
                const ctx = clients[0].getState()!.ctx;
                clients[Number(ctx.currentPlayer)].moves.endPhaseTurn();
            }
            expect(clients[0].getState()!.ctx.phase).toBe("action");
            expect(clients[0].getState()!.G.powers.spain.cards).toEqual([]);
            expect(clients[2].getState()!.G.powers.ottoman.cards).toEqual([]);
            clients[0].moves.playCard({cardId: "vq-001"});
            clients[0].moves.moveLand({from: "istanbul", to: "edirne", units: {regular: 1}, leaders: []});
            expect(clients[1].getState()!.ctx.activePlayers).toEqual({"1": "actionResponse"});
            clients[1].moves.respondAction({choice: "storms"});
            expect(clients[0].getState()!.G.pendingAction).toBeUndefined();
            expect(clients[0].getState()!.G.powers.ottoman.cp).toBe(4);
            expect(clients[0].getState()!.ctx.activePlayers).toBeNull();
            expect(clients[0].getState()!.G.spaces.edirne.land.ottoman).toBeUndefined();
            clients[0].moves.endImpulse();
            expect(clients[1].getState()!.ctx.currentPlayer).toBe("1");
        } finally {
            for (const client of clients) client.stop();
        }
    });
});

describe("tutorial piracy card protection", () => {
    it("never offers or draws a Home card as a piracy award", () => {
        const G = setupGame(context(), {scenario: "tutorial"});
        G.powers.spain.cards = ["vq-003"];
        G.pendingPiracy = {power: "ottoman", target: "spain", zone: "aegean", step: "rewards", remaining: 1, rewards: {}};
        expect(piracyOptions(G).map((option) => option.id)).not.toContain("card");
        expect(choosePiracy(G, {...context(), playerID: "1"}, {choice: "card"})).toBe(INVALID_MOVE);
        G.powers.spain.cards.push("vq-008");
        choosePiracy(G, {...context(), playerID: "1"}, {choice: "card"});
        expect(G.powers.spain.cards).toEqual(["vq-003"]);
        expect(G.powers.ottoman.cards).toContain("vq-008");
    });
});
