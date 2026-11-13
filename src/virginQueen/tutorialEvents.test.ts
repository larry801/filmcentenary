import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {INVALID_MOVE} from "boardgame.io/core";
import {Local} from "boardgame.io/multiplayer";
import {VirginQueenGameDef} from "./game";
import {POWERS, VQGame} from "./constant/general";
import {ownerOf} from "./ownership";
import {setupGame} from "./util";
import {beginTutorialEvent, canPlayTutorialEvent, chooseTutorialEvent, spanishRoadDestinations, tutorialEventOptions} from "./tutorialEvents";

const context = (die = 6): Ctx => ({numPlayers: 2, phase: "action", currentPlayer: "0",
    random: {Die: () => die, Shuffle: (values: unknown[]) => values},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn()},
} as unknown as Ctx);
const tutorialGame = (): VQGame => setupGame(context(), {scenario: "tutorial"});
const choices = (G: VQGame): string[] => tutorialEventOptions(G).map((entry) => entry.id);
const choose = (G: VQGame, choice: string) => chooseTutorialEvent(G,
    {...context(), playerID: ownerOf(G, G.pendingTutorialEvent!.responding)}, {choice});

const startRoad = (G: VQGame) => {
    beginTutorialEvent(G, context(), "spain", "vq-003");
    choose(G, "none");
};

describe("Spanish Road deployment", () => {
    it("lets Spain relocate a leader, select a partial formation, and deploy without CP or interception", () => {
        const G = tutorialGame();
        G.spaces.milan.land = {spain: {regular: 2, merc: 2, cav: 0}};
        G.spaces.milan.leaders = [];
        G.spaces.genoa.land = {};
        G.spaces.genoa.naval = {};
        G.spaces.genoa.control = "spain";
        G.leaders.alba = {id: "alba", location: "madrid"};
        G.spaces.madrid.leaders.push("alba");
        const cp = G.powers.spain.cp;
        beginTutorialEvent(G, context(), "spain", "vq-003");
        expect(G.spaces.milan.land.spain!.regular).toBe(3);
        choose(G, "leader:alba");
        expect(G.leaders.alba.location).toBe("milan");
        expect(G.pendingTutorialEvent?.step).toBe("roadFormation");
        expect(choices(G)).not.toContain("deploy:genoa");
        choose(G, "add:spain:regular");
        choose(G, "add:spain:merc");
        choose(G, "formationLeader:alba");
        expect(choices(G)).toContain("deploy:genoa");
        choose(G, "deploy:genoa");
        expect(G.spaces.milan.land.spain).toEqual({regular: 2, merc: 1, cav: 0});
        expect(G.spaces.genoa.land.spain).toEqual({regular: 1, merc: 1, cav: 0});
        expect(G.leaders.alba.location).toBe("genoa");
        expect(G.pendingTutorialEvent).toBeUndefined();
        expect(G.pendingIntercept).toBeUndefined();
        expect(G.powers.spain.cp).toBe(cp);
        expect(G.springDone).not.toContain("spain");
    });

    it("crosses neutral land and one pass but never two passes, unrest, enemy control, or foreign units", () => {
        const G = tutorialGame();
        for (const state of Object.values(G.spaces)) {
            state.unrest = true;
            state.land = {};
            state.naval = {};
            delete state.siege;
        }
        for (const id of ["milan", "innsbruck", "augsburg", "graz", "seville"]) G.spaces[id].unrest = false;
        G.spaces.innsbruck.control = "hre";
        G.spaces.augsburg.control = "spain";
        G.spaces.graz.control = "spain";
        expect(spanishRoadDestinations(G)).toContain("augsburg");
        expect(spanishRoadDestinations(G)).not.toContain("innsbruck");
        expect(spanishRoadDestinations(G)).not.toContain("graz");
        expect(spanishRoadDestinations(G)).not.toContain("seville");
        G.spaces.innsbruck.unrest = true;
        expect(spanishRoadDestinations(G)).not.toContain("augsburg");
        G.spaces.innsbruck.unrest = false;
        G.spaces.innsbruck.land.hre = {regular: 1, merc: 0, cav: 0};
        expect(spanishRoadDestinations(G)).not.toContain("augsburg");
        G.spaces.innsbruck.land = {};
        G.powers.spain.wars.push("hre");
        expect(spanishRoadDestinations(G)).not.toContain("augsburg");
    });

    it("enforces formation capacity and validates choices without changing state", () => {
        const G = tutorialGame();
        G.spaces.milan.land = {spain: {regular: 6, merc: 0, cav: 0}};
        G.spaces.milan.leaders = [];
        startRoad(G);
        for (let count = 0; count < 4; count++) choose(G, "add:spain:regular");
        const before = JSON.stringify(G);
        for (const choice of ["add:spain:regular", "remove:spain:merc", "formationLeader:dragut", "deploy:london"]) {
            expect(choose(G, choice)).toBe(INVALID_MOVE);
            expect(JSON.stringify(G)).toBe(before);
        }
        expect(chooseTutorialEvent(G, {...context(), playerID: "0"}, {choice: "none"})).toBe(INVALID_MOVE);
        expect(JSON.stringify(G)).toBe(before);
        choose(G, "remove:spain:regular");
        expect(choices(G)).toContain("add:spain:regular");
        choose(G, "none");
        expect(G.spaces.milan.land.spain!.regular).toBe(7);
        expect(G.pendingTutorialEvent).toBeUndefined();
    });

    it("allows controlled minor units in the formation and supports serialization mid-selection", () => {
        let G = tutorialGame();
        G.powers.spain.alliedMinors.push("venice");
        G.spaces.milan.land.venice = {regular: 1, merc: 0, cav: 0};
        G.spaces.genoa.land = {};
        G.spaces.genoa.naval = {};
        G.spaces.genoa.control = "spain";
        startRoad(G);
        choose(G, "add:venice:regular");
        G = JSON.parse(JSON.stringify(G));
        choose(G, "deploy:genoa");
        expect(G.spaces.milan.land.venice).toBeUndefined();
        expect(G.spaces.genoa.land.venice!.regular).toBe(1);
    });

    it("uses only the two highest command ratings and permits leaders to deploy alone", () => {
        const G = tutorialGame();
        G.spaces.milan.land = {spain: {regular: 20, merc: 0, cav: 0}};
        G.spaces.genoa.land = {};
        G.spaces.milan.leaders = ["alba", "parma", "donJohn"];
        for (const id of G.spaces.milan.leaders) G.leaders[id] = {id, location: "milan"};
        startRoad(G);
        for (const id of ["alba", "parma", "donJohn"]) choose(G, `formationLeader:${id}`);
        for (let count = 0; count < 16; count++) choose(G, "add:spain:regular");
        expect(choices(G)).not.toContain("add:spain:regular");
        for (let count = 0; count < 16; count++) choose(G, "remove:spain:regular");
        expect(choices(G)).toContain("deploy:genoa");
        choose(G, "deploy:genoa");
        expect(G.spaces.genoa.land.spain).toBeUndefined();
        expect(G.leaders.alba.location).toBe("genoa");
        expect(G.spaces.milan.land.spain!.regular).toBe(21);
    });

    it("rejects a besieged Milan and excludes besieged leaders from relocation", () => {
        const G = tutorialGame();
        G.spaces.milan.siege = {by: "ottoman", sinceImpulse: 0};
        expect(canPlayTutorialEvent(G, "spain", "vq-003")).toBe(false);
        delete G.spaces.milan.siege;
        G.leaders.alba = {id: "alba", location: "madrid"};
        G.spaces.madrid.siege = {by: "ottoman", sinceImpulse: 0};
        beginTutorialEvent(G, context(), "spain", "vq-003");
        expect(choices(G)).not.toContain("leader:alba");
    });
});

const rebelGame = (): VQGame => {
    const G = tutorialGame();
    G.spaces.tunis.control = "spain";
    G.spaces.tunis.land = {spain: {regular: 1, merc: 1, cav: 0}};
    G.spaces.tunis.naval = {spain: {galley: 1, galleon: 0, racebuilt: 0, corsair: 0}};
    G.spaces.tunis.leaders = [];
    G.powers.ottoman.cards = [];
    return G;
};
const startRebels = (G: VQGame, die = 6) => {
    beginTutorialEvent(G, context(die), "ottoman", "vq-018");
    chooseTutorialEvent(G, {...context(die), playerID: "0"}, {choice: "space:tunis"});
};

describe("City State Rebels", () => {
    it("lets the controller choose mixed land/naval losses and distinguishes leader outcomes", () => {
        let G = rebelGame();
        G.spaces.tunis.leaders = ["alba", "santaCruz"];
        for (const id of G.spaces.tunis.leaders) G.leaders[id] = {id, location: "tunis"};
        startRebels(G);
        expect(G.pendingTutorialEvent).toMatchObject({step: "rebelLosses", responding: "spain", remaining: 5});
        expect(choices(G)).toEqual(expect.arrayContaining(["loss:land:spain:merc", "loss:naval:spain:galley"]));
        const before = JSON.stringify(G);
        expect(chooseTutorialEvent(G, {...context(), playerID: "0"}, {choice: "loss:naval:spain:galley"})).toBe(INVALID_MOVE);
        expect(choose(G, "loss:land:spain:cav")).toBe(INVALID_MOVE);
        expect(JSON.stringify(G)).toBe(before);
        choose(G, "loss:naval:spain:galley");
        expect(G.spaces.tunis.land.spain!.merc).toBe(1);
        G = JSON.parse(JSON.stringify(G));
        choose(G, "loss:land:spain:regular");
        choose(G, "loss:land:spain:merc");
        expect(G.spaces.tunis.control).toBe("independent");
        expect(G.leaders.alba).toMatchObject({location: "captured", capturedBy: "ottoman"});
        expect(G.leaders.santaCruz).toEqual({id: "santaCruz", location: "pool", returnTurn: G.year + 1});
        expect(G.spaces.tunis.leaders).toEqual([]);
        expect(G.pendingTutorialEvent).toMatchObject({step: "rebelRegular", responding: "ottoman"});
        choose(G, "regular");
        expect(G.spaces.tunis.land.independent!.regular).toBe(1);
        expect(G.pendingTutorialEvent).toBeUndefined();
    });

    it("keeps control if any army or navy remains when hits run out", () => {
        const G = rebelGame();
        let index = 0;
        const ctx = context();
        ctx.random!.Die = (() => index++ === 0 ? 6 : 1) as NonNullable<Ctx["random"]>["Die"];
        beginTutorialEvent(G, ctx, "ottoman", "vq-018");
        chooseTutorialEvent(G, {...ctx, playerID: "0"}, {choice: "space:tunis"});
        choose(G, "loss:land:spain:regular");
        expect(G.pendingTutorialEvent).toBeUndefined();
        expect(G.spaces.tunis.control).toBe("spain");
        expect(G.spaces.tunis.naval.spain!.galley).toBe(1);
    });

    it("does not affect units with zero hits or remove another major power's troops", () => {
        const G = rebelGame();
        startRebels(G, 1);
        expect(G.pendingTutorialEvent).toBeUndefined();
        expect(G.spaces.tunis.land.spain!.regular).toBe(1);
        G.spaces.tunis.land.ottoman = {regular: 1, merc: 0, cav: 0};
        startRebels(G);
        expect(choices(G)).not.toContain("loss:land:ottoman:regular");
        choose(G, "loss:land:spain:regular");
        choose(G, "loss:land:spain:merc");
        choose(G, "loss:naval:spain:galley");
        expect(G.pendingTutorialEvent).toBeUndefined();
        expect(G.spaces.tunis.control).toBe("spain");
        expect(G.spaces.tunis.land.ottoman!.regular).toBe(1);
    });

    it("can remove controlled minor squadrons and decline the home regular", () => {
        const G = rebelGame();
        G.powers.spain.alliedMinors.push("venice");
        G.spaces.tunis.land = {};
        G.spaces.tunis.naval = {venice: {galley: 1, galleon: 0, racebuilt: 0, corsair: 0}};
        startRebels(G);
        expect(choices(G)).toContain("loss:naval:venice:galley");
        choose(G, "loss:naval:venice:galley");
        choose(G, "none");
        expect(G.spaces.tunis.control).toBe("independent");
        expect(G.spaces.tunis.land).toEqual({});
        expect(G.pendingTutorialEvent).toBeUndefined();
    });

    it("excludes home and major-ally control but allows occupied independent fortresses", () => {
        const G = rebelGame();
        G.spaces.vienna.control = "spain";
        G.powers.spain.allies.push("hre");
        beginTutorialEvent(G, context(), "ottoman", "vq-018");
        expect(choices(G)).toContain("space:tunis");
        expect(choices(G)).not.toContain("space:vienna");
        expect(choices(G)).not.toContain("space:madrid");
        G.spaces.tunis.control = "independent";
        expect(choices(G)).not.toContain("space:tunis");
    });

    it("restores an activated minor's political control to its ally and recruits its home regular", () => {
        const G = tutorialGame();
        G.powers.ottoman.cards = [];
        G.powers.spain.alliedMinors.push("venice");
        G.spaces.venice.control = "ottoman";
        G.spaces.venice.land = {};
        G.spaces.venice.naval = {};
        beginTutorialEvent(G, context(), "ottoman", "vq-018");
        expect(choices(G)).toContain("space:venice");
        choose(G, "space:venice");
        choose(G, "regular");
        expect(G.spaces.venice.control).toBe("spain");
        expect(G.spaces.venice.land.venice!.regular).toBe(1);
        expect(G.spaces.venice.land.spain).toBeUndefined();
    });
});

describe("Papal Bull retrieving Holy League", () => {
    const startPapalBull = (G: VQGame): void => {
        G.powers.ottoman.cards = [];
        for (const p of POWERS) G.powers[p].influence.papacy = 0;
        G.powers.spain.influence.papacy = 9;
        G.discard = ["vq-024"];
        beginTutorialEvent(G, context(), "spain", "vq-005", true);
    };

    it("does not offer #24 while the Ottoman has fewer than 13 VP", () => {
        const G = tutorialGame();
        G.powers.ottoman.bonusVp -= 1;
        startPapalBull(G);
        expect(G.pendingTutorialEvent?.step).toBe("papalBenefit");
        expect(choices(G)).toEqual(["none"]);
        choose(G, "none");
        expect(G.discard).toContain("vq-024");
        expect(G.pendingTutorialEvent).toBeUndefined();
    });

    it("retrieves and starts #24 at 13 VP when a track is available", () => {
        const G = tutorialGame();
        startPapalBull(G);
        expect(choices(G)).toContain("holyLeague");
        const veniceBefore = G.powers.spain.influence.venice;
        choose(G, "holyLeague");
        expect(G.pendingTutorialEvent).toMatchObject({cardId: "vq-024", step: "influence"});
        choose(G, "influence:venice");
        expect(G.powers.spain.influence.venice).toBe(veniceBefore + 1);
    });

    it("does not offer #24 once every available track is resolved", () => {
        const G = tutorialGame();
        G.minorDiplomacyResolved.push("venice");
        G.majorDiplomacyResolved.push("hre");
        startPapalBull(G);
        expect(G.pendingTutorialEvent?.step).toBe("papalBenefit");
        expect(choices(G)).toEqual(["none"]);
    });
});

describe("tutorial event responses through two clients", () => {
    it("resolves #2 at the target Spain chose in the card drawer, without asking again", () => {
        const game = {...VirginQueenGameDef, seed: "tribute-target", setup: () => {
            const G = tutorialGame();
            G.dealtYear = G.year;
            G.powers.spain.cards = ["vq-021", "vq-022"];
            G.powers.ottoman.cards = ["vq-002"];
            return G;
        }};
        const multiplayer = Local();
        const clients = ["0", "1"].map((playerID) => Client({game, multiplayer, numPlayers: 2, playerID}));
        for (const client of clients) client.start();
        try {
            for (let step = 0; step < 4; step++) {
                const ctx = clients[0].getState()!.ctx;
                clients[Number(ctx.currentPlayer)].moves.endPhaseTurn();
            }
            clients[0].moves.playCard({cardId: "vq-002", asEvent: true, target: "spain"});
            const opened = clients[1].getState()!;
            // Spain — the target from the drawer — is asked, not the Ottoman.
            expect(opened.G.pendingTutorialEvent?.step).toBe("tribute");
            expect(opened.G.pendingTutorialEvent?.responding).toBe("spain");
            expect(opened.ctx.activePlayers).toEqual({"1": "tutorialEvent"});
            // No second target menu: the event does not re-offer other powers.
            expect(tutorialEventOptions(opened.G).map((entry) => entry.id)).not.toContain("war:hre");

            clients[1].moves.chooseTutorialEvent({choice: "offer"});
            expect(clients[0].getState()!.G.pendingTutorialEvent?.step).toBe("acceptTribute");
            // The Ottoman now decides, and accepting takes the card.
            expect(clients[0].getState()!.ctx.activePlayers).toEqual({"0": "tutorialEvent"});
            clients[0].moves.chooseTutorialEvent({choice: "accept"});
            for (const client of clients) {
                const state = client.getState()!;
                expect(state.G.pendingTutorialEvent).toBeUndefined();
                expect(state.ctx.activePlayers).toBeNull();
            }
        } finally {
            for (const client of clients) client.stop();
        }
    });

    it("declares war when the tutorial target refuses", () => {
        const game = {...VirginQueenGameDef, seed: "tribute-refuse", setup: () => {
            const G = tutorialGame();
            G.dealtYear = G.year;
            G.powers.spain.cards = ["vq-021"];
            G.powers.ottoman.cards = ["vq-002"];
            return G;
        }};
        const multiplayer = Local();
        const clients = ["0", "1"].map((playerID) => Client({game, multiplayer, numPlayers: 2, playerID}));
        for (const client of clients) client.start();
        try {
            for (let step = 0; step < 4; step++) {
                const ctx = clients[0].getState()!.ctx;
                clients[Number(ctx.currentPlayer)].moves.endPhaseTurn();
            }
            const cp = clients[0].getState()!.G.powers.ottoman.cp;
            clients[0].moves.playCard({cardId: "vq-002", asEvent: true, target: "spain"});
            clients[1].moves.chooseTutorialEvent({choice: "refuse"});
            const state = clients[0].getState()!;
            expect(state.G.pendingTutorialEvent).toBeUndefined();
            expect(state.G.powers.ottoman.cp).toBe(cp + 2);
        } finally {
            for (const client of clients) client.stop();
        }
    });

    it("routes rebel losses to Spain and restores the Ottoman impulse after the last choice", () => {
        const game = {...VirginQueenGameDef, seed: "rebels-response", setup: () => {
            const G = rebelGame();
            G.dealtYear = G.year;
            G.powers.ottoman.cards = ["vq-018"];
            G.spaces.tunis.land = {};
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
            clients[0].moves.playCard({cardId: "vq-018", asEvent: true});
            expect(clients[1].getState()!.ctx.activePlayers).toEqual({"0": "tutorialEvent"});
            clients[0].moves.chooseTutorialEvent({choice: "space:tunis"});
            expect(clients[1].getState()!.ctx.activePlayers).toEqual({"1": "tutorialEvent"});
            expect(clients[1].getState()!.G.pendingTutorialEvent?.step).toBe("rebelLosses");
            clients[1].moves.chooseTutorialEvent({choice: "loss:naval:spain:galley"});
            expect(clients[0].getState()!.G.pendingTutorialEvent?.step).toBe("rebelRegular");
            expect(clients[0].getState()!.ctx.activePlayers).toEqual({"0": "tutorialEvent"});
            clients[0].moves.chooseTutorialEvent({choice: "regular"});
            for (const client of clients) {
                expect(client.getState()!.G.pendingTutorialEvent).toBeUndefined();
                expect(client.getState()!.ctx.activePlayers).toBeNull();
                expect(client.getState()!.G.spaces.tunis.land.independent!.regular).toBe(1);
            }
            clients[0].moves.endImpulse();
            expect(clients[1].getState()!.ctx.currentPlayer).toBe("1");
        } finally {
            for (const client of clients) client.stop();
        }
    });

    it("completes Spanish Road during Spain's impulse and resumes normal turn order", () => {
        const game = {...VirginQueenGameDef, seed: "spanish-road", setup: () => {
            const G = tutorialGame();
            G.dealtYear = G.year;
            G.powers.ottoman.cards = [];
            G.powers.spain.cards = ["vq-003"];
            return G;
        }};
        const multiplayer = Local();
        const clients = ["0", "1"].map((playerID) => Client({game, multiplayer, numPlayers: 2, playerID}));
        for (const client of clients) client.start();
        try {
            for (let step = 0; step < 4; step++) {
                const ctx = clients[0].getState()!.ctx;
                clients[Number(ctx.currentPlayer)].moves.endPhaseTurn();
            }
            clients[0].moves.endImpulse();
            const milan = clients[1].getState()!.G.spaces.milan.land.spain!.regular;
            const genoa = clients[1].getState()!.G.spaces.genoa.land.spain?.regular ?? 0;
            clients[1].moves.playCard({cardId: "vq-003", asEvent: true});
            clients[1].moves.chooseTutorialEvent({choice: "none"});
            clients[1].moves.chooseTutorialEvent({choice: "add:spain:regular"});
            clients[1].moves.chooseTutorialEvent({choice: "deploy:genoa"});
            for (const client of clients) {
                const {G, ctx} = client.getState()!;
                expect(G.pendingTutorialEvent).toBeUndefined();
                expect(ctx.activePlayers).toBeNull();
                expect(ctx.currentPlayer).toBe("1");
                expect(G.spaces.milan.land.spain!.regular).toBe(milan);
                expect(G.spaces.genoa.land.spain!.regular).toBe(genoa + 1);
            }
            clients[1].moves.endImpulse();
            expect(clients[0].getState()!.ctx.currentPlayer).toBe("0");
        } finally {
            for (const client of clients) client.stop();
        }
    });
});
