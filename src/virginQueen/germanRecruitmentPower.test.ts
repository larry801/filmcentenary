import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (playerID: string): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context("3"), phase: "action"} as Ctx);

const hreContext = (): Ctx => context("4");

describe("German Recruitment Curtailed (#23) removes one major power's mercenaries", () => {
    it("removes only the named power's mercenaries in a shared space", () => {
        const G = game();
        G.powers.france.cards = ["vq-023"];
        G.spaces.brussels.land.spain = {regular: 2, merc: 3, cav: 1};
        G.spaces.brussels.land.france = {regular: 1, merc: 2, cav: 0};

        expect(playCard(G, context("3"), {cardId: "vq-023", asEvent: true, target: "brussels:spain"})).toBeUndefined();

        expect(G.spaces.brussels.land.spain?.merc).toBe(0);
        expect(G.spaces.brussels.land.spain?.regular).toBe(2);
        expect(G.spaces.brussels.land.spain?.cav).toBe(1);
        expect(G.spaces.brussels.land.france?.merc).toBe(2);
    });

    it("picks exactly one major power when only the space is named", () => {
        const G = game();
        G.powers.france.cards = ["vq-023"];
        G.spaces.brussels.land.france = {regular: 1, merc: 4, cav: 0};
        G.spaces.brussels.land.spain = {regular: 1, merc: 3, cav: 0};

        expect(playCard(G, context("3"), {cardId: "vq-023", asEvent: true, target: "brussels"})).toBeUndefined();

        // Canonical power order picks Spain first; France's stack is untouched.
        expect(G.spaces.brussels.land.spain?.merc).toBe(0);
        expect(G.spaces.brussels.land.france?.merc).toBe(4);
    });

    it("does not fall back to another power when the named power has no mercenaries", () => {
        const G = game();
        G.powers.france.cards = ["vq-023"];
        G.spaces.brussels.land.spain = {regular: 1, merc: 3, cav: 0};
        G.spaces.brussels.land.france = {regular: 1, merc: 0, cav: 0};

        expect(playCard(G, context("3"), {cardId: "vq-023", asEvent: true, target: "brussels:france"})).toBeUndefined();

        expect(G.spaces.brussels.land.spain?.merc).toBe(3);
        expect(G.spaces.brussels.land.france?.merc).toBe(0);
    });

    it("treats Dutch and Huguenot mercenaries as the Protestant controller", () => {
        const G = game();
        G.powers.france.cards = ["vq-023"];
        G.spaces.brussels.land.protestant = {regular: 2, merc: 2, cav: 0};
        G.spaces.brussels.land.spain = {regular: 2, merc: 2, cav: 0};

        expect(playCard(G, context("3"), {cardId: "vq-023", asEvent: true, target: "brussels:huguenot"})).toBeUndefined();

        expect(G.spaces.brussels.land.protestant?.merc).toBe(0);
        expect(G.spaces.brussels.land.spain?.merc).toBe(2);
    });

    it("lets the HRE target two spaces with a different power in each", () => {
        const G = game();
        G.powers.hre.cards = ["vq-023"];
        G.spaces.brussels.land.spain = {regular: 1, merc: 2, cav: 0};
        G.spaces.brussels.land.england = {regular: 1, merc: 3, cav: 0};
        G.spaces.antwerp.land.france = {regular: 1, merc: 4, cav: 0};
        G.spaces.antwerp.land.england = {regular: 1, merc: 5, cav: 0};

        expect(playCard(G, hreContext(),
            {cardId: "vq-023", asEvent: true, target: "brussels:spain:antwerp:france"})).toBeUndefined();

        expect(G.spaces.brussels.land.spain?.merc).toBe(0);
        expect(G.spaces.brussels.land.england?.merc).toBe(3);
        expect(G.spaces.antwerp.land.france?.merc).toBe(0);
        expect(G.spaces.antwerp.land.england?.merc).toBe(5);
    });

    it("lets the HRE target two spaces without naming powers, one stack each", () => {
        const G = game();
        G.powers.hre.cards = ["vq-023"];
        G.spaces.brussels.land.spain = {regular: 1, merc: 2, cav: 0};
        G.spaces.brussels.land.france = {regular: 1, merc: 3, cav: 0};
        G.spaces.antwerp.land.spain = {regular: 1, merc: 4, cav: 0};
        G.spaces.antwerp.land.protestant = {regular: 1, merc: 5, cav: 0};

        expect(playCard(G, hreContext(), {cardId: "vq-023", asEvent: true, target: "brussels:antwerp"})).toBeUndefined();

        expect(G.spaces.brussels.land.spain?.merc).toBe(0);
        expect(G.spaces.brussels.land.france?.merc).toBe(3);
        expect(G.spaces.antwerp.land.spain?.merc).toBe(0);
        expect(G.spaces.antwerp.land.protestant?.merc).toBe(5);
    });

    it("lets the HRE target a single space", () => {
        const G = game();
        G.powers.hre.cards = ["vq-023"];
        G.spaces.brussels.land.spain = {regular: 1, merc: 2, cav: 0};
        G.spaces.brussels.land.france = {regular: 1, merc: 3, cav: 0};

        expect(playCard(G, hreContext(), {cardId: "vq-023", asEvent: true, target: "brussels:france"})).toBeUndefined();

        expect(G.spaces.brussels.land.france?.merc).toBe(0);
        expect(G.spaces.brussels.land.spain?.merc).toBe(2);
    });

    it("lets a non-HRE power affect only the first named space", () => {
        const G = game();
        G.powers.france.cards = ["vq-023"];
        G.spaces.brussels.land.spain = {regular: 1, merc: 2, cav: 0};
        G.spaces.antwerp.land.france = {regular: 1, merc: 3, cav: 0};

        expect(playCard(G, context("3"),
            {cardId: "vq-023", asEvent: true, target: "brussels:spain:antwerp:france"})).toBeUndefined();

        expect(G.spaces.brussels.land.spain?.merc).toBe(0);
        expect(G.spaces.antwerp.land.france?.merc).toBe(3);
    });
});
