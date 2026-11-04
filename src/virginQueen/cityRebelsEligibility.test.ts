import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {canPlayCityStateRebels, playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "2",
    playerID: "2",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => {
    const G = setupGame(context());
    G.powers.england.cards = ["vq-018"];
    return G;
};

const play = (G: VQGame, target?: string) =>
    playCard(G, context(), {
        cardId: "vq-018",
        asEvent: true,
        ...(target !== undefined ? {target} : {}),
    });

const expectRejectedWithoutSideEffects = (G: VQGame, target: string | undefined): void => {
    expect(play(G, target)).toBe(INVALID_MOVE);
    expect(G.powers.england.cards).toContain("vq-018");
    expect(G.powers.england.cardPlayed).toBe(false);
    expect(G.discard).not.toContain("vq-018");
    expect(G.pendingCityRebels).toBeUndefined();
    expect(G.lastRolls).toBe("");
};

describe("City State Rebels eligibility (#18 FAQ)", () => {
    it("rejects a missing, unknown or non-fortified target", () => {
        const G = game();
        expectRejectedWithoutSideEffects(G, undefined);
        expectRejectedWithoutSideEffects(G, "nowhere");

        // Utrecht is a home space of Spain, but it is not fortified.
        G.spaces.utrecht.control = "france";
        expectRejectedWithoutSideEffects(G, "utrecht");
    });

    it("rejects a fortress controlled by its home power", () => {
        const G = game();
        G.spaces.rotterdam.control = "protestant";
        G.spaces.rotterdam.land = {protestant: {regular: 1, merc: 0, cav: 0}};

        expectRejectedWithoutSideEffects(G, "rotterdam");
        expect(canPlayCityStateRebels(G, "rotterdam")).toBe(false);
    });

    it("rejects a controller allied with the major home power and permits a retry after peace", () => {
        const G = game();
        G.spaces.rotterdam.control = "spain";
        G.spaces.rotterdam.land = {spain: {regular: 1, merc: 0, cav: 0}};
        G.powers.spain.allies.push("protestant");

        expectRejectedWithoutSideEffects(G, "rotterdam");
        expect(canPlayCityStateRebels(G, "rotterdam")).toBe(false);

        G.powers.spain.allies = G.powers.spain.allies.filter((power) => power !== "protestant");
        expect(canPlayCityStateRebels(G, "rotterdam")).toBe(true);
        expect(play(G, "rotterdam")).toBeUndefined();
        expect(G.spaces.rotterdam.control).toBe("protestant");
        expect(G.spaces.rotterdam.land.protestant?.regular).toBe(1);
    });

    it("rejects a controller allied with the minor home power and permits it once deactivated", () => {
        const G = game();
        G.spaces.venice.control = "spain";
        G.spaces.venice.land = {spain: {regular: 1, merc: 0, cav: 0}};
        G.spaces.venice.naval = {};
        G.powers.spain.alliedMinors.push("venice");

        expectRejectedWithoutSideEffects(G, "venice");
        expect(canPlayCityStateRebels(G, "venice")).toBe(false);

        G.powers.spain.alliedMinors = G.powers.spain.alliedMinors.filter((minor) => minor !== "venice");
        expect(canPlayCityStateRebels(G, "venice")).toBe(true);
        expect(play(G, "venice")).toBeUndefined();
        expect(G.spaces.venice.control).toBe("venice");
        expect(G.spaces.venice.land.venice?.regular).toBe(1);
    });

    it("allows an occupied fortress controlled by an unaligned major", () => {
        const G = game();
        G.spaces.rotterdam.control = "spain";
        G.spaces.rotterdam.land = {spain: {regular: 1, merc: 0, cav: 0}};

        expect(canPlayCityStateRebels(G, "rotterdam")).toBe(true);
        expect(play(G, "rotterdam")).toBeUndefined();

        expect(G.powers.england.cardPlayed).toBe(true);
        expect(G.pendingCityRebels).toBeUndefined();
        expect(G.spaces.rotterdam.control).toBe("protestant");
        expect(G.spaces.rotterdam.land.protestant?.regular).toBe(1);
    });

    it("allows an occupied independent city state to recover its own control", () => {
        const G = game();
        G.spaces.florence.control = "spain";
        G.spaces.florence.land = {spain: {regular: 1, merc: 0, cav: 0}};
        G.spaces.florence.naval = {};

        expect(canPlayCityStateRebels(G, "florence")).toBe(true);
        expect(play(G, "florence")).toBeUndefined();

        expect(G.spaces.florence.control).toBe("independent");
        expect(G.spaces.florence.land.independent?.regular).toBe(1);
    });

    it("treats a fortified key home space as a legal target", () => {
        const G = game();
        G.spaces.tunis.control = "spain";
        G.spaces.tunis.land = {spain: {regular: 1, merc: 0, cav: 0}};
        G.spaces.tunis.naval = {};

        expect(canPlayCityStateRebels(G, "tunis")).toBe(true);
        expect(play(G, "tunis")).toBeUndefined();

        expect(G.spaces.tunis.control).toBe("independent");
        expect(G.spaces.tunis.land.independent?.regular).toBe(1);
    });
});
