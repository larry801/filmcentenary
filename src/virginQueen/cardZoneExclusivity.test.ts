import {Ctx} from "boardgame.io";
import {POWERS, VQGame} from "./constant/general";
import {removeCardFromGame, setupGame} from "./util";
import {discardCard} from "./util";

/**
 * One physical card copy may only live in one zone.  `removeCardFromGame` used
 * to clear the deck, discard, future deck, the public Home set-aside and every
 * hand, but not `homeCardSetAside` — the face-down Spring pile.  Assassinating
 * Elizabeth I removes the Virgin Queen from the game, so an England that had
 * set the card aside carried the same physical copy in `removed` and in the
 * secret pile at once (found by the seeded self-play sweep).
 */
const context = (): Ctx => ({
    currentPlayer: "0",
    playerID: "0",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
    events: {setActivePlayers: () => undefined, endStage: () => undefined, endTurn: () => undefined},
} as unknown as Ctx);

/** Every zone that can hold a card, named for readable failures. */
const zones = (G: VQGame, cardId: string): string[] => {
    const found: string[] = [];
    if (G.deck.includes(cardId)) found.push("deck");
    if (G.discard.includes(cardId)) found.push("discard");
    if (G.futureDeck.includes(cardId)) found.push("futureDeck");
    if (G.removed.includes(cardId)) found.push("removed");
    if (G.homeSetAside.includes(cardId)) found.push("homeSetAside");
    for (const power of POWERS) {
        if (G.powers[power].cards.includes(cardId)) found.push(`${power} hand`);
        if ((G.powers[power].homeCardSetAside ?? []).includes(cardId)) found.push(`${power} homeCardSetAside`);
    }
    return found;
};

describe("removeCardFromGame clears every zone a card can occupy", () => {
    it("drops a Home card that was set aside face down in Spring", () => {
        const G = setupGame(context());
        G.powers.england.homeCardSetAside = ["vq-036"];
        G.powers.england.cards = ["vq-036", "vq-003"];

        removeCardFromGame(G, "vq-036");

        expect(zones(G, "vq-036")).toEqual(["removed"]);
        // Unrelated cards are untouched.
        expect(G.powers.england.cards).toEqual(["vq-003"]);
    });

    it("drops a card from a hand, the discard pile and the future deck at once", () => {
        const G = setupGame(context());
        G.powers.spain.cards = ["vq-020"];
        G.discard = ["vq-020"];
        G.futureDeck = ["vq-020"];
        G.homeSetAside = ["vq-020"];

        removeCardFromGame(G, "vq-020");

        expect(zones(G, "vq-020")).toEqual(["removed"]);
    });

    it("records the card exactly once even when it is removed twice", () => {
        const G = setupGame(context());
        G.powers.england.homeCardSetAside = ["vq-036"];
        removeCardFromGame(G, "vq-036");
        removeCardFromGame(G, "vq-036");
        expect(G.removed.filter((id) => id === "vq-036")).toHaveLength(1);
    });

    it("keeps a used Home card in the public set-aside until it is removed", () => {
        const G = setupGame(context());
        G.powers.england.cards = ["vq-036"];
        // `playCard` removes the card from hand before discarding it; a Home
        // card played for CP then parks in the public set-aside, not `removed`.
        G.powers.england.cards = [];
        discardCard(G, "england", "vq-036", false);
        expect(zones(G, "vq-036")).toEqual(["homeSetAside"]);
    });
});
