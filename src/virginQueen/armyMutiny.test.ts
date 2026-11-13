import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard, chooseMutinyDiscard, mutinyDiscardOptions} from "./moves";
import {cardName} from "./constant/cards";
import i18n from "../constant/i18n";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Army Mutiny (card #17)", () => {
    it("can target a specific owner in a shared space", () => {
        const G = game();
        G.powers.france.cards = ["vq-017", "vq-090"];
        G.spaces.brussels.land.france = {regular: 2, merc: 2, cav: 0};
        G.spaces.brussels.land.spain = {regular: 2, merc: 2, cav: 0};
        expect(playCard(G, context(), {cardId: "vq-017", asEvent: true, target: "brussels:france"})).toBeUndefined();

        expect(G.spaces.brussels.land.france?.merc).toBe(0);
        expect(G.spaces.brussels.land.spain?.merc).toBe(2);
    });

    it("removes mercenaries and limits regulars by the discarded card", () => {
        const G = game();
        G.powers.france.cards = ["vq-017"];
        G.spaces.brussels.control = "spain";
        G.spaces.brussels.land.spain = {regular: 5, merc: 2, cav: 0};
        G.powers.spain.cards = ["vq-090"];
        G.spaces.brussels.unrest = false;

        expect(playCard(G, context(), {cardId: "vq-017", asEvent: true, target: "brussels"})).toBeUndefined();

        expect(G.spaces.brussels.land.spain?.merc).toBe(0);
        expect(G.spaces.brussels.land.spain?.regular).toBe(2);
        expect(G.spaces.brussels.unrest).toBe(true);
        expect(G.discard).toContain("vq-090");
    });

    it("opens a discard choice when the mutinied power holds two eligible cards", () => {
        const G = game();
        G.powers.france.cards = ["vq-017"];
        G.spaces.brussels.control = "spain";
        G.spaces.brussels.land.spain = {regular: 9, merc: 2, cav: 0};
        G.powers.spain.cards = ["vq-020", "vq-022"];

        expect(playCard(G, context(), {cardId: "vq-017", asEvent: true, target: "brussels"})).toBeUndefined();

        expect(G.pendingMutiny).toEqual({space: "brussels", owner: "spain"});
        const options = mutinyDiscardOptions(G);
        expect(options.map((option) => option.card).sort()).toEqual(["vq-020", "vq-022"].sort());
        // 5 CP keeps every regular (9); 3 CP keeps 6.  Labels carry name and count.
        expect(options.find((option) => option.card === "vq-020")!.label).toContain("保留最多 9 正规军");
        expect(options.find((option) => option.card === "vq-022")!.label).toContain("保留最多 6 正规军");
        expect(options.find((option) => option.card === "vq-020")!.label)
            .toBe(i18n.chain.vq.mutiny.discard.replace("{card}", cardName("vq-020")).replace("{count}", "9"));

        // Only Spain's seat may answer.
        expect(chooseMutinyDiscard(G, context(), {card: "vq-020"})).toBe("INVALID_MOVE");
        expect(G.pendingMutiny).toBeDefined();
    });

    it("keeps regulars per the discarded card's CP value", () => {
        const G = game();
        G.activePower = "spain";
        G.spaces.brussels.land.spain = {regular: 9, merc: 0, cav: 0};
        G.powers.spain.cards = ["vq-020", "vq-022"];
        G.pendingMutiny = {space: "brussels", owner: "spain"};
        const spainCtx = {...context(), playerID: "1", currentPlayer: "1"} as Ctx;

        expect(chooseMutinyDiscard(G, spainCtx, {card: "vq-022"})).toBeUndefined();

        expect(G.pendingMutiny).toBeUndefined();
        expect(G.spaces.brussels.land.spain?.regular).toBe(6);
        expect(G.discard).toContain("vq-022");
        expect(G.powers.spain.cards).toEqual(["vq-020"]);
    });
});
