import {Ctx} from "boardgame.io";
import {VQGame, landCount} from "./constant/general";
import {moveLand} from "./moves";
import {atWar, setupGame} from "./util";

const context = (roll = 6): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => roll, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), numPlayers: 6} as Ctx);

const prepare = (G: VQGame): void => {
    G.spaces.amiens.control = "england";
    G.spaces.amiens.land = {};
    G.spaces.amiens.unrest = false;
    G.spaces.brussels.land.england = {regular: 1, merc: 0, cav: 0};
    G.spaces.paris.land.france = {regular: 4, merc: 0, cav: 0};
    G.powers.france.cp = 2;
};

describe("full-game land interception (rule 13.2)", () => {
    it("moves an adjacent enemy stack into the destination on a successful attempt", () => {
        const G = game();
        expect(atWar(G, "france", "england")).toBe(true);
        prepare(G);

        expect(moveLand(G, context(6), {
            from: "paris", to: "amiens", units: {regular: 2}, leaders: [],
        })).toBeUndefined();

        expect(G.log.join("\n")).toContain("intercepts the move into Amiens");
        expect(G.interceptedThisImpulse?.spaces).toContain("brussels");
        expect(landCount(G.spaces.brussels.land.england)).toBe(0);
    });

    it("does not stop the move when the interception roll fails", () => {
        const G = game();
        prepare(G);

        expect(moveLand(G, context(1), {
            from: "paris", to: "amiens", units: {regular: 2}, leaders: [],
        })).toBeUndefined();

        expect(G.log.join("\n")).not.toContain("intercepts the move");
        expect(G.interceptedThisImpulse?.spaces).toContain("brussels");
        expect(G.spaces.amiens.land.france?.regular).toBe(2);
        expect(G.powers.france.cp).toBe(1);
    });

    it("only attempts interception by powers at war with the mover", () => {
        const G = game();
        G.spaces.amiens.control = "england";
        G.spaces.amiens.land = {};
        G.spaces.brussels.land.spain = {regular: 2, merc: 0, cav: 0};
        G.spaces.paris.land.france = {regular: 4, merc: 0, cav: 0};
        G.powers.france.cp = 2;
        expect(atWar(G, "france", "spain")).toBe(false);

        expect(moveLand(G, context(6), {
            from: "paris", to: "amiens", units: {regular: 2}, leaders: [],
        })).toBeUndefined();

        expect(G.log.join("\n")).not.toContain("intercepts the move");
        expect(G.spaces.amiens.land.france?.regular).toBe(2);
    });

    it("does not intercept into a friendly fortified space", () => {
        const G = game();
        G.spaces.rouen.control = "france";
        G.spaces.rouen.land = {};
        G.spaces.brussels.land.england = {regular: 2, merc: 0, cav: 0};
        G.spaces.paris.land.france = {regular: 2, merc: 0, cav: 0};
        G.powers.france.cp = 2;

        expect(moveLand(G, context(6), {
            from: "paris", to: "rouen", units: {regular: 2}, leaders: [],
        })).toBeUndefined();

        expect(G.log.join("\n")).not.toContain("intercepts the move");
        expect(G.spaces.rouen.land.france?.regular).toBe(2);
    });
});

/**
 * Rule 15.3: "A siege is broken immediately if the besieging stack no longer
 * contains more land units than are in the fortification ... This may occur if
 * part of the besieging force leaves the space as part of a Move action, a
 * successful interception, or a successful avoid battle attempt."
 */
describe("a successful interception breaks the siege it weakens (rule 15.3)", () => {
    it("lifts the siege when intercepted units leave the besieging stack", () => {
        const G = game();
        // England besieges French-held Amiens with 3 units against a garrison
        // of 1.  France marches Paris -> Reims, and the English besieging stack
        // intercepts into the open Reims.  Amiens is left with 1 besieger,
        // which no longer outnumbers the garrison.
        G.spaces.amiens.control = "france";
        G.spaces.amiens.unrest = false;
        G.spaces.amiens.land = {
            england: {regular: 3, merc: 0, cav: 0},
            france: {regular: 1, merc: 0, cav: 0},
        };
        G.spaces.amiens.siege = {by: "england", besiegers: ["england"], inside: ["france"], sinceImpulse: 1};
        G.spaces.paris.land = {france: {regular: 4, merc: 0, cav: 0}};
        G.spaces.reims.control = "france";
        G.spaces.reims.unrest = false;
        G.spaces.reims.land = {};
        G.powers.france.cp = 2;

        expect(moveLand(G, context(6), {from: "paris", to: "reims", units: {regular: 2}, leaders: []})).toBeUndefined();

        expect(G.log.join("\n")).toContain("intercepts the move into Reims");
        expect(G.spaces.amiens.siege).toBeUndefined();
        expect(G.log.join("\n")).toContain("siege of Amiens is broken");
    });
});
