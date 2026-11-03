import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {INVALID_MOVE} from "boardgame.io/core";
import {Local} from "boardgame.io/multiplayer";
import {POWERS, VQGame} from "./constant/general";
import {cardById} from "./constant/cards";
import {VirginQueenGameDef} from "./game";
import {declineGregorianCalendar, playCard} from "./moves";
import {homeCardsInHand, homeCardChoiceRequired, setupGame} from "./util";

const actionCtx = (playerID: string, currentPlayer = playerID): Ctx => ({
    currentPlayer,
    playerID,
    phase: "action",
    activePlayers: null,
    numPlayers: 6,
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...actionCtx("0"), phase: "action"} as Ctx);

const turnBegin = VirginQueenGameDef.phases!.action!.turn!.onBegin as (G: VQGame, ctx: Ctx) => void;
const turnEnd = VirginQueenGameDef.phases!.action!.turn!.onEnd as (G: VQGame, ctx: Ctx) => void;

/** Ottoman finishes its turn while France holds #101. */
const endOttomanTurn = (G: VQGame): void => {
    G.activePower = "ottoman";
    G.powers.spain.cp = 7;
    G.powers.spain.cardPlayed = true;
    G.powers.france.cards = ["vq-101"];
    turnEnd(G, actionCtx("0"));
};

describe("Gregorian Calendar after-turn response (card #101)", () => {
    it("opens a response window before the next power's turn is initialized", () => {
        const G = game();
        G.impulse = 1;
        endOttomanTurn(G);

        expect(G.activePower).toBe("spain");
        expect(G.gregorianResponse).toEqual({after: "ottoman", responder: "france"});

        const begin = actionCtx("1");
        turnBegin(G, begin);
        expect(begin.events!.setActivePlayers).toHaveBeenCalledWith({value: {3: "gregorianResponse"}});
        // Spain's turn has begun structurally, but none of its resources were spent.
        expect(G.impulse).toBe(1);
        expect(G.powers.spain.cp).toBe(7);
        expect(G.powers.spain.cardPlayed).toBe(true);

        const decline = actionCtx("3", "1");
        expect(declineGregorianCalendar(G, decline)).toBeUndefined();
        expect(G.gregorianResponse).toBeUndefined();
        expect(decline.events!.endStage).toHaveBeenCalled();
        expect(G.impulse).toBe(2);
        expect(G.powers.spain.cp).toBe(0);
        expect(G.powers.spain.cardPlayed).toBe(false);
    });

    it("lets the holder play it as a response and starts the chosen power's round", () => {
        const G = game();
        G.impulse = 1;
        G.powers.france.alliedMinors = ["papacy"];
        const handBefore = 1;
        const deckBefore = G.deck.length;
        endOttomanTurn(G);
        G.consecutivePasses = 4;
        turnBegin(G, actionCtx("1"));

        const play = actionCtx("3", "1");
        (play as unknown as {activePlayers: Record<string, string>}).activePlayers = {3: "gregorianResponse"};
        expect(playCard(G, play, {cardId: "vq-101", asEvent: true, target: "hre"})).toBeUndefined();

        expect(G.gregorianNext).toBe("hre");
        expect(G.removed).toContain("vq-101");
        expect(G.powers.france.cards).not.toContain("vq-101");
        // Papacy ally bonus: draw one card, then the event removes itself.
        expect(G.powers.france.cards).toHaveLength(handBefore - 1 + 1);
        expect(G.deck).toHaveLength(deckBefore - 1);
        expect(play.events!.endTurn).toHaveBeenCalled();

        // The interrupted Spanish turn ends without acting and the target begins.
        turnEnd(G, actionCtx("1"));
        expect(G.activePower).toBe("hre");
        expect(G.gregorianNext).toBeUndefined();
        expect(G.gregorianResponse).toBeUndefined();
        expect(G.consecutivePasses).toBe(0);

        const begin = actionCtx("4");
        turnBegin(G, begin);
        expect(begin.events!.setActivePlayers).not.toHaveBeenCalled();
        expect(G.impulse).toBe(2);
        expect(G.powers.hre.cp).toBe(0);
        expect(G.powers.hre.cardPlayed).toBe(false);
    });

    it("refuses the response from a power other than the holder", () => {
        const G = game();
        endOttomanTurn(G);
        turnBegin(G, actionCtx("1"));

        const play = actionCtx("1", "1");
        (play as unknown as {activePlayers: Record<string, string>}).activePlayers = {"1": "gregorianResponse"};
        expect(playCard(G, play, {cardId: "vq-101", asEvent: true, target: "hre"})).toBe(INVALID_MOVE);
        expect(G.powers.france.cards).toContain("vq-101");
        expect(G.gregorianNext).toBeUndefined();
    });

    it("pivots the next action round to the finished power itself", () => {
        const G = game();
        G.impulse = 1;
        endOttomanTurn(G);
        turnBegin(G, actionCtx("1"));

        const play = actionCtx("3", "1");
        (play as unknown as {activePlayers: Record<string, string>}).activePlayers = {3: "gregorianResponse"};
        expect(playCard(G, play, {cardId: "vq-101", asEvent: true, target: "ottoman"})).toBeUndefined();
        expect(G.gregorianNext).toBe("ottoman");

        turnEnd(G, actionCtx("1"));
        expect(G.activePower).toBe("ottoman");
        turnBegin(G, actionCtx("0"));
        expect(G.powers.ottoman.cp).toBe(0);
        expect(G.impulse).toBe(2);
    });

    it("runs the window through real boardgame.io turn flow", () => {
        const spec = {
            numPlayers: 6,
            game: {
                ...VirginQueenGameDef,
                seed: "vq-gregorian-response",
                setup: (ctx: Ctx) => {
                    const G = setupGame(ctx);
                    G.powers.france.cards = ["vq-101"];
                    return G;
                },
            },
            multiplayer: Local(),
        };
        const clients = POWERS.map((_, i) => {
            const client = Client<VQGame, Ctx>({...spec, playerID: String(i)} as never) as never as {
                start: () => void;
                stop: () => void;
                getState: () => {G: VQGame; ctx: Ctx};
                moves: Record<string, (args?: unknown) => void>;
            };
            client.start();
            return client;
        });
        try {
            // Card Draw, Diplomacy and Spring Deployment.
            for (let i = 0; i < 6; i++) clients[i].moves.endPhaseTurn();
            for (let i = 0; i < 6; i++) clients[i].moves.endPhaseTurn();
            for (let i = 0; i < 6; i++) {
                const state = clients[i].getState();
                if (i === 4 && !state.G.hreReligiousPreferenceChosen) {
                    (clients[i].moves as unknown as {chooseHreReligiousPreference: (a: {preference: string}) => void})
                        .chooseHreReligiousPreference({preference: "balanced"});
                }
                if (homeCardChoiceRequired(state.G, POWERS[i])) {
                    (clients[i].moves as unknown as {chooseHomeCard: (a: {cardId: string}) => void})
                        .chooseHomeCard({cardId: homeCardsInHand(state.G, POWERS[i])[0]});
                }
                clients[i].moves.endPhaseTurn();
            }
            expect(clients[0].getState().ctx.phase).toBe("action");
            expect(clients[3].getState().G.powers.france.cards).toContain("vq-101");

            const ottomanHand = clients[0].getState().G.powers.ottoman.cards;
            const card = ottomanHand.find((id) => cardById(id).kind !== "home" &&
                cardById(id).officialKind !== "mandatory");
            if (card !== undefined) clients[0].moves.playCard({cardId: card});
            clients[0].moves.endImpulse();

            const awaiting = clients[0].getState();
            expect(awaiting.G.gregorianResponse).toEqual({after: "ottoman", responder: "france"});
            expect(awaiting.ctx.activePlayers).toEqual({3: "gregorianResponse"});

            (clients[3].moves as unknown as {playCard: (a: {cardId: string; asEvent: boolean; target: string}) => void})
                .playCard({cardId: "vq-101", asEvent: true, target: "hre"});
            const resolved = clients[0].getState();
            expect(resolved.G.activePower).toBe("hre");
            expect(resolved.ctx.currentPlayer).toBe("4");
            expect(resolved.G.removed).toContain("vq-101");
            expect(resolved.G.gregorianResponse).toBeUndefined();
        } finally {
            clients.forEach((client) => client.stop());
        }
    });
});
