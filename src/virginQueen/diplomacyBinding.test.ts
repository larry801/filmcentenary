import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame, spaceHomes} from "./constant/general";
import {SPACE_BY_ID} from "./mapData";
import {ransom, returnCapturedLeader, yieldSpace} from "./moves";
import {addLand, setupGame} from "./util";

const context = (player = "3"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "diplomacy",
    numPlayers: 6,
    events: {endStage: () => undefined},
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("binding diplomatic agreements (rule 9.1)", () => {
    it("yields a French space between France and the Protestant and displaces occupants", () => {
        const G = game();
        G.spaces.bordeaux.control = "france";
        G.spaces.bordeaux.land = {};
        addLand(G, "bordeaux", "england", "regular", 1);

        expect(yieldSpace(G, context("3"), {target: "protestant", space: "bordeaux"})).toBeUndefined();

        expect(G.spaces.bordeaux.control).toBe("protestant");
        // Rule 12.5: units not friendly to the receiver are displaced.
        expect(G.spaces.bordeaux.land.england).toBeUndefined();
    });

    it("yields a Netherlands space between Spain and the Protestant", () => {
        const G = game();
        G.spaces.amsterdam.control = "spain";
        G.spaces.amsterdam.land = {};

        expect(yieldSpace(G, context("1"), {target: "protestant", space: "amsterdam"})).toBeUndefined();
        expect(G.spaces.amsterdam.control).toBe("protestant");
    });

    it("returns a space to its Home power", () => {
        const G = game();
        G.spaces.paris.control = "england";
        G.spaces.paris.land = {};

        expect(yieldSpace(G, context("2"), {target: "france", space: "paris"})).toBeUndefined();
        expect(G.spaces.paris.control).toBe("france");
    });

    it("rejects a space that does not meet any of the four binding conditions", () => {
        const G = game();
        G.spaces.paris.control = "england";

        expect(yieldSpace(G, context("2"), {target: "spain", space: "paris"})).toBe(INVALID_MOVE);
        expect(G.spaces.paris.control).toBe("england");
    });

    it("returns a captured army leader without a ransom card", () => {
        const G = game();
        G.leaders.guise = {id: "guise", location: "captured", capturedBy: "spain"};
        const cards = G.powers.spain.cards.length;

        expect(returnCapturedLeader(G, context("1"), {leaderId: "guise"})).toBeUndefined();

        expect(G.leaders.guise.location).toBe("paris");
        expect(G.spaces.paris.leaders).toContain("guise");
        expect(G.powers.spain.cards).toHaveLength(cards);
    });

    it("only lets the captor return a captured leader", () => {
        const G = game();
        G.leaders.guise = {id: "guise", location: "captured", capturedBy: "spain"};

        expect(returnCapturedLeader(G, context("3"), {leaderId: "guise"})).toBe(INVALID_MOVE);
        expect(G.leaders.guise.location).toBe("captured");
    });
});

/**
 * Rule 9.3: "Place that army leader in his capital if possible; if not place him
 * in a friendly home key."  The fallback must be a home key of the returning
 * power, not merely any key it happens to control.
 */
describe("ransom destinations (rule 9.3)", () => {
    it("refuses the ransom when only a foreign key is available", () => {
        const G = game();
        // Spain is driven out of its own capital and every home key; the only
        // key it still holds is Rome, a Papal home space.
        for (const id of Object.keys(G.spaces)) {
            if (spaceHomes(SPACE_BY_ID[id]).includes("spain")) G.spaces[id].control = "france";
        }
        G.spaces.rome.control = "spain";
        G.spaces.rome.unrest = false;
        G.powers.spain.cards = ["vq-020"];
        G.leaders.parma = {id: "parma", location: "captured", capturedBy: "france"};

        // No capital and no friendly home key: there is nowhere to put him.
        expect(ransom(G, context("1"), {leaderId: "parma"})).toBe("INVALID_MOVE");
        expect(G.leaders.parma.location).toBe("captured");
    });
});
