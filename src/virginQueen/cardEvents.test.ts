import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {INVALID_MOVE} from "boardgame.io/core";
import {Local} from "boardgame.io/multiplayer";
import {canCancelCardEvent, cardEventOptions} from "./cardEvents";
import {cardById} from "./constant/cards";
import {VQGame} from "./constant/general";
import {VirginQueenGameDef} from "./game";
import {buildExpedition, chooseCardEvent, endImpulse, playCard, playTreasure} from "./moves";
import {ownerOf} from "./ownership";
import {setupGame} from "./util";

const context = (die = 6, numPlayers = 6): Ctx => ({
    numPlayers, phase: "action", currentPlayer: "0", playerID: "0",
    random: {Die: () => die, Shuffle: (values: unknown[]) => values},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx);
const newGame = (numPlayers = 6, tutorial = false): VQGame => {
    const G = setupGame(context(6, numPlayers), {scenario: tutorial ? "tutorial" : "campaign"});
    G.powers.ottoman.cards = ["vq-001"];
    G.suezAttempts = 0;
    return G;
};
const options = (G: VQGame, numPlayers = 6) => cardEventOptions(G, numPlayers).map((option) => option.id);
const choose = (G: VQGame, choice: string, ctx = context()) => chooseCardEvent(G,
    {...ctx, playerID: ownerOf(G, "ottoman")}, {choice});
const start = (G: VQGame, ctx = context()) => playCard(G, ctx, {cardId: "vq-001", asEvent: true});

describe("Grand Vizier recruitment", () => {
    it.each([false, true])("adds four mixed units in multiple spaces (tutorial: %s) without CP", (tutorial) => {
        const ctx = context(6, tutorial ? 2 : 6);
        const G = newGame(ctx.numPlayers, tutorial);
        const regulars = G.spaces.edirne.land.ottoman?.regular ?? 0;
        const galleys = G.spaces.istanbul.naval.ottoman?.galley ?? 0;
        start(G, ctx);
        expect(G.homeSetAside).toContain("vq-001");
        expect(G.powers.ottoman.cards).not.toContain("vq-001");
        expect(G.spaces.edirne.land.ottoman?.regular ?? 0).toBe(regulars);
        choose(G, "recruit", ctx);
        for (const choice of ["regular:edirne", "galley:istanbul", "regular:edirne", "galley:istanbul"]) choose(G, choice, ctx);
        expect(G.spaces.edirne.land.ottoman!.regular).toBe(regulars + 2);
        expect(G.spaces.istanbul.naval.ottoman!.galley).toBe(galleys + 2);
        expect(G.powers.ottoman.cp).toBe(0);
        expect(G.pendingCardEvent).toBeUndefined();
        expect(ctx.events!.endStage).toHaveBeenCalledTimes(1);
    });

    it("rejects occupied, besieged, unrest, non-home and non-Aegean placements without mutation", () => {
        const G = newGame();
        G.spaces.belgrade.unrest = true;
        G.spaces.sofia.siege = {by: "spain", sinceImpulse: 0};
        G.spaces.buda.control = "spain";
        G.spaces.vienna.control = "ottoman";
        G.spaces.athens.land.spain = {regular: 1, merc: 0, cav: 0};
        G.powers.ottoman.wars.push("spain");
        start(G);
        choose(G, "recruit");
        const before = JSON.stringify(G);
        for (const choice of ["regular:algiers", "regular:tripoli", "regular:belgrade", "regular:sofia", "regular:buda",
            "regular:vienna", "regular:athens", "galley:algiers", "galley:tripoli", "galley:foreignWar", "suez", "merc:istanbul"]) {
            expect(choose(G, choice)).toBe(INVALID_MOVE);
            expect(JSON.stringify(G)).toBe(before);
        }
        expect(chooseCardEvent(G, {...context(), playerID: "1"}, {choice: "regular:edirne"})).toBe(INVALID_MOVE);
        expect(JSON.stringify(G)).toBe(before);
    });

    it("adds regulars to an active foreign war up to eight and spends the remaining placements on the map", () => {
        const G = newGame();
        G.foreignWars.ottoman = {power: "ottoman", cardId: "vq-073", enemy: "Persia", enemyUnits: 3,
            units: {regular: 5, merc: 1, cav: 0}, winnerVp: false, status: "active"};
        const regulars = G.spaces.edirne.land.ottoman?.regular ?? 0;
        start(G);
        choose(G, "recruit");
        choose(G, "regular:foreignWar");
        choose(G, "regular:foreignWar");
        expect(options(G)).not.toContain("regular:foreignWar");
        expect(choose(G, "regular:foreignWar")).toBe(INVALID_MOVE);
        expect(G.foreignWars.ottoman.units.regular).toBe(7);
        choose(G, "regular:edirne");
        choose(G, "regular:edirne");
        expect(G.spaces.edirne.land.ottoman!.regular).toBe(regulars + 2);
        expect(G.pendingCardEvent).toBeUndefined();
    });

    it("rejects an unavailable event before discarding and still permits playing for five CP", () => {
        const G = newGame(2, true);
        for (const space of Object.values(G.spaces)) space.unrest = true;
        const before = JSON.stringify(G);
        expect(start(G, context(6, 2))).toBe(INVALID_MOVE);
        expect(JSON.stringify(G)).toBe(before);
        expect(playCard(G, context(6, 2), {cardId: "vq-001"})).toBeUndefined();
        expect(G.powers.ottoman.cp).toBe(5);
        expect(G.pendingCardEvent).toBeUndefined();
    });

    it("blocks normal moves during the choice and rejects extra or out-of-turn choices", () => {
        const G = newGame();
        start(G);
        expect(endImpulse(G, context())).toBe(INVALID_MOVE);
        expect(playTreasure(G, context(), {index: 0})).toBe(INVALID_MOVE);
        expect(chooseCardEvent(G, {...context(), playerID: "1"}, {choice: "recruit"})).toBe(INVALID_MOVE);
        choose(G, "recruit");
        for (let count = 0; count < 4; count++) choose(G, "regular:edirne");
        const before = JSON.stringify(G);
        expect(choose(G, "regular:edirne")).toBe(INVALID_MOVE);
        expect(JSON.stringify(G)).toBe(before);
    });
});

describe("Grand Vizier Suez Canal", () => {
    it.each([2, 4, 5, 6])("offers construction only in five/six-player games (%s players)", (players) => {
        const G = newGame();
        const ctx = context(6, players);
        start(G, ctx);
        expect(options(G, players).includes("suez")).toBe(players >= 5);
        if (players < 5) {
            const before = JSON.stringify(G);
            expect(choose(G, "suez", ctx)).toBe(INVALID_MOVE);
            expect(JSON.stringify(G)).toBe(before);
        }
    });

    it("counts failed attempts, then awards two VP and a permanent card modifier exactly once", () => {
        const G = newGame();
        const vp = G.powers.ottoman.bonusVp;
        const modifier = G.powers.ottoman.cardModifier;
        start(G);
        choose(G, "suez", context(5));
        expect(G.suezDone).toBe(false);
        expect(G.suezAttempts).toBe(1);
        expect(G.powers.ottoman.bonusVp).toBe(vp);
        G.powers.ottoman.cardPlayed = false;
        G.powers.ottoman.cards = ["vq-001"];
        start(G);
        choose(G, "suez", context(5));
        expect(G.suezDone).toBe(true);
        expect(G.lastRolls).toContain("5 + 1 = 6");
        expect(G.powers.ottoman.bonusVp).toBe(vp + 2);
        expect(G.powers.ottoman.cardModifier).toBe(modifier + 1);
        expect(G.pendingCardEvent).toBeUndefined();
        G.powers.ottoman.cardPlayed = false;
        G.powers.ottoman.cards = ["vq-001"];
        start(G);
        expect(options(G)).not.toContain("suez");
        expect(choose(G, "suez")).toBe(INVALID_MOVE);
        expect(G.powers.ottoman.bonusVp).toBe(vp + 2);
    });

    it("adds Excavation's two pips and permits full-strength expeditions carrying colonies after construction", () => {
        const G = newGame();
        G.powers.ottoman.cp = 5;
        const before = JSON.stringify(G);
        expect(buildExpedition(G, context(), {captain: "muratReis", colony: true})).toBe(INVALID_MOVE);
        expect(JSON.stringify(G)).toBe(before);
        G.powers.ottoman.scienceBonuses.push("excavation");
        start(G);
        choose(G, "suez", context(4));
        expect(G.suezDone).toBe(true);
        expect(G.lastRolls).toContain("+ 2 science = 6");
        expect(buildExpedition(G, context(), {captain: "muratReis", colony: true})).toBeUndefined();
        expect(G.worldCaptains.muratReis).toMatchObject({location: "indianOcean", damaged: false, colony: true});
    });
});

describe("Grand Vizier event cancellation", () => {
    it.each([false, true])("cancels before unit effects and consumes the response without changing its owner's impulse (tutorial: %s)", (tutorial) => {
        const G = newGame(tutorial ? 2 : 6, tutorial);
        const ctx = {...context(6, tutorial ? 2 : 6), currentPlayer: "1", playerID: "1"};
        G.activePower = "spain";
        G.powers.spain.cards = ["vq-021"];
        const land = JSON.stringify(Object.values(G.spaces).map((space) => space.land));
        const cp = G.powers.ottoman.cp;
        playCard(G, ctx, {cardId: "vq-021", asEvent: true});
        expect(G.pendingCardEvent?.kind).toBe("cancelEvent");
        expect(G.pendingTutorialEvent).toBeUndefined();
        expect(JSON.stringify(Object.values(G.spaces).map((space) => space.land))).toBe(land);
        const before = JSON.stringify(G);
        expect(chooseCardEvent(G, ctx, {choice: "cancel"})).toBe(INVALID_MOVE);
        expect(JSON.stringify(G)).toBe(before);
        choose(G, "cancel", ctx);
        expect(G.powers.ottoman.cards).not.toContain("vq-001");
        expect(G.homeSetAside).toContain("vq-001");
        expect(G.discard).toContain("vq-021");
        expect(G.powers.spain.cardPlayed).toBe(true);
        expect(G.powers.ottoman.cardPlayed).toBe(false);
        expect(G.powers.ottoman.cp).toBe(cp);
        expect(JSON.stringify(Object.values(G.spaces).map((space) => space.land))).toBe(land);
        expect(G.pendingCardEvent).toBeUndefined();
    });

    it("preserves a foreign war's original target through serialization and resolves it once when allowed", () => {
        let G = newGame();
        G.powers.spain.cards = ["vq-073"];
        const ctx = {...context(), currentPlayer: "1", playerID: "1"};
        playCard(G, ctx, {cardId: "vq-073", asEvent: true, target: "5"});
        expect(G.foreignWars.ottoman).toBeUndefined();
        expect(G.powers.ottoman.cardModifier).toBe(0);
        G = JSON.parse(JSON.stringify(G));
        choose(G, "continue", ctx);
        expect(G.foreignWars.ottoman).toMatchObject({enemyUnits: 5, winnerVp: true, status: "setup"});
        expect(G.powers.ottoman.cardModifier).toBe(-1);
        expect(G.powers.ottoman.cards).toContain("vq-001");
        expect(G.pendingCardEvent).toBeUndefined();
        expect(choose(G, "continue", ctx)).toBe(INVALID_MOVE);
        expect(G.powers.ottoman.cardModifier).toBe(-1);
    });

    it("cancels foreign-war setup without its card penalty", () => {
        const G = newGame();
        G.powers.spain.cards = ["vq-073"];
        const ctx = {...context(), currentPlayer: "1", playerID: "1"};
        playCard(G, ctx, {cardId: "vq-073", asEvent: true, target: "3"});
        choose(G, "cancel", ctx);
        expect(G.foreignWars.ottoman).toBeUndefined();
        expect(G.powers.ottoman.cardModifier).toBe(0);
    });

    it.each(["cancel", "continue"])("handles event-only removal after the %s response", (response) => {
        const G = newGame();
        G.powers.spain.cards = ["vq-049"];
        const ctx = {...context(), currentPlayer: "1", playerID: "1"};
        playCard(G, ctx, {cardId: "vq-049", asEvent: true});
        expect(G.removed).not.toContain("vq-049");
        choose(G, response, ctx);
        expect(G.removed.includes("vq-049")).toBe(response === "continue");
        expect(G.discard.includes("vq-049")).toBe(response === "cancel");
    });

    it.each(["vq-001", "vq-003", "vq-004", "vq-006", "vq-009", "vq-013"])("excludes home, mandatory, combat and response cards (%s)", (id) => {
        expect(canCancelCardEvent(newGame(), cardById(id))).toBe(false);
    });

    it("does not offer cancellation when playing an ordinary card for CP", () => {
        const G = newGame();
        G.powers.spain.cards = ["vq-021"];
        playCard(G, {...context(), currentPlayer: "1", playerID: "1"}, {cardId: "vq-021"});
        expect(G.pendingCardEvent).toBeUndefined();
        expect(G.powers.spain.cp).toBe(5);
    });
});

describe("Grand Vizier through multiplayer clients", () => {
    it.each(["recruit", "suez"])("completes the %s effect in a six-player action stage and resumes normal moves", (effect) => {
        const game = {...VirginQueenGameDef, seed: "vizier-six-players", setup: () => newGame(),
            phases: {action: {...VirginQueenGameDef.phases!.action, start: true}}};
        const client = Client({game, numPlayers: 6, playerID: "0"});
        client.start();
        try {
            const before = client.getState()!.G.spaces.edirne.land.ottoman?.regular ?? 0;
            client.moves.playCard({cardId: "vq-001", asEvent: true});
            expect(client.getState()!.ctx.activePlayers).toEqual({"0": "cardEvent"});
            client.moves.chooseCardEvent({choice: effect});
            if (effect === "recruit") {
                for (let count = 0; count < 4; count++) client.moves.chooseCardEvent({choice: "regular:edirne"});
                expect(client.getState()!.G.spaces.edirne.land.ottoman!.regular).toBe(before + 4);
            } else expect(client.getState()!.G.lastRolls).toContain("Suez Canal attempt");
            expect(client.getState()!.G.pendingCardEvent).toBeUndefined();
            expect(client.getState()!.ctx.activePlayers).toBeNull();
            client.moves.endImpulse();
            expect(client.getState()!.ctx.currentPlayer).toBe("1");
        } finally {
            client.stop();
        }
    });

    it.each(["cancel", "continue"])("routes %s to Ottoman, then restores Spain's impulse after the event", (response) => {
        const game = {...VirginQueenGameDef, seed: "vizier-response", setup: () => {
            const G = newGame(2, true);
            G.dealtYear = G.year;
            G.powers.spain.cards = ["vq-021"];
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
            clients[0].moves.endImpulse();
            clients[1].moves.playCard({cardId: "vq-021", asEvent: true});
            expect(clients[0].getState()!.ctx.activePlayers).toEqual({"0": "cardEvent"});
            clients[0].moves.chooseCardEvent({choice: response});
            if (response === "continue") {
                expect(clients[1].getState()!.ctx.activePlayers).toEqual({"1": "tutorialEvent"});
                for (let count = 0; count < 3; count++) clients[1].moves.chooseTutorialEvent({choice: "regular:madrid"});
            }
            for (const client of clients) {
                const state = client.getState()!;
                expect(state.G.pendingCardEvent).toBeUndefined();
                expect(state.G.pendingTutorialEvent).toBeUndefined();
                expect(state.ctx.activePlayers).toBeNull();
                expect(state.ctx.currentPlayer).toBe("1");
            }
            clients[1].moves.endImpulse();
            expect(clients[0].getState()!.ctx.currentPlayer).toBe("0");
        } finally {
            for (const client of clients) client.stop();
        }
    });
});
