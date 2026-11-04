import {Ctx} from "boardgame.io";
import {VQGame, landCount} from "./constant/general";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const playSmallAid = (G: VQGame, target: string) => {
    G.powers.france.cards = ["vq-026"];
    return playCard(G, context(), {cardId: "vq-026", asEvent: true, target});
};

describe("A Small Aid (#26) in neutral-controlled fortresses", () => {
    it("places an independent regular in an independent besieged fortress", () => {
        const G = game();
        G.spaces.metz.control = "independent";
        G.spaces.metz.siege = {by: "france", sinceImpulse: 1};
        G.spaces.metz.land = {
            independent: {regular: 1, merc: 0, cav: 0},
            france: {regular: 5, merc: 0, cav: 0},
        };

        expect(playSmallAid(G, "metz")).toBeUndefined();

        expect(G.spaces.metz.land.independent?.regular).toBe(2);
        expect(G.spaces.metz.land.france?.regular).toBe(5);
        expect(G.log.join("\n")).toContain("A Small Aid adds 1 Independent regular to Metz.");
    });

    it("places a minor-power regular in a minor-controlled besieged fortress", () => {
        const G = game();
        G.spaces.edinburgh.control = "scotland";
        G.spaces.edinburgh.siege = {by: "england", sinceImpulse: 1};
        G.spaces.edinburgh.land = {
            scotland: {regular: 2, merc: 0, cav: 0},
            england: {regular: 6, merc: 0, cav: 0},
        };

        expect(playSmallAid(G, "edinburgh")).toBeUndefined();

        expect(G.spaces.edinburgh.land.scotland?.regular).toBe(3);
        expect(G.spaces.edinburgh.land.england?.regular).toBe(6);
    });

    it("counts only defenders, not besiegers, against the three-unit limit", () => {
        const G = game();
        G.spaces.brussels.control = "spain";
        G.spaces.brussels.siege = {by: "france", sinceImpulse: 1};
        G.spaces.brussels.land = {
            spain: {regular: 3, merc: 0, cav: 0},
            france: {regular: 8, merc: 0, cav: 0},
        };

        expect(playSmallAid(G, "brussels")).toBeUndefined();

        expect(G.spaces.brussels.land.spain?.regular).toBe(4);
    });

    it("excludes an allied second besieger from the defender count", () => {
        const G = game();
        G.spaces.brussels.control = "spain";
        // France besieges; HRE (allied to France) is a second besieger; Spain
        // holds the fortress with 3.  A Small Aid must succeed.
        G.spaces.brussels.siege = {by: "france", besiegers: ["france", "hre"], sinceImpulse: 1};
        G.powers.france.allies.push("hre");
        G.spaces.brussels.land = {
            spain: {regular: 3, merc: 0, cav: 0},
            france: {regular: 5, merc: 0, cav: 0},
            hre: {regular: 5, merc: 0, cav: 0},
        };

        expect(playSmallAid(G, "brussels")).toBeUndefined();

        expect(G.spaces.brussels.land.spain?.regular).toBe(4);
    });

    it("rejects a neutral fortress defended by more than three units", () => {
        const G = game();
        G.spaces.metz.control = "independent";
        G.spaces.metz.siege = {by: "spain", sinceImpulse: 1};
        G.spaces.metz.land = {
            independent: {regular: 4, merc: 0, cav: 0},
            spain: {regular: 1, merc: 0, cav: 0},
        };

        // #26 is pre-validated now: an illegal target is INVALID_MOVE rather
        // than a silent no-op that still consumes the card.
        expect(playSmallAid(G, "metz")).toBe("INVALID_MOVE");

        expect(landCount(G.spaces.metz.land.independent)).toBe(4);
        expect(G.log.join("\n")).not.toContain("A Small Aid adds");
    });

    it("rejects a neutral fortress that is not under siege", () => {
        const G = game();
        G.spaces.metz.control = "independent";
        G.spaces.metz.siege = undefined;
        G.spaces.metz.land = {independent: {regular: 1, merc: 0, cav: 0}};

        expect(playSmallAid(G, "metz")).toBe("INVALID_MOVE");

        expect(G.spaces.metz.land.independent?.regular).toBe(1);
        expect(G.log.join("\n")).not.toContain("A Small Aid adds");
    });
});
