import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {chooseBattle} from "./combat";
import {playCard} from "./moves";
import {startBattle} from "./combat";
import {discardCard, setupGame} from "./util";

const context = (playerID = "2"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
    events: {setActivePlayers: () => undefined, endStage: () => undefined, endTurn: () => undefined},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

/**
 * Rule 6.2: "A power may never retrieve a card from the discard pile that this
 * same power played as an Event, Response or Combat card earlier in the turn."
 * A card played for CP is *not* restricted, so the record lives in `discardCard`
 * which is only called with `asEvent: true` for the event-side plays.
 */
describe("rule 6.2 retrieval restriction", () => {
    it("records an event play so #36 cannot retrieve it back", () => {
        const G = game();
        G.powers.england.cards = ["vq-036", "vq-020"];
        // Play #20 as an event: it lands in the discard pile and is recorded.
        expect(playCard(G, context("2"), {cardId: "vq-020", asEvent: true, target: "papacy"})).toBeUndefined();
        expect(G.discard).toContain("vq-020");
        expect(G.playedThisTurn!.england).toContain("vq-020");

        // England's next impulse: the Virgin Queen cannot retrieve it.
        G.powers.england.cardPlayed = false;
        G.powers.england.cards = ["vq-036"];
        expect(playCard(G, context("2"), {cardId: "vq-036", asEvent: true, target: "retrieve:vq-020"})).toBeUndefined();
        expect(G.discard).toContain("vq-020");
        expect(G.powers.england.cards).not.toContain("vq-020");
    });

    it("records a Combat card when it is played in a battle", () => {
        const G = game();
        G.powers.england.cards = ["vq-008"];
        G.spaces.london.land.england = {regular: 4, merc: 0, cav: 0};
        G.spaces.london.land.france = {regular: 2, merc: 0, cav: 0};
        G.powers.england.wars = ["france"];
        G.powers.france.wars = ["england"];
        startBattle(G, context("2"), "field", "london", "england", ["france"], "london");
        // Skip the defender's avoid/withdraw decision; England now declares cards.
        G.pendingBattle = {...G.pendingBattle!, step: "attackerCards", responding: "england"};

        expect(chooseBattle(G, context("2"), {choice: "card:vq-008"})).toBeUndefined();
        expect(G.discard).toContain("vq-008");
        expect(G.playedThisTurn!.england).toContain("vq-008");
    });

    it("does not restrict a card played for CP", () => {
        const G = game();
        expect(discardCard).toBeDefined();
        // A CP play discards with `asEvent: false`.
        discardCard(G, "england", "vq-020", false);
        expect(G.discard).toContain("vq-020");
        expect(G.playedThisTurn?.england ?? []).not.toContain("vq-020");
    });
});
