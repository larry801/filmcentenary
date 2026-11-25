import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {diplomacyActionState, giftState} from "./diplomacyPolicy";
import {formAlliance, giveMercenary, giveRandomCard, giveTreasure} from "./moves";
import {ownerOf} from "./ownership";
import {allied, setupGame} from "./util";

const context = (player = "0", phase = "diplomacy", numPlayers = 2): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers,
    random: {Die: () => 1, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

/** Two-player campaign: player 1 holds Spain and France; the Ottoman is England's ally. */
const twoPlayer = (): VQGame => setupGame(context("0", "diplomacy", 2));

/** Four-player campaign: the activated Ottoman belongs to the English seat. */
const fourPlayer = (): VQGame => setupGame(context("1", "diplomacy", 4));

/**
 * Scenario Book p. 12, "Controlling 2 Powers": a player may never have one of
 * his powers declare war on the other, and may never award a card draw or
 * mercenaries from one of his powers to the other — but "the two powers
 * controlled by a single player may ally and loan naval squadrons however."
 */
describe("same player's two powers", () => {
    it("seats two powers per player", () => {
        const G = twoPlayer();

        expect(ownerOf(G, "spain")).toBe(ownerOf(G, "france"));
        expect(ownerOf(G, "england")).toBe(ownerOf(G, "protestant"));
    });

    it("offers the alliance between the same player's powers", () => {
        const G = twoPlayer();

        expect(diplomacyActionState(G, "spain", "france", "formAlliance")).toEqual({ok: true});
        expect(diplomacyActionState(G, "england", "protestant", "formAlliance")).toEqual({ok: true});
    });

    it("lets the engine form that alliance", () => {
        const G = twoPlayer();
        G.activePower = "spain";

        expect(formAlliance(G, context("0"), {target: "france"})).toBeUndefined();

        expect(allied(G, "spain", "france")).toBe(true);
        expect(G.powers.spain.allies).toContain("france");
    });

    it("keeps the alliance legal for the activated Ottoman pair in a four-player game", () => {
        const G = fourPlayer();

        // Ottoman and England are the same player, and already allied by the
        // activation itself; the panel must report that, not "same player".
        expect(ownerOf(G, "ottoman")).toBe("1");
        expect(diplomacyActionState(G, "england", "ottoman", "formAlliance"))
            .toEqual({ok: false, reason: "alreadyAllied"});
    });

    it("still refuses war between the same player's powers", () => {
        const G = twoPlayer();

        expect(diplomacyActionState(G, "spain", "france", "declareWar")).toEqual({ok: false, reason: "samePower"});
        expect(diplomacyActionState(G, "england", "protestant", "declareWar")).toEqual({ok: false, reason: "samePower"});
    });

    it("blocks cards and mercenaries between them but leaves treasures alone", () => {
        const G = twoPlayer();
        G.powers.spain.treasures = [3];
        G.spaces.madrid.land.spain = {regular: 1, merc: 1, cav: 0};

        expect(giftState(G, "spain", "france", "cards")).toEqual({ok: false, reason: "samePlayerGift"});
        expect(giftState(G, "spain", "france", "mercenaries", "madrid")).toEqual({ok: false, reason: "samePlayerGift"});
        expect(giftState(G, "spain", "france", "treasures")).toEqual({ok: true});
    });

    it("rejects a card or mercenary gift in the engine as well", () => {
        const G = twoPlayer();
        G.activePower = "spain";
        G.powers.spain.cards = ["vq-017"];
        G.powers.spain.treasures = [3];
        G.spaces.madrid.land.spain = {regular: 1, merc: 1, cav: 0};

        expect(giveRandomCard(G, context("0"), {target: "france"})).toBe(INVALID_MOVE);
        expect(G.powers.spain.cards).toEqual(["vq-017"]);
        expect(G.powers.france.cards).not.toContain("vq-017");

        expect(giveMercenary(G, context("0"), {target: "france", space: "madrid"})).toBe(INVALID_MOVE);
        expect(G.spaces.madrid.land.spain.merc).toBe(1);

        // Treasures are not a card draw, so the scenario book leaves them legal.
        expect(giveTreasure(G, context("0"), {target: "france"})).toBeUndefined();
        expect(G.powers.france.treasures).toEqual([3]);
    });

    it("blocks a card gift between the English seat's powers in a four-player game", () => {
        const G = fourPlayer();
        G.activePower = "england";
        G.powers.england.cards = ["vq-017"];

        expect(giveRandomCard(G, context("1"), {target: "ottoman"})).toBe(INVALID_MOVE);
        expect(G.powers.ottoman.cards).not.toContain("vq-017");
    });

    it("leaves gifts between different players untouched", () => {
        const G = twoPlayer();
        G.activePower = "spain";
        G.powers.spain.cards = ["vq-017"];
        G.powers.spain.treasures = [3];
        G.spaces.madrid.land.spain = {regular: 1, merc: 1, cav: 0};

        expect(giftState(G, "spain", "england", "cards")).toEqual({ok: true});

        expect(giveRandomCard(G, context("0"), {target: "england"})).toBeUndefined();
        expect(G.powers.england.cards).toContain("vq-017");
    });
});
