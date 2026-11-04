import {Ctx} from "boardgame.io";
import {POWERS, VQGame} from "./constant/general";
import {canPlayHolyLeague, playCard} from "./moves";
import {setupGame} from "./util";

const context = (currentPlayer = "1"): Ctx => ({
    currentPlayer,
    playerID: currentPlayer,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const campaign = (currentPlayer = "1"): VQGame => setupGame(context(currentPlayer));

/**
 * The common case: the Papacy was already resolved and is allied to Spain, so
 * playing #5 does not roll Papal diplomacy and the Papal ally is deterministic.
 */
const resolvedPapacy = (): VQGame => {
    const G = campaign();
    G.powers.spain.alliedMinors = ["papacy"];
    G.minorDiplomacyResolved = [...new Set([...G.minorDiplomacyResolved, "papacy"])];
    return G;
};

/** #5 played with the "retrieve and execute #24 Holy League" benefit. */
const retrieveHolyLeague = (G: VQGame, currentPlayer = "1") =>
    playCard(G, context(currentPlayer), {cardId: "vq-005", asEvent: true, target: "holyLeague"});

describe("Papal Bull (card #5) retrieving Holy League (card #24)", () => {
    it("does not execute #24 while the Ottoman has fewer than 13 VP", () => {
        const G = resolvedPapacy();
        G.powers.spain.cards = ["vq-005"];
        G.discard = ["vq-024"];
        const veniceBefore = G.powers.spain.influence.venice;

        expect(retrieveHolyLeague(G)).toBeUndefined();

        // Papal Bull is still a legal event, but the ineligible #24 benefit is
        // simply not claimed and the card remains in the discard pile.
        expect(G.powers.spain.cardPlayed).toBe(true);
        expect(G.discard).toContain("vq-024");
        expect(G.powers.spain.influence.venice).toBe(veniceBefore);
        expect(G.log.join("\n")).not.toContain("Holy League");
    });

    it("executes #24 at exactly 13 Ottoman VP when a track is still available", () => {
        const G = resolvedPapacy();
        G.powers.spain.cards = ["vq-005"];
        G.discard = ["vq-024"];
        G.powers.ottoman.bonusVp += 2; // Campaign starts the Ottoman at 11 VP.
        const veniceBefore = G.powers.spain.influence.venice;

        expect(canPlayHolyLeague(G, "spain")).toBe(true);

        expect(retrieveHolyLeague(G)).toBeUndefined();

        expect(G.discard).not.toContain("vq-024");
        expect(G.powers.spain.influence.venice).toBeGreaterThan(veniceBefore);
        expect(G.log.join("\n")).toContain("Holy League adds");
    });

    it("does not execute #24 when every available track is already resolved", () => {
        const G = resolvedPapacy();
        G.powers.spain.cards = ["vq-005"];
        G.discard = ["vq-024"];
        G.powers.ottoman.bonusVp += 2;
        // Six-player Campaign: the HRE is a player power, so only the Papacy
        // and Venice tracks exist.  Papacy is resolved above, Venice here.
        G.minorDiplomacyResolved.push("venice");

        expect(canPlayHolyLeague(G, "spain")).toBe(false);

        expect(retrieveHolyLeague(G)).toBeUndefined();

        expect(G.discard).toContain("vq-024");
        expect(G.log.join("\n")).not.toContain("Holy League");
    });

    it("checks the Papal ally's eligibility, not the Papal Bull player's", () => {
        const G = resolvedPapacy();
        G.powers.england.cards = ["vq-005"];
        G.discard = ["vq-024"];
        G.powers.ottoman.bonusVp += 2;
        const veniceBefore = G.powers.spain.influence.venice;

        // England holds and plays #5, but the benefit belongs to the Papal
        // ally (Spain).  England itself cannot influence either track, while
        // Spain can, so the retrieval must be judged against Spain.
        expect(canPlayHolyLeague(G, "england")).toBe(false);

        expect(retrieveHolyLeague(G, "2")).toBeUndefined(); // Seat 2 = England.

        expect(G.discard).not.toContain("vq-024");
        expect(G.powers.spain.influence.venice).toBeGreaterThan(veniceBefore);
    });

    it("applies the checks after Papal Bull resolves the Papacy", () => {
        const G = campaign();
        G.powers.spain.cards = ["vq-005"];
        G.discard = ["vq-024"];
        G.powers.ottoman.bonusVp += 2;
        // Only the Papacy is unresolved, so a check made before #5's own
        // Papal resolution would wrongly allow the retrieval.
        G.minorDiplomacyResolved = ["venice"];
        for (const power of POWERS) G.powers[power].influence.papacy = 0;
        G.powers.spain.influence.papacy = 9;
        expect(canPlayHolyLeague(G, "spain")).toBe(true);

        expect(retrieveHolyLeague(G)).toBeUndefined();

        expect(G.minorDiplomacyResolved).toContain("papacy");
        expect(G.powers.spain.alliedMinors).toContain("papacy");
        expect(G.discard).toContain("vq-024");
        expect(G.log.join("\n")).not.toContain("Holy League");
    });

    it("still retrieves #24 after resolving the Papacy when Venice is available", () => {
        const G = campaign();
        G.powers.spain.cards = ["vq-005"];
        G.discard = ["vq-024"];
        G.powers.ottoman.bonusVp += 2;
        G.minorDiplomacyResolved = [];
        for (const power of POWERS) G.powers[power].influence.papacy = 0;
        G.powers.spain.influence.papacy = 9;
        const veniceBefore = G.powers.spain.influence.venice;

        expect(retrieveHolyLeague(G)).toBeUndefined();

        expect(G.minorDiplomacyResolved).toContain("papacy");
        expect(G.discard).not.toContain("vq-024");
        expect(G.powers.spain.influence.venice).toBeGreaterThan(veniceBefore);
        expect(G.log.join("\n")).toContain("Holy League adds");
    });
});
