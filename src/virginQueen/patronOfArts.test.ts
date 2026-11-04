import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {patronById} from "./scenario";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "4",
    playerID: "4",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const italianPatron = (G: VQGame) =>
    G.patronsAvailable.map((id) => patronById(G, id)).find((candidate) =>
        candidate?.region === "italy" && candidate.rating !== null && !G.powers.hre.patrons.includes(candidate.id));

describe("Patron of Arts (card #35)", () => {
    it("sponsors a random HRE patron without a target", () => {
        const G = game();
        G.powers.hre.cards = ["vq-035"];
        const patron = G.patronsAvailable.map((id) => patronById(G, id)).find((candidate) => candidate?.region === "hre" && candidate.rating !== null);
        expect(patron).toBeDefined();

        expect(playCard(G, context(), {cardId: "vq-035", asEvent: true})).toBeUndefined();

        expect(G.pendingPatronage.some((entry) => entry.patronId === patron!.id && entry.cp === 3)).toBe(true);
        expect(G.pragueCulturalCenter).toBeUndefined();
    });

    it("sponsors an Italian patron and marks Prague while Rudolf II rules", () => {
        const G = game();
        G.powers.hre.cards = ["vq-035"];
        G.powers.hre.ruler = "rudolfII";
        const patron = italianPatron(G);
        expect(patron).toBeDefined();

        expect(playCard(G, context(), {cardId: "vq-035", asEvent: true, target: patron!.id})).toBeUndefined();

        expect(G.pendingPatronage.some((entry) => entry.patronId === patron!.id && entry.cp === 3)).toBe(true);
        expect(G.pragueCulturalCenter).toBe(patron!.id);
    });

    it("accepts the legacy rudolf ruler id for the Prague marker", () => {
        const G = game();
        G.powers.hre.cards = ["vq-035"];
        G.powers.hre.ruler = "rudolf";
        const patron = italianPatron(G);
        expect(patron).toBeDefined();

        expect(playCard(G, context(), {cardId: "vq-035", asEvent: true, target: patron!.id})).toBeUndefined();

        expect(G.pragueCulturalCenter).toBe(patron!.id);
    });

    it("marks Prague after the #87 Rudolf II accession event", () => {
        const G = game();
        if (!G.powers.hre.cards.includes("vq-087")) G.powers.hre.cards.push("vq-087");

        expect(playCard(G, context(), {cardId: "vq-087", asEvent: true})).toBeUndefined();
        expect(G.powers.hre.ruler).toBe("rudolfII");

        // The accession is a separate event; the Patron card is played later
        // in an action round.
        G.powers.hre.cardPlayed = false;
        G.powers.hre.cards = ["vq-035"];
        const patron = italianPatron(G);
        expect(patron).toBeDefined();

        expect(playCard(G, context(), {cardId: "vq-035", asEvent: true, target: patron!.id})).toBeUndefined();

        expect(G.pragueCulturalCenter).toBe(patron!.id);
    });

    it("can choose which drawn card to give", () => {
        const G = game();
        G.powers.hre.cards = ["vq-035", "vq-020"];
        G.powers.france.cards = [];

        expect(playCard(G, context(), {cardId: "vq-035", asEvent: true, target: "france:vq-020"})).toBeUndefined();

        expect(G.powers.france.cards).toContain("vq-020");
    });

    it("draws two cards and gives one to another power", () => {
        const G = game();
        G.powers.hre.cards = ["vq-035", "vq-020"];
        G.powers.france.cards = [];
        const hreHand = G.powers.hre.cards.length;

        expect(playCard(G, context(), {cardId: "vq-035", asEvent: true, target: "france"})).toBeUndefined();

        expect(G.powers.france.cards).toHaveLength(1);
        expect(G.powers.hre.cards).toHaveLength(hreHand - 1 + 2 - 1);
        expect(G.log.join("\n")).toContain("Patron of Arts");
    });
});
