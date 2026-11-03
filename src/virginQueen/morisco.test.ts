import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame, landCount} from "./constant/general";
import {SPACES} from "./mapData";
import {playCard} from "./moves";
import {clearWar, setupGame, winter} from "./util";

const context = (player = "0"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx);

const campaign = (): VQGame => setupGame(context());
const tournament = (): VQGame => setupGame(context(), {scenario: "tournament"});

const unrestCount = (G: VQGame): number => SPACES.filter((space) => G.spaces[space.id].unrest).length;

describe("Morisco Revolt (card #28 / rule 20.1)", () => {
    it("starts in play in the Tournament scenario but not the Campaign", () => {
        const tournamentGame = tournament();
        expect(tournamentGame.morisco).toEqual({space: "granada", units: 2});
        expect(tournamentGame.spaces.granada.land.ottoman?.regular).toBe(2);
        expect(tournamentGame.spaces.granada.unrest).toBe(true);

        const campaignGame = campaign();
        expect(campaignGame.morisco).toBeUndefined();
        expect(campaignGame.spaces.granada.land.ottoman).toBeUndefined();
    });

    it("resolves card #28: clears Granada, adds the unit and spreads unrest", () => {
        const G = campaign();
        G.powers.ottoman.cards = ["vq-028"];
        G.powers.ottoman.cp = 2;
        G.spaces.granada.unrest = false;
        G.spaces.granada.land.spain = {regular: 1, merc: 0, cav: 0};
        const unrestBefore = unrestCount(G);

        expect(playCard(G, context("0"), {cardId: "vq-028", asEvent: true})).toBeUndefined();

        expect(G.spaces.granada.land.spain).toBeUndefined();
        expect(G.spaces.granada.unrest).toBe(true);
        expect(G.morisco).toEqual({space: "granada", units: 2});
        expect(G.spaces.granada.land.ottoman?.regular).toBe(2);
        expect(unrestCount(G)).toBeGreaterThanOrEqual(unrestBefore + 2);
        expect(G.powers.ottoman.cards).not.toContain("vq-028");
    });

    it("cannot be played as an event while not at war or while already in play", () => {
        const G = campaign();
        G.powers.ottoman.cards = ["vq-028"];
        G.powers.ottoman.cp = 2;
        G.powers.ottoman.wars = [];
        G.powers.spain.wars = [];
        expect(playCard(G, context("0"), {cardId: "vq-028", asEvent: true})).toBe(INVALID_MOVE);
        expect(G.powers.ottoman.cards).toContain("vq-028");

        const tournamentGame = tournament();
        tournamentGame.powers.ottoman.cards = ["vq-028"];
        tournamentGame.powers.ottoman.cp = 2;
        expect(playCard(tournamentGame, context("0"), {cardId: "vq-028", asEvent: true})).toBe(INVALID_MOVE);
    });

    it("spreads two more unrest each winter and never moves the Morisco unit", () => {
        const G = tournament();
        G.powers.ottoman.cp = 5;
        const unrestBefore = unrestCount(G);
        const granadaBefore = landCount(G.spaces.granada.land.ottoman);

        winter(G, context());

        expect(G.morisco).toEqual({space: "granada", units: 2});
        expect(landCount(G.spaces.granada.land.ottoman)).toBe(granadaBefore);
        expect(unrestCount(G)).toBeGreaterThanOrEqual(unrestBefore + 2);
        expect(G.log.join("\n")).toContain("Morisco Revolt: unrest");
    });

    it("is removed when the Ottoman-Spanish war ends", () => {
        const G = tournament();
        expect(G.morisco).toBeDefined();

        clearWar(G, "ottoman", "spain");

        expect(G.morisco).toBeUndefined();
        expect(landCount(G.spaces.granada.land.ottoman)).toBe(0);
        expect(G.removed).toContain("vq-028");
    });

    it("is eliminated when besieging a fortified space at the start of winter", () => {
        const G = tournament();
        G.spaces.granada.fortress = true;
        G.spaces.granada.siege = {by: "ottoman", sinceImpulse: 1};

        winter(G, context());

        expect(G.morisco).toBeUndefined();
        expect(landCount(G.spaces.granada.land.ottoman)).toBe(0);
        expect(G.log.join("\n")).toContain("besieging a fortified space");
    });
});
