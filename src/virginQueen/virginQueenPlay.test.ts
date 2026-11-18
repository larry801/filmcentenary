import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

/** England holds #36, Elizabeth is betrothed, and Papal Bull is in the discard pile. */
const prepare = (): VQGame => {
    const G = game();
    G.powers.england.cards = ["vq-036"];
    G.betrothals = [{male: "charlesIX", female: "elizabeth"}];
    G.powers.england.alliedMinors = ["papacy"];
    G.minorDiplomacyResolved = [...new Set([...G.minorDiplomacyResolved, "papacy"])];
    // Rule 6.2: #5 Papal Bull is a Mandatory Event, so it can never be
    // retrieved.  The tests use Eloquent Ambassador (#20), an ordinary Event.
    G.discard = ["vq-020"];
    return G;
};

describe("Virgin Queen retrieve-and-play option (card #36)", () => {
    it("retrieves a card and resolves its event immediately", () => {
        const G = prepare();

        expect(playCard(G, context(), {
            cardId: "vq-036", asEvent: true, target: "retrieve:vq-020:play:papacy",
        })).toBeUndefined();

        expect(G.discard).toContain("vq-020");
        // The log is localized, so assert on the card id path instead of a name.
        expect(G.log.join("\n")).toContain("童贞女王");
        // retrieve-and-play is still a retrieve choice: the betrothal is not jilted.
        expect(G.betrothals).toHaveLength(1);
    });

    it("never retrieves a Mandatory Event from the discard pile (rule 6.2)", () => {
        const G = prepare();
        G.discard = ["vq-005"];

        expect(playCard(G, context(), {
            cardId: "vq-036", asEvent: true, target: "retrieve:vq-005:play:excommunicate",
        })).toBeUndefined();

        expect(G.elizabethExcommunicated).toBeFalsy();
        expect(G.discard).toEqual(["vq-005"]);
        expect(G.powers.england.cards).not.toContain("vq-005");
    });

    it("never retrieves a card England played this turn (rule 6.2)", () => {
        const G = prepare();
        G.playedThisTurn = {england: ["vq-020"]};

        expect(playCard(G, context(), {cardId: "vq-036", asEvent: true, target: "retrieve:vq-020"})).toBeUndefined();

        expect(G.discard).toContain("vq-020");
        expect(G.powers.england.cards).not.toContain("vq-020");
    });

    it("keeps retrieve:<cardId> as the keep-in-hand form", () => {
        const G = prepare();

        expect(playCard(G, context(), {cardId: "vq-036", asEvent: true, target: "retrieve:vq-020"})).toBeUndefined();

        expect(G.powers.england.cards).toContain("vq-020");
        expect(G.discard).not.toContain("vq-020");
        expect(G.betrothals).toHaveLength(1);
    });

    it("does not mutate the discard pile when the requested card is absent", () => {
        const G = prepare();
        G.discard = ["vq-021"];

        expect(playCard(G, context(), {
            cardId: "vq-036", asEvent: true, target: "retrieve:vq-020:play:papacy",
        })).toBeUndefined();

        expect(G.discard).toEqual(["vq-021"]);
        expect(G.powers.england.cards).not.toContain("vq-020");
    });

    it("leaves an unplayable card in the discard pile", () => {
        const G = prepare();
        // Storms (#15) is a response card and cannot be played as an event now.
        G.discard = ["vq-015"];

        expect(playCard(G, context(), {cardId: "vq-036", asEvent: true, target: "retrieve:vq-015:play"})).toBeUndefined();

        expect(G.discard).toEqual(["vq-015"]);
        expect(G.powers.england.cards).not.toContain("vq-015");
        expect(G.log.join("\n")).toContain("remains in the discard pile");
    });
});
