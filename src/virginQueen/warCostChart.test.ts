import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {Power, VQGame} from "./constant/general";
import {declareWar, declareWarMinor} from "./moves";
import {canDeclareWar, minorWarCost, setupGame, warCost} from "./util";

/**
 * Rule 9.4: "The cost of each declaration is found by cross-referencing these
 * two powers on the Diplomatic Status Display and looking at the number found
 * in the appropriate box."  These values are transcribed from the printed
 * Diplomatic Status Chart on the PAC3 reference card, with the errata's
 * correction that England may declare war on Ireland for 1 CP.
 */
const context = (playerID: string): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "diplomacy",
    numPlayers: 6,
    events: {endStage: () => undefined, endTurn: () => undefined},
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context("0"), phase: "action"} as Ctx);

describe("major-power DOW costs (printed Diplomatic Status Chart)", () => {
    it("matches every printed box", () => {
        const G = game();
        const expected: [Power, Power, number][] = [
            ["ottoman", "spain", 2],
            ["ottoman", "england", 2],
            ["ottoman", "france", 2],
            ["ottoman", "hre", 2],
            ["ottoman", "protestant", 2],
            ["spain", "france", 3],
            ["spain", "hre", 4],
            ["spain", "protestant", 1],
            ["england", "france", 3],
            ["england", "hre", 3],
            ["england", "protestant", 4],
            ["france", "hre", 3],
            ["france", "protestant", 1],
            ["hre", "protestant", 2],
        ];
        for (const [a, b, cost] of expected) {
            expect([a, b, warCost(G, a, b)]).toEqual([a, b, cost]);
            // The chart is symmetric: the same box is read from either side.
            expect([b, a, warCost(G, b, a)]).toEqual([b, a, cost]);
        }
    });

    it("keeps the variable England-Spain cost from rule 9.5", () => {
        const G = game();
        expect(warCost(G, "england", "spain")).toBe(5);
        G.elizabethExcommunicated = true;
        expect(warCost(G, "england", "spain")).toBe(3);
        G.doWCostEnglandSpain = 1;
        expect(warCost(G, "england", "spain")).toBe(1);
    });
});

describe("minor-power DOW costs (printed chart and errata)", () => {
    it("reads each printed box", () => {
        const G = game();
        expect(minorWarCost(G, "england", "ireland")).toBe(1);
        expect(minorWarCost(G, "spain", "portugal")).toBe(2);
        expect(minorWarCost(G, "france", "portugal")).toBe(2);
        expect(minorWarCost(G, "ottoman", "portugal")).toBe(1);
        expect(minorWarCost(G, "ottoman", "venice")).toBe(1);
    });

    it("refuses a box printed N/A or Possible Ally", () => {
        const G = game();
        // Spain-Papacy and Spain-Ireland are "Possible Ally" boxes.
        expect(minorWarCost(G, "spain", "papacy")).toBeUndefined();
        expect(minorWarCost(G, "spain", "ireland")).toBeUndefined();
        // The Protestant column is all N/A for the minors.
        expect(minorWarCost(G, "protestant", "scotland")).toBeUndefined();
        expect(minorWarCost(G, "england", "papacy")).toBeUndefined();
        // Ottoman-Papacy is "Tutorial only via OTTOMAN TRIBUTE".
        expect(minorWarCost(G, "ottoman", "papacy")).toBeUndefined();
    });

    it("pays the printed minor cost, not a flat 2 CP", () => {
        const G = game();
        G.powers.england.cards = [];
        G.powers.england.treasures = [1];
        expect(declareWarMinor(G, context("2"), {target: "ireland"})).toBeUndefined();
        // Exactly 1 CP was spent, so a 1-value treasure covers it.
        expect(G.powers.england.treasures).toEqual([]);
        // Ireland's diplomatic status resolves immediately; with no eligible
        // winner the declaration stands as an ongoing war.
        expect(G.minorDiplomacyResolved).toContain("ireland");
    });

    it("cannot pay a 2 CP minor war with a single 1 CP treasure", () => {
        const G = game();
        G.powers.spain.cards = [];
        G.powers.spain.treasures = [1];
        expect(declareWarMinor(G, context("1"), {target: "portugal"})).toBe(INVALID_MOVE);
        expect(G.powers.spain.treasures).toEqual([1]);
    });

    it("rejects a declaration aimed at a Possible Ally box", () => {
        const G = game();
        G.powers.spain.treasures = [5];
        expect(declareWarMinor(G, context("1"), {target: "papacy"})).toBe(INVALID_MOVE);
        expect(G.powers.spain.warsMinors).not.toContain("papacy");
        expect(G.powers.spain.treasures).toEqual([5]);
    });
});

describe("war declaration restrictions", () => {
    it("still blocks a re-declaration and a peace-then-war in one phase", () => {
        const G = game();
        G.powers.spain.treasures = [5];
        expect(canDeclareWar(G, "spain", "france")).toBe(true);
        expect(declareWar(G, context("1"), {target: "france"})).toBeUndefined();
        expect(canDeclareWar(G, "spain", "france")).toBe(false);

        const H = game();
        H.powers.spain.treasures = [5];
        H.peaceMadeThisPhase = [["spain", "france"]];
        expect(canDeclareWar(H, "spain", "france")).toBe(false);
        expect(declareWar(H, context("1"), {target: "france"})).toBe(INVALID_MOVE);
    });

    it("still applies the printed war restrictions", () => {
        const G = game();
        // A power cannot declare on the minor it is already allied with.
        G.powers.spain.alliedMinors = ["papacy"];
        expect(minorWarCost(G, "spain", "papacy")).toBeUndefined();
        // Portugal is only available once Death of King Sebastian is played.
        const H = game();
        H.minorInfluenceDefaults = Object.fromEntries(Object.entries(H.minorInfluenceDefaults)
            .map(([power, tracks]) => [power, {...tracks, portugal: undefined}])) as typeof H.minorInfluenceDefaults;
        expect(declareWarMinor(H, context("1"), {target: "portugal"})).toBe(INVALID_MOVE);
    });
});
