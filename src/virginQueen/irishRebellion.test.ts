import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {chooseRebelMove, playCard} from "./moves";
import {setupGame} from "./util";

const events = () => ({setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()});

const context = (ev = events()): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
    events: ev,
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Irish Rebellion (card #57)", () => {
    it("halves the English garrisons and raises Ulster when Ireland allies", () => {
        const G = game();
        if (!G.powers.spain.cards.includes("vq-057")) G.powers.spain.cards.push("vq-057");
        G.minorDiplomacyResolved = G.minorDiplomacyResolved.filter((minor) => minor !== "ireland");
        for (const power of ["ottoman", "spain", "england", "france", "hre", "protestant"] as const) {
            G.powers[power].influence.ireland = 0;
        }
        G.powers.spain.influence.ireland = 9;
        G.spaces.dublin.land.england = {regular: 4, merc: 2, cav: 0};
        G.spaces.kinsale.land.england = {regular: 1, merc: 0, cav: 0};
        G.spaces.ulster.land = {england: {regular: 2, merc: 0, cav: 0}};
        G.spaces.ulster.control = "england";

        expect(playCard(G, context(), {cardId: "vq-057", asEvent: true})).toBeUndefined();

        expect(G.powers.spain.alliedMinors).toContain("ireland");
        expect(G.spaces.dublin.land.england.regular).toBe(2);
        expect(G.spaces.dublin.land.england.merc).toBe(1);
        expect(G.spaces.kinsale.land.england.regular).toBe(0);
        expect(G.spaces.ulster.land.england).toBeUndefined();
        expect(G.spaces.ulster.land.ireland?.regular).toBe(3);
    });

    it("sets pendingRebelMove after placing rebels", () => {
        const G = game();
        if (!G.powers.spain.cards.includes("vq-057")) G.powers.spain.cards.push("vq-057");
        G.minorDiplomacyResolved = G.minorDiplomacyResolved.filter((minor) => minor !== "ireland");
        for (const power of ["ottoman", "spain", "england", "france", "hre", "protestant"] as const) {
            G.powers[power].influence.ireland = 0;
        }
        G.powers.spain.influence.ireland = 9;
        G.spaces.ulster.land = {};
        G.spaces.ulster.control = "england";

        const ev = events();
        expect(playCard(G, context(ev), {cardId: "vq-057", asEvent: true})).toBeUndefined();

        expect(G.pendingRebelMove).toEqual({power: "spain", space: "ulster", minor: "ireland"});
        expect(ev.setActivePlayers).toHaveBeenCalled();
    });

    it("chooseRebelMove moves rebels to adjacent space", () => {
        const G = game();
        G.powers.spain.alliedMinors.push("ireland");
        G.spaces.ulster.land.ireland = {regular: 3, merc: 0, cav: 0};
        const dublinBefore = G.spaces.dublin.land.ireland?.regular ?? 0;
        G.pendingRebelMove = {power: "spain", space: "ulster", minor: "ireland"};

        const ev = events();
        const ctx = {...context(ev), playerID: "1"} as unknown as Ctx;
        expect(chooseRebelMove(G, ctx, {to: "dublin"})).toBeUndefined();

        expect(G.spaces.dublin.land.ireland?.regular).toBe(dublinBefore + 3);
        expect(G.spaces.ulster.land.ireland?.regular).toBe(0);
        expect(G.pendingRebelMove).toBeUndefined();
        expect(ev.endStage).toHaveBeenCalled();
    });

    it("chooseRebelMove decline leaves rebels in place", () => {
        const G = game();
        G.powers.spain.alliedMinors.push("ireland");
        G.spaces.ulster.land.ireland = {regular: 3, merc: 0, cav: 0};
        G.pendingRebelMove = {power: "spain", space: "ulster", minor: "ireland"};

        const ev = events();
        const ctx = {...context(ev), playerID: "1"} as unknown as Ctx;
        expect(chooseRebelMove(G, ctx, {to: "decline"})).toBeUndefined();

        expect(G.spaces.ulster.land.ireland?.regular).toBe(3);
        expect(G.pendingRebelMove).toBeUndefined();
        expect(ev.endStage).toHaveBeenCalled();
    });

    it("chooseRebelMove rejects non-adjacent space", () => {
        const G = game();
        G.powers.spain.alliedMinors.push("ireland");
        G.spaces.ulster.land.ireland = {regular: 3, merc: 0, cav: 0};
        G.pendingRebelMove = {power: "spain", space: "ulster", minor: "ireland"};

        const ev = events();
        const ctx = {...context(ev), playerID: "1"} as unknown as Ctx;
        // Cork is not adjacent to Ulster
        expect(chooseRebelMove(G, ctx, {to: "cork"})).toBeDefined();
        expect(G.pendingRebelMove).toBeDefined();
    });

    it("chooseRebelMove rejects wrong player", () => {
        const G = game();
        G.powers.spain.alliedMinors.push("ireland");
        G.spaces.ulster.land.ireland = {regular: 3, merc: 0, cav: 0};
        G.pendingRebelMove = {power: "spain", space: "ulster", minor: "ireland"};

        const ev = events();
        // playerID "0" does not own Spain (seat "1")
        const ctx = {...context(ev), playerID: "0"} as unknown as Ctx;
        expect(chooseRebelMove(G, ctx, {to: "dublin"})).toBeDefined();
        expect(G.pendingRebelMove).toBeDefined();
    });
});
