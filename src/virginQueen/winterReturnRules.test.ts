import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {landCount, VQGame} from "./constant/general";
import {SPACES} from "./mapData";
import {chooseWinterReturn} from "./moves";
import {
    applyWinterLandReturnChoice, inFrenchReligiousArea, isFortifiedSpace, legalWinterLandReturnOptions,
    legalWinterLandReturnUnits, setupGame, winter,
} from "./util";

const context = (player = "1", phase = "cardDraw"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

const game = (): VQGame => setupGame(context("0", "action"));

const spanish = (): VQGame => {
    const G = game();
    G.activePower = "spain";
    G.spaces.barcelona.control = "france";
    G.spaces.barcelona.land.spain = {regular: 2, merc: 0, cav: 0};
    winter(G, context("1", "action"));
    return G;
};

const recordFor = (G: VQGame, from: string) =>
    (G.winterReturnChoices ?? []).find((entry) => entry.power === "spain" && entry.from === from);

describe("winter return choice rules", () => {
    it("offers only destinations that can hold what must move", () => {
        const G = spanish();
        const record = recordFor(G, "barcelona");
        expect(record).toBeDefined();

        const legal = legalWinterLandReturnOptions(G, "spain", record!);
        // The origin must shed units, so staying put is not offered.
        expect(legal).not.toContain("barcelona");
        expect(legal.length).toBeGreaterThan(0);
    });

    it("eliminates Guise when no winter quarters lie inside the area", () => {
        const G = game();
        G.activePower = "france";
        for (const space of SPACES) delete G.spaces[space.id].land.france;
        // Hand every fortified French home space to Spain, leaving Geneva — a
        // French fortress outside the French religious struggle area — as the
        // only winter quarters left.  Rule 20.10 then eliminates Guise.
        for (const space of SPACES) {
            if (isFortifiedSpace(G, space.id) && inFrenchReligiousArea(space.id)) {
                G.spaces[space.id].control = "spain";
            }
        }
        G.spaces.geneva.control = "france";
        G.spaces.clermont.control = "france";
        G.spaces.clermont.land.france = {regular: 2, merc: 0, cav: 0};
        G.spaces.clermont.leaders = ["guise"];
        G.leaders.guise = {id: "guise", location: "clermont"};

        winter(G, context("3", "action"));

        expect(G.leaders.guise).toBeUndefined();
        expect(G.log.join("\n")).toContain("Duke of Guise cannot leave the French religious struggle area");
    });

    it("only offers destinations inside the area while Guise leads the stack", () => {
        const G = game();
        G.activePower = "france";
        G.spaces.clermont.control = "france";
        G.spaces.clermont.land.france = {regular: 2, merc: 0, cav: 0};
        G.spaces.clermont.leaders = ["guise"];
        G.leaders.guise = {id: "guise", location: "clermont"};

        winter(G, context("3", "action"));

        // Paris is inside the area, so Guise may winter there or in another
        // French home space; London is neither a legal destination nor inside
        // the area.
        expect(G.leaders.guise).toBeDefined();
        for (const record of (G.winterReturnChoices ?? []).filter((entry) => entry.power === "france")) {
            for (const option of legalWinterLandReturnOptions(G, "france", record)) {
                expect(inFrenchReligiousArea(option) || option === record.from).toBe(true);
            }
            expect(applyWinterLandReturnChoice(G, "france", record.id, "london")).toBe(false);
        }
    });

    it("never offers a fortress that the returning stack would overfill", () => {
        const G = game();
        G.activePower = "england";
        // Calais has room for one unit; Clermont brings five, so Calais is not
        // a legal winter quarters and cannot be offered as a destination.
        G.spaces.calais.control = "england";
        G.spaces.calais.fortress = true;
        G.spaces.calais.land.england = {regular: 3, merc: 0, cav: 0};
        G.spaces.clermont.land.england = {regular: 5, merc: 0, cav: 0};
        winter(G, context("2", "action"));

        const records = (G.winterReturnChoices ?? []).filter((entry) => entry.power === "england");
        for (const record of records) {
            expect(legalWinterLandReturnOptions(G, "england", record)).not.toContain("calais");
            // Every offered destination must be accepted by the move itself.
            for (const option of legalWinterLandReturnOptions(G, "england", record)) {
                const probe = JSON.parse(JSON.stringify(G)) as VQGame;
                expect(applyWinterLandReturnChoice(probe, "england", record.id, option)).toBe(true);
            }
        }
    });

    it("refuses a unit count below the minimum that must leave", () => {
        const G = game();
        G.activePower = "england";
        G.spaces.portsmouth.land.england = {regular: 4, merc: 2, cav: 0};
        winter(G, context("2", "action"));
        const record = (G.winterReturnChoices ?? []).find((entry) => entry.power === "england")!;

        expect(chooseWinterReturn(G, context("2"), {
            id: record.id, to: record.autoTo, units: {regular: 1, merc: 0, cav: 0},
        })).toBe(INVALID_MOVE);
        expect(landCount(G.spaces.portsmouth.land.england)).toBe(4);
    });

    it("accepts every composition the rules offer, from the excess up to the stack", () => {
        const G = game();
        G.activePower = "england";
        G.spaces.portsmouth.land.england = {regular: 4, merc: 2, cav: 0};
        winter(G, context("2", "action"));
        const record = (G.winterReturnChoices ?? []).find((entry) => entry.power === "england")!;

        const legal = legalWinterLandReturnUnits(G, "england", record, record.autoTo);
        // At least the two excess units must leave; rule 20.4 also lets any
        // further unit go home, but never more than the stack has.
        expect(legal.every((units) => {
            const total = units.regular + units.merc + units.cav;
            return total >= 2 && total <= 6 && units.regular <= 4 && units.merc <= 2;
        })).toBe(true);
        expect(legal).toContainEqual({regular: 2, merc: 0, cav: 0});
        expect(legal).toContainEqual({regular: 4, merc: 2, cav: 0});
        for (const units of legal) {
            const probe = JSON.parse(JSON.stringify(G)) as VQGame;
            expect(applyWinterLandReturnChoice(probe, "england", record.id, record.autoTo, units)).toBe(true);
        }
    });
});
