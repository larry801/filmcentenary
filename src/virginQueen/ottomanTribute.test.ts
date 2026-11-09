import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard, chooseTribute} from "./moves";
import {atWar, setupGame} from "./util";

const context = (playerID = "0"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

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
});
