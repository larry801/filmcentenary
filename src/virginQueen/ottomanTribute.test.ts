import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard, chooseTribute, tributeOptions} from "./moves";
import i18n from "../constant/i18n";
import {atWar, setupGame} from "./util";
import {eventTargetOptions} from "./eventTargets";

const context = (playerID = "0"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);
const eventTargetOptionsValues = (G: VQGame): string[] =>
    eventTargetOptions(G, "vq-002", "ottoman").map((option) => option.value);

describe("Ottoman Tribute (card #2)", () => {
    it("sets pendingTribute for the target to choose", () => {
        const G = game();
        if (!G.powers.ottoman.cards.includes("vq-002")) G.powers.ottoman.cards.push("vq-002");
        G.powers.hre.cards = ["vq-020"];
        G.powers.hre.treasures = [3];

        expect(playCard(G, context(), {cardId: "vq-002", asEvent: true, target: "hre"})).toBeUndefined();

        expect(G.pendingTribute).toBeDefined();
        expect(G.pendingTribute!.target).toBe("hre");
        expect(G.pendingTribute!.choices).toContain("pay_treasure");
        expect(G.pendingTribute!.choices).toContain("pay_card");
        expect(G.pendingTribute!.choices).toContain("refuse");
        // Nothing resolved yet.
        expect(G.powers.hre.cards).toContain("vq-020");
        expect(atWar(G, "ottoman", "hre")).toBe(false);
    });

    it("target chooses to pay a card", () => {
        const G = game();
        if (!G.powers.ottoman.cards.includes("vq-002")) G.powers.ottoman.cards.push("vq-002");
        G.powers.hre.cards = ["vq-020"];
        G.powers.hre.treasures = [];

        playCard(G, context(), {cardId: "vq-002", asEvent: true, target: "hre"});
        expect(G.pendingTribute).toBeDefined();

        chooseTribute(G, context("4"), {choice: "pay_card"});

        expect(G.pendingTribute).toBeUndefined();
        expect(G.powers.hre.cards).not.toContain("vq-020");
        expect(G.powers.ottoman.cards).toContain("vq-020");
        expect(atWar(G, "ottoman", "hre")).toBe(false);
    });

    it("target chooses to pay a treasure", () => {
        const G = game();
        if (!G.powers.ottoman.cards.includes("vq-002")) G.powers.ottoman.cards.push("vq-002");
        G.powers.hre.cards = ["vq-020"];
        G.powers.hre.treasures = [3];

        playCard(G, context(), {cardId: "vq-002", asEvent: true, target: "hre"});
        chooseTribute(G, context("4"), {choice: "pay_treasure"});

        expect(G.pendingTribute).toBeUndefined();
        expect(G.powers.hre.cards).toContain("vq-020");
        expect(G.powers.ottoman.treasures).toContain(3);
        expect(atWar(G, "ottoman", "hre")).toBe(false);
    });

    it("target chooses to refuse (war)", () => {
        const G = game();
        if (!G.powers.ottoman.cards.includes("vq-002")) G.powers.ottoman.cards.push("vq-002");
        G.powers.hre.cards = ["vq-020"];
        G.powers.hre.treasures = [3];
        const cp = G.powers.ottoman.cp;

        playCard(G, context(), {cardId: "vq-002", asEvent: true, target: "hre"});
        chooseTribute(G, context("4"), {choice: "refuse"});

        expect(G.pendingTribute).toBeUndefined();
        expect(atWar(G, "ottoman", "hre")).toBe(true);
        expect(G.powers.ottoman.cp).toBe(cp + 2);
    });

    it("declares war automatically when the target has nothing to give", () => {
        const G = game();
        if (!G.powers.ottoman.cards.includes("vq-002")) G.powers.ottoman.cards.push("vq-002");
        G.powers.hre.cards = [];
        G.powers.hre.treasures = [];
        const cp = G.powers.ottoman.cp;

        expect(playCard(G, context(), {cardId: "vq-002", asEvent: true, target: "hre"})).toBeUndefined();

        expect(G.pendingTribute).toBeUndefined();
        expect(atWar(G, "ottoman", "hre")).toBe(true);
        expect(G.powers.ottoman.cp).toBe(cp + 2);
    });

    it("only offers available payment methods", () => {
        const G = game();
        if (!G.powers.ottoman.cards.includes("vq-002")) G.powers.ottoman.cards.push("vq-002");
        G.powers.hre.cards = ["vq-020"];
        G.powers.hre.treasures = [];

        playCard(G, context(), {cardId: "vq-002", asEvent: true, target: "hre"});

        expect(G.pendingTribute!.choices).not.toContain("pay_treasure");
        expect(G.pendingTribute!.choices).toContain("pay_card");
        expect(G.pendingTribute!.choices).toContain("refuse");
    });

    it("rejects choice from wrong player", () => {
        const G = game();
        if (!G.powers.ottoman.cards.includes("vq-002")) G.powers.ottoman.cards.push("vq-002");
        G.powers.hre.cards = ["vq-020"];
        G.powers.hre.treasures = [];

        playCard(G, context(), {cardId: "vq-002", asEvent: true, target: "hre"});

        // Ottoman player ("0") tries to answer — should be rejected.
        expect(chooseTribute(G, context("0"), {choice: "pay_card"})).toBe("INVALID_MOVE");
        expect(G.pendingTribute).toBeDefined();
    });

    it("routes the choice to the target seat, not the Ottoman", () => {
        const G = game();
        if (!G.powers.ottoman.cards.includes("vq-002")) G.powers.ottoman.cards.push("vq-002");
        G.powers.hre.cards = ["vq-020"];
        G.powers.hre.treasures = [3];
        const setActivePlayers = jest.fn();
        playCard(G, {...context(), events: {setActivePlayers, endStage: jest.fn()}} as unknown as Ctx,
            {cardId: "vq-002", asEvent: true, target: "hre"});
        // HRE is seat "4" in a six-player game.
        expect(setActivePlayers).toHaveBeenCalledWith({value: {"4": "tributeChoice"}});
    });

    it("labels every choice through i18n", () => {
        const G = game();
        if (!G.powers.ottoman.cards.includes("vq-002")) G.powers.ottoman.cards.push("vq-002");
        G.powers.hre.cards = ["vq-020"];
        G.powers.hre.treasures = [3];

        playCard(G, context(), {cardId: "vq-002", asEvent: true, target: "hre"});

        const labels = Object.fromEntries(tributeOptions(G).map((option) => [option.id, option.label]));
        expect(labels.refuse).toBe(i18n.chain.vq.tribute.refuse);
        expect(labels.pay_card).toBe(i18n.chain.vq.tribute.payCard);
        expect(labels.pay_treasure).toBe(i18n.chain.vq.tribute.payTreasure);
        // No hard-coded English left over.
        expect(Object.values(labels)).not.toContain("Refuse (war)");
    });

    it("stops offering Venice once its diplomacy has been resolved", () => {
        const G = game();
        G.minorDiplomacyResolved.push("venice");
        expect(eventTargetOptionsValues(G)).toEqual(["spain", "hre"]);
    });

    it("still offers a target already at war: the card is a fresh threat", () => {
        const G = game();
        // The campaign starts with the Ottoman and Spain at war.
        expect(atWar(G, "ottoman", "spain")).toBe(true);
        expect(eventTargetOptionsValues(G)).toContain("spain");
    });

    it("rejects a target that is not offered (e.g. England or an ally)", () => {
        const G = game();
        if (!G.powers.ottoman.cards.includes("vq-002")) G.powers.ottoman.cards.push("vq-002");
        G.powers.england.cards = ["vq-021"];
        const cp = G.powers.ottoman.cp;
        expect(playCard(G, context(), {cardId: "vq-002", asEvent: true, target: "england"})).toBeUndefined();
        expect(G.pendingTribute).toBeUndefined();
        expect(atWar(G, "ottoman", "england")).toBe(false);
        expect(G.powers.ottoman.cp).toBe(cp);
        // The card is still spent; it simply had no legal effect.
        expect(G.powers.ottoman.cards).not.toContain("vq-002");
    });

    it("falls back to war when the target seat is not played (unseated HRE)", () => {
        const G = setupGame({...context(), numPlayers: 2} as Ctx);
        G.powers.ottoman.cards = ["vq-002"];
        G.powers.hre.cards = ["vq-020"];
        G.powers.hre.treasures = [2];
        const cp = G.powers.ottoman.cp;
        playCard(G, context(), {cardId: "vq-002", asEvent: true, target: "hre"});
        // No seat owns the HRE in the two-player game, so it cannot answer.
        expect(G.pendingTribute).toBeUndefined();
        expect(atWar(G, "ottoman", "hre")).toBe(true);
        expect(G.powers.ottoman.cp).toBe(cp + 2);
    });

});
