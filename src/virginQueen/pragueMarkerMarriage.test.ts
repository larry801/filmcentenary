import {Ctx} from "boardgame.io";
import {Power, RoyalDef, VQGame} from "./constant/general";
import {patronById} from "./scenario";
import {resolveMarriages, rulerStats, setupGame, winter} from "./util";

/** Dice are returned in order; the default keeps other rolls deterministic. */
const context = (values: number[] = [], phase = "action"): Ctx => ({
    currentPlayer: "4",
    playerID: "4",
    phase,
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), numPlayers: 6} as Ctx);

const royal = (id: string, power: Power, gender: "male" | "female", eligibility: number): RoyalDef => ({
    id, name: id, power, gender, eligibility, alive: true, married: false, status: "available",
});

const pair = (G: VQGame, male: RoyalDef, female: RoyalDef): void => {
    G.royals = G.royals.filter((existing) => existing.id !== male.id && existing.id !== female.id);
    G.royals.push(male, female);
    G.betrothals = [{male: male.id, female: female.id}];
};

const activePragueMarkerPatron = (G: VQGame) =>
    G.patronsAvailable.map((id) => patronById(G, id)).find((patron) => patron?.rating !== null);

describe("#35 FAQ: Prague Cultural Center marker and Rudolf II's marriage", () => {
    it("removes the active marker when Rudolf II dies in the marriage table", () => {
        const G = game();
        const patron = activePragueMarkerPatron(G);
        expect(patron).toBeDefined();
        G.pragueCulturalCenter = patron!.id;
        pair(G, royal("rudolf", "hre", "male", 0), royal("f9", "england", "female", 0));

        // 3+3=6 -> "Rumors of Murder": Rudolf is the male, so he is murdered.
        resolveMarriages(G, context([3, 3]));

        expect(G.lastRolls).toBe("Marriage roll: 3+3+0=6");
        expect(G.pragueCulturalCenter).toBeUndefined();
        // Death removes the marker, not a marriage report.
        expect(G.log.join("\n")).toContain("Rudolf II dies");
        expect(G.log.join("\n")).not.toContain("Rudolf II marries");
        expect(rulerStats(G, "hre")).toEqual({cardBonus: 0, admin: 1});
    });

    it("removes the marker for the rudolfII id when he dies (death in childbirth)", () => {
        const G = game();
        const patron = activePragueMarkerPatron(G);
        expect(patron).toBeDefined();
        G.pragueCulturalCenter = patron!.id;
        pair(G, royal("m9", "spain", "male", 0), royal("rudolfII", "hre", "female", 0));

        // 4+3=7 -> "Death in Childbirth": the female (here the rudolfII
        // royal) dies, so the dead-ruler penalty and marker cleanup apply.
        // (In real play Rudolf is male; this exercises the female-death
        // branch that routes through applyRulerDeath as well.)
        resolveMarriages(G, context([4, 3]));

        expect(G.pragueCulturalCenter).toBeUndefined();
        expect(rulerStats(G, "hre")).toEqual({cardBonus: 0, admin: 1});
    });

    it("keeps the marker when Rudolf survives a cancellation", () => {
        const G = game();
        const patron = activePragueMarkerPatron(G);
        expect(patron).toBeDefined();
        G.pragueCulturalCenter = patron!.id;
        pair(G, royal("rudolf", "hre", "male", 0), royal("f1", "england", "female", 0));

        resolveMarriages(G, context([6, 6]));

        expect(G.lastRolls).toBe("Marriage roll: 6+6+0=12");
        expect(G.pragueCulturalCenter).toBeUndefined();
        expect(G.log.join("\n")).toContain("Prague Cultural Center marker is removed");
    });

    it("accepts the scenario-book rudolfII royal id", () => {
        const G = game();
        const patron = activePragueMarkerPatron(G);
        expect(patron).toBeDefined();
        G.pragueCulturalCenter = patron!.id;
        pair(G, royal("rudolfII", "hre", "male", 0), royal("f2", "england", "female", 0));

        resolveMarriages(G, context([6, 6]));

        expect(G.pragueCulturalCenter).toBeUndefined();
    });

    it("keeps the marker when the marriage is cancelled", () => {
        const G = game();
        const patron = activePragueMarkerPatron(G);
        expect(patron).toBeDefined();
        G.pragueCulturalCenter = patron!.id;
        pair(G, royal("rudolf", "hre", "male", 0), royal("f3", "england", "female", 0));

        resolveMarriages(G, context([5, 4]));

        expect(G.lastRolls).toBe("Marriage roll: 5+4+0=9");
        expect(G.marriages).toBe(0);
        expect(G.pragueCulturalCenter).toBe(patron!.id);
    });

    it("keeps the marker when another royal marries", () => {
        const G = game();
        const patron = activePragueMarkerPatron(G);
        expect(patron).toBeDefined();
        G.pragueCulturalCenter = patron!.id;
        pair(G, royal("philip", "spain", "male", 0), royal("f4", "england", "female", 0));

        resolveMarriages(G, context([6, 6]));

        expect(G.pragueCulturalCenter).toBe(patron!.id);
    });

    it("removes the marker before Winter patronage is resolved", () => {
        const G = game();
        const patron = activePragueMarkerPatron(G);
        expect(patron).toBeDefined();
        G.pragueCulturalCenter = patron!.id;
        G.pendingPatronage = [{power: "hre", patronId: patron!.id, cp: 3}];
        pair(G, royal("rudolf", "hre", "male", 1), royal("f5", "england", "female", 1));

        // [6,6] resolves the 14-point marriage, [3,3] the patronage roll.
        winter(G, context([6, 6, 3, 3], "winter"));

        expect(G.pragueCulturalCenter).toBeUndefined();
        expect(G.lastRolls).toContain("bonus 1");
        expect(G.log.join("\n")).not.toContain("bonus 3");
    });
});
