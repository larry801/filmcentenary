import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {Local} from "boardgame.io/multiplayer";
import {VQGame} from "./constant/general";
import {VirginQueenGameDef} from "./game";
import {startBattle} from "./combat";
import {playVirginQueenCombat} from "./moves";
import {bestBattle, setupGame, totalLand} from "./util";

const context = (playerID = "2"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

/**
 * A normal action-phase board where Spain can march from London into the open
 * space at Norwich.  England's only army is the defender, and every other
 * neighbour is occupied by Spain, so there is no avoid-battle destination.
 */
const battleSetup = (ctx: Ctx): VQGame => {
    const G = setupGame(ctx);
    G.dealtYear = G.year;
    G.powers.ottoman.cards = [];
    G.powers.spain.cards = ["vq-021"];
    G.powers.england.cards = ["vq-036"];
    G.powers.england.cardPlayed = false;
    G.powers.france.cards = [];
    G.powers.protestant.cards = [];
    G.powers.hre.cards = [];
    G.discard = ["vq-008", "vq-009"];
    G.spaces.london.land = {spain: {regular: 1, merc: 0, cav: 0}};
    G.spaces.norwich.land = {england: {regular: 2, merc: 0, cav: 0}, spain: {regular: 1, merc: 0, cav: 0}};
    G.spaces.york.land = {spain: {regular: 1, merc: 0, cav: 0}};
    G.spaces.dover.land = {spain: {regular: 1, merc: 0, cav: 0}};
    if (!G.powers.spain.wars.includes("england")) G.powers.spain.wars.push("england");
    if (!G.powers.england.wars.includes("spain")) G.powers.england.wars.push("spain");
    return G;
};

const makeGame = () => ({
    ...VirginQueenGameDef,
    seed: "vq-virgin-queen-battle-stage",
    setup: battleSetup,
    phases: {action: {...VirginQueenGameDef.phases!.action, start: true}},
    // Test-only trigger for a non-tutorial battle stage.  It calls the same
    // production `startBattle` used by interception/tutorial combat, so the
    // stage, active-player prompt and move routing are the real game ones.
    moves: {
        ...VirginQueenGameDef.moves,
        beginBattle: (G: VQGame, ctx: Ctx) => {
            startBattle(G, ctx, "field", "norwich", "spain", ["england"], "london");
        },
        beginEnglandAttack: (G: VQGame, ctx: Ctx) => {
            startBattle(G, ctx, "field", "norwich", "england", ["spain"], "london");
        },
    },
});

const clients = () => {
    // A fresh game object keeps boardgame.io's Local master (keyed by the game
    // object) isolated between tests.
    const game = makeGame();
    const multiplayer = Local();
    return [0, 1, 2, 3, 4, 5].map((id) => Client({game, multiplayer, numPlayers: 6, playerID: String(id)}));
};

/** Ottoman passes, Spain becomes active, then an open battle stage is created. */
const openBattle = (all: ReturnType<typeof clients>): VQGame => {
    all[0].moves.endImpulse();
    expect(all[1].getState()!.ctx.currentPlayer).toBe("1");
    all[1].moves.beginBattle();
    const state = all[2].getState()!;
    expect(state.G.pendingBattle).toMatchObject({phase: "field", location: "norwich", attacker: "spain"});
    expect(state.ctx.activePlayers).toEqual({"2": "battleChoice"});
    return state.G;
};

describe("Virgin Queen (#36) from a normal battle stage", () => {
    it("lets the responding England client retrieve and register a Combat card, then continue the battle", () => {
        const all = clients();
        for (const client of all) client.start();
        try {
            const G = openBattle(all);

            all[2].moves.playVirginQueenCombat({target: "retrieve:vq-008:play"});

            const state = all[2].getState()!;
            expect(state.G.pendingBattle!.cards.england).toEqual(["vq-008"]);
            expect(state.G.powers.england.cards).not.toContain("vq-008");
            expect(state.G.powers.england.cards).not.toContain("vq-036");
            expect(state.G.homeSetAside).toContain("vq-036");
            expect(state.G.log.join("\n")).toContain("英格兰 plays 精锐部队 for the field battle");
            expect(state.ctx.activePlayers).toEqual({"2": "battleChoice"});

            // Normal battle choices still drive the same battle.
            all[2].moves.chooseBattle({choice: "fight"});
            expect(all[1].getState()!.ctx.activePlayers).toEqual({"1": "battleChoice"});
            all[1].moves.chooseBattle({choice: "done"});
            expect(all[2].getState()!.ctx.activePlayers).toEqual({"2": "battleChoice"});
            all[2].moves.chooseBattle({choice: "done"});

            const resolved = all[2].getState()!.G;
            expect(resolved.pendingBattle!.rolls).toBeDefined();
            // Elite Troops adds three dice to England's defending roll.
            expect(resolved.pendingBattle!.rolls!.defender.length).toBe(
                totalLand(G, "norwich", ["england"]) + bestBattle(G, "norwich", ["england"], "army") + 1 + 3);
        } finally {
            for (const client of all) client.stop();
        }
    });

    it("activates the England seat as the attacking side and releases its auxiliary stage", () => {
        const all = clients();
        for (const client of all) client.start();
        try {
            all[0].moves.endImpulse();
            expect(all[1].getState()!.ctx.currentPlayer).toBe("1");
            all[1].moves.beginEnglandAttack();

            const opened = all[2].getState()!;
            expect(opened.G.pendingBattle).toMatchObject({phase: "field", location: "norwich", attacker: "england"});
            // The responder keeps the normal stage, and England gets a parallel
            // one that only exposes the #36 immediate play.
            expect(opened.ctx.activePlayers).toEqual({"1": "battleChoice", "2": "battleChoice"});

            all[2].moves.playVirginQueenCombat({target: "retrieve:vq-008:play"});

            const after = all[2].getState()!;
            expect(after.G.pendingBattle!.cards.england).toEqual(["vq-008"]);
            // England's auxiliary stage is released; Spain remains in control of
            // the battle and can make its normal choice.
            expect(after.ctx.activePlayers).toEqual({"1": "battleChoice"});
            all[1].moves.chooseBattle({choice: "fight"});
            expect(all[2].getState()!.ctx.activePlayers).toEqual({"2": "battleChoice"});
        } finally {
            for (const client of all) client.stop();
        }
    });

    it("keeps a phase-mismatched Combat card in the discard pile and leaves the battle playable", () => {
        const all = clients();
        for (const client of all) client.start();
        try {
            openBattle(all);

            // Fire Ships (#9) is a naval card; this is a field battle.
            all[2].moves.playVirginQueenCombat({target: "retrieve:vq-009:play"});

            const state = all[2].getState()!;
            expect(state.G.pendingBattle!.cards).toEqual({});
            expect(state.G.powers.england.cards).not.toContain("vq-009");
            expect(state.G.powers.england.cards).not.toContain("vq-036");
            expect(state.G.log.join("\n")).toContain("remains in the discard pile");
            expect(state.ctx.activePlayers).toEqual({"2": "battleChoice"});

            // The normal defender choice is untouched after the rollback.
            all[2].moves.chooseBattle({choice: "fight"});
            expect(all[1].getState()!.ctx.activePlayers).toEqual({"1": "battleChoice"});
        } finally {
            for (const client of all) client.stop();
        }
    });
});

describe("Virgin Queen (#36) attacker/defender combat subsets", () => {
    const virginQueen = (G: VQGame): VQGame => {
        G.powers.england.cards = ["vq-036"];
        G.powers.england.cardPlayed = false;
        return G;
    };

    it("still registers #7 Desperate Assault for England as the attacking side", () => {
        const G = virginQueen(battleSetup(context()));
        G.spaces.london.land.england = {regular: 3, merc: 0, cav: 0};
        G.spaces.london.land.spain = {regular: 2, merc: 0, cav: 0};
        G.discard = ["vq-007"];
        startBattle(G, context(), "assault", "london", "england", ["spain"], "calais");

        expect(playVirginQueenCombat(G, context(), {target: "retrieve:vq-007:play"})).toBeUndefined();

        expect(G.pendingBattle!.cards.england).toEqual(["vq-007"]);
        expect(G.powers.england.cards).toEqual([]);
    });

    it("keeps #7 attacker-only when England is the defending side", () => {
        const G = virginQueen(battleSetup(context()));
        G.discard = ["vq-007"];
        startBattle(G, context("1"), "field", "norwich", "spain", ["england"], "london");

        expect(playVirginQueenCombat(G, context(), {target: "retrieve:vq-007:play"})).toBeUndefined();

        expect(G.pendingBattle!.cards).toEqual({});
        expect(G.discard).toContain("vq-007");
        expect(G.powers.england.cards).toEqual([]);
        expect(G.log.join("\n")).toContain("remains in the discard pile");
    });
});
