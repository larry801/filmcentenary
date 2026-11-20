import {Ctx} from "boardgame.io";
import {VQGame, landCount} from "./constant/general";
import {assault, moveLand, moveNaval} from "./moves";
import {setupGame} from "./util";

const context = (values: number[] = [6], playerID = "3"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), numPlayers: 6} as Ctx);

describe("retreat and avoid battle over a pass (rule 2.5)", () => {
    it("allows a pass neighbour as the only legal avoid-battle destination", () => {
        const G = game();
        // Barcelona's neighbours are Madrid, Valencia (normal) and Pamplona
        // (a Pyrenees pass).  Madrid is the attacker's origin and Valencia is
        // in unrest, so Pamplona is the only legal destination.
        G.powers.france.wars = [...new Set([...G.powers.france.wars, "england"])];
        G.spaces.barcelona.control = "england";
        G.spaces.barcelona.land = {england: {regular: 2, merc: 0, cav: 0}};
        G.spaces.barcelona.unrest = false;
        G.spaces.pamplona.control = "england";
        G.spaces.pamplona.land = {};
        G.spaces.pamplona.unrest = false;
        G.spaces.valencia.control = "independent";
        G.spaces.valencia.land = {};
        G.spaces.valencia.unrest = true;
        G.spaces.madrid.control = "france";
        G.spaces.madrid.land = {france: {regular: 2, merc: 0, cav: 0}};
        G.spaces.madrid.unrest = false;
        G.powers.france.cp = 2;

        expect(moveLand(G, context([6, 6, 6, 6, 6, 6]), {
            from: "madrid", to: "barcelona", units: {regular: 2}, leaders: [],
        })).toBeUndefined();

        expect(G.log.join("\n")).toContain("avoids battle");
        expect(landCount(G.spaces.pamplona.land.england)).toBe(2);
    });
});

describe("one assault per space per impulse (rule 15.1)", () => {
    const prepare = (G: VQGame): void => {
        G.impulse = 2;
        // Give France a line of communication to the siege (rule 15.1 requires
        // one): every other space is friendly-controlled, so the LOC reaches
        // the besieged space from Paris.
        for (const id of Object.keys(G.spaces)) G.spaces[id].control = "france";
        G.spaces.ghent.control = "spain";
        G.spaces.ghent.siege = {by: "france", besiegers: ["france"], inside: ["spain"], sinceImpulse: 1};
        G.spaces.ghent.land = {
            france: {regular: 6, merc: 0, cav: 0},
            spain: {regular: 1, merc: 0, cav: 0},
        };
        G.spaces.ghent.leaders = [];
        G.powers.france.cards = [];
        G.powers.spain.cards = [];
        if (!G.powers.france.wars.includes("spain")) G.powers.france.wars.push("spain");
        if (!G.powers.spain.wars.includes("france")) G.powers.spain.wars.push("france");
        G.powers.france.cp = 4;
    };

    it("refuses a second assault on the same space in the same impulse", () => {
        const G = game();
        prepare(G);

        expect(assault(G, context([1, 1, 1, 1, 1, 1]), {space: "ghent"})).toBeUndefined();
        // The siege survives the first assault, so a second assault in the
        // same impulse would be possible without the rule 15.1 limit.
        expect(G.spaces.ghent.siege).toBeDefined();
        const before = G.powers.france.cp;
        expect(assault(G, context([6, 6, 6, 6, 6, 6]), {space: "ghent"})).toBe("INVALID_MOVE");
        expect(G.powers.france.cp).toBe(before);
    });

    it("allows assaults on different spaces in the same impulse", () => {
        const G = game();
        prepare(G);
        G.spaces.utrecht.control = "spain";
        G.spaces.utrecht.siege = {by: "france", besiegers: ["france"], inside: ["spain"], sinceImpulse: 1};
        G.spaces.utrecht.land = {
            france: {regular: 6, merc: 0, cav: 0},
            spain: {regular: 1, merc: 0, cav: 0},
        };
        G.spaces.utrecht.leaders = [];

        expect(assault(G, context([1, 1, 1, 1, 1, 1]), {space: "ghent"})).toBeUndefined();
        expect(assault(G, context([1, 1, 1, 1, 1, 1]), {space: "utrecht"})).toBeUndefined();
    });

    it("keeps the original siege date when an assault fails", () => {
        const G = game();
        prepare(G);

        // No hits on either side: the siege survives and is NOT re-dated to
        // this impulse, so rule 13.1's "marched away this impulse" restriction
        // still reflects the impulse in which the siege was actually placed.
        expect(assault(G, context([1, 1, 1, 1, 1, 1]), {space: "ghent"})).toBeUndefined();
        if (G.spaces.ghent.siege !== undefined) {
            expect(G.spaces.ghent.siege.sinceImpulse).toBe(1);
        }
    });

    it("records the assaulting power so the limit is per space and impulse", () => {
        const G = game();
        prepare(G);

        expect(assault(G, context([1, 1, 1, 1, 1, 1]), {space: "ghent"})).toBeUndefined();
        expect(G.spaces.ghent.siege?.assaultedIn?.impulse).toBe(G.impulse);
        expect(G.spaces.ghent.siege?.assaultedIn?.powers).toContain("france");
    });

    it("resets the limit in a new impulse", () => {
        const G = game();
        prepare(G);

        expect(assault(G, context([1, 1, 1, 1, 1, 1]), {space: "ghent"})).toBeUndefined();
        G.impulse += 1;
        G.spaces.ghent.siege = {by: "france", besiegers: ["france"], inside: ["spain"], sinceImpulse: 1};
        G.spaces.ghent.land = {
            france: {regular: 6, merc: 0, cav: 0},
            spain: {regular: 1, merc: 0, cav: 0},
        };
        G.powers.france.cp = 4;
        expect(assault(G, context([1, 1, 1, 1, 1, 1]), {space: "ghent"})).toBeUndefined();
    });
});

describe("naval units that lost a naval combat (rule 16.1)", () => {
    // Spain is player "1" in the six-player impulse order.
    const spain = (values: number[] = [6]): Ctx => context(values, "1");

    it("refuses a Naval Move for a fleet that lost a naval combat this impulse", () => {
        const G = game();
        G.powers.spain.wars = [...new Set([...G.powers.spain.wars, "england"])];
        G.seaZones.englishChannel.naval.spain = {galley: 0, galleon: 2, racebuilt: 0, corsair: 0};
        G.powers.spain.cp = 4;
        G.impulse = 7;
        G.lostNavalCombatImpulse = {impulse: G.impulse, owners: ["spain"]};

        expect(moveNaval(G, spain(), {
            fleets: [{from: "englishChannel", to: "northSea"}],
        })).toBe("INVALID_MOVE");
    });

    it("allows the same move once the impulse has passed", () => {
        const G = game();
        G.powers.spain.wars = [...new Set([...G.powers.spain.wars, "england"])];
        G.seaZones.englishChannel.naval.spain = {galley: 0, galleon: 2, racebuilt: 0, corsair: 0};
        G.powers.spain.cp = 4;
        G.impulse = 8;
        G.lostNavalCombatImpulse = {impulse: 7, owners: ["spain"]};

        expect(moveNaval(G, spain(), {
            fleets: [{from: "englishChannel", to: "northSea"}],
        })).toBeUndefined();
    });
});
