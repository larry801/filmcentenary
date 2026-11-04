import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {maryInfluence, playCard} from "./moves";
import {setupGame} from "./util";

const context = (powerIndex: string): Ctx => ({
    currentPlayer: powerIndex,
    playerID: powerIndex,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context("3"), phase: "action"} as Ctx);

/**
 * Rule 24.5: a power's Influence marker stops on the "9" space; no rule allows
 * an event to push it past 9.  Purchased influence already clamps, so every
 * card effect that grants influence must clamp too.
 */
describe("diplomatic influence is capped at 9", () => {
    it("caps Border Reivers at 9", () => {
        const G = game();
        G.powers.england.cards = ["vq-041"];
        G.powers.england.influence.scotland = 8;

        expect(playCard(G, context("2"), {cardId: "vq-041", asEvent: true})).toBeUndefined();

        expect(G.powers.england.influence.scotland).toBe(9);
    });

    it("caps John Knox at 9", () => {
        const G = game();
        G.powers.england.cards = ["vq-060"];
        G.powers.england.influence.scotland = 8;

        expect(playCard(G, context("2"), {cardId: "vq-060", asEvent: true})).toBeUndefined();

        expect(G.powers.england.influence.scotland).toBe(9);
    });

    it("caps the Mary Queen of Scots event at 9", () => {
        const G = game();
        G.powers.france.cards = ["vq-089"];
        G.powers.france.influence.scotland = 8;
        G.espionage!.mary = "scotland";

        expect(playCard(G, context("3"), {cardId: "vq-089", asEvent: true})).toBeUndefined();

        expect(G.powers.france.influence.scotland).toBe(9);
    });

    it("caps the Mary Queen of Scots response at 9", () => {
        const G = game();
        G.powers.france.cards = ["vq-089"];
        G.powers.france.influence.scotland = 8;
        G.espionage!.mary = "scotland";

        expect(maryInfluence(G, context("3"))).toBeUndefined();

        expect(G.powers.france.influence.scotland).toBe(9);
        expect(G.powers.france.cards).not.toContain("vq-089");
    });

    it("caps Sultana Safiye's Venice influence at 9", () => {
        const G = game();
        G.powers.france.cards = ["vq-098"];
        G.powers.france.influence.venice = 8;

        expect(playCard(G, context("3"), {cardId: "vq-098", asEvent: true, target: "venice"})).toBeUndefined();

        expect(G.powers.france.influence.venice).toBe(9);
        expect(G.minorDiplomacyResolved).toContain("venice");
    });
});
