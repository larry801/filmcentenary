import {Ctx} from "boardgame.io";
import {VQGame, landCount} from "./constant/general";
import {moveLand} from "./moves";
import {atWar, setupGame} from "./util";

const context = (values: number[] = [6]): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), numPlayers: 6} as Ctx);

const besiegeRouen = (G: VQGame, frenchInside: number, englishBesiegers: number): void => {
    G.spaces.rouen.siege = {by: "england", sinceImpulse: 1};
    G.spaces.rouen.land.france = {regular: frenchInside, merc: 0, cav: 0};
    G.spaces.rouen.land.england = {regular: englishBesiegers, merc: 0, cav: 0};
    G.spaces.paris.land.france = {regular: 4, merc: 0, cav: 0};
    G.powers.france.cp = 2;
};

describe("relief forces (rule 15.2)", () => {
    it("breaks a siege when the relief force wins the field battle", () => {
        const G = game();
        expect(atWar(G, "france", "england")).toBe(true);
        besiegeRouen(G, 2, 4);

        expect(moveLand(G, context([6, 6, 6, 6, 6, 6, 6, 6, 6]), {
            from: "paris", to: "rouen", units: {regular: 4}, leaders: [],
        })).toBeUndefined();

        expect(G.spaces.rouen.siege).toBeUndefined();
        expect(landCount(G.spaces.rouen.land.england)).toBe(0);
        expect(landCount(G.spaces.rouen.land.france)).toBe(1);
        expect(G.log.join("\n")).toContain("wins the relief battle");
        expect(G.log.join("\n")).toContain("siege of Rouen is broken");
    });

    it("keeps the siege when the relief force is destroyed", () => {
        const G = game();
        besiegeRouen(G, 2, 6);

        expect(moveLand(G, context([1, 1, 1, 1, 6, 6, 6, 6, 6, 6, 6]), {
            from: "paris", to: "rouen", units: {regular: 2}, leaders: [],
        })).toBeUndefined();

        expect(G.spaces.rouen.siege).toEqual({by: "england", sinceImpulse: 1});
        expect(landCount(G.spaces.rouen.land.france)).toBe(0);
        expect(landCount(G.spaces.rouen.land.england)).toBe(6);
        expect(G.log.join("\n")).toContain("loses the relief battle");
    });

    it("retreats excess units back out while keeping four inside on an inconclusive battle", () => {
        const G = game();
        besiegeRouen(G, 2, 6);

        expect(moveLand(G, context([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]), {
            from: "paris", to: "rouen", units: {regular: 4}, leaders: [],
        })).toBeUndefined();

        // France had 6 units in Rouen after the move.  Four remain inside and
        // two fall back to Paris; 6 besiegers still outnumber them, so the
        // siege continues.
        expect(landCount(G.spaces.rouen.land.france)).toBe(4);
        expect(landCount(G.spaces.paris.land.france)).toBe(2);
        expect(G.spaces.rouen.siege).toBeDefined();
        expect(G.log.join("\n")).toContain("falls back to Paris");
    });

    it("keeps only the units that started inside after a decisive defeat", () => {
        const G = game();
        besiegeRouen(G, 2, 6);

        expect(moveLand(G, context([1, 1, 1, 1, 1, 1, 6, 6, 1, 1, 1, 1, 1]), {
            from: "paris", to: "rouen", units: {regular: 4}, leaders: [],
        })).toBeUndefined();

        // Two units were inside at the start of the impulse, so at most two
        // remain in Rouen; the other two survivors fall back to Paris.
        expect(landCount(G.spaces.rouen.land.france)).toBe(2);
        expect(landCount(G.spaces.paris.land.france)).toBe(2);
        expect(G.spaces.rouen.siege).toBeDefined();
    });

    it("captures a relief leader when the relief force is eliminated", () => {
        const G = game();
        besiegeRouen(G, 2, 6);
        G.spaces.paris.leaders.push("henryIII");
        G.leaders.henryIII = {id: "henryIII", location: "paris"};

        expect(moveLand(G, context([1, 1, 1, 1, 6, 6, 6, 6, 6, 6, 6]), {
            from: "paris", to: "rouen", units: {regular: 2}, leaders: ["henryIII"],
        })).toBeUndefined();

        expect(G.leaders.henryIII.location).toBe("captured");
        expect(G.leaders.henryIII.capturedBy).toBe("england");
    });

    it("does not treat a normal move into a friendly fortress as a relief battle", () => {
        const G = game();
        G.spaces.rouen.land.france = {regular: 2, merc: 0, cav: 0};
        G.spaces.paris.land.france = {regular: 2, merc: 0, cav: 0};
        G.powers.france.cp = 2;

        expect(moveLand(G, context(), {
            from: "paris", to: "rouen", units: {regular: 2}, leaders: [],
        })).toBeUndefined();

        expect(landCount(G.spaces.rouen.land.france)).toBe(4);
        expect(G.spaces.rouen.siege).toBeUndefined();
    });
});
