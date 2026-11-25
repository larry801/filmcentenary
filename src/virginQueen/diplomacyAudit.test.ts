import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {POWERS, Power, VQGame} from "./constant/general";
import {declareWar, formAlliance} from "./moves";
import {declareOttomanTributeWar, resolveMinorDiplomacy, setupGame, warCost} from "./util";

const context = (player = "1", phase = "diplomacy"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx);

const game = (scenario?: "tournament"): VQGame =>
    setupGame(context(), scenario === undefined ? undefined : {scenario});

const setInfluence = (G: VQGame, minor: "ireland" | "venice", power: Power, value: number): void => {
    for (const p of POWERS) G.powers[p].influence[minor] = 0;
    G.powers[power].influence[minor] = value;
};

describe("England-Spain DOW cost (rule 9.5 and the PAC3 chart)", () => {
    it("starts the Campaign at 5 and applies capture/execution without stacking them", () => {
        const G = game();
        expect(warCost(G, "england", "spain")).toBe(5);
        G.espionage!.mary = "captured";
        expect(warCost(G, "england", "spain")).toBe(3);
        // "—3 CP if Mary executed / —2 CP if captured (but not yet executed)".
        G.maryExecuted = true;
        expect(warCost(G, "england", "spain")).toBe(2);
        G.elizabethExcommunicated = true;
        expect(warCost(G, "england", "spain")).toBe(1);
    });

    it("opens the Tournament at 3 because Mary starts captured", () => {
        const G = game("tournament");
        expect(G.espionage!.mary).toBe("captured");
        expect(warCost(G, "spain", "england")).toBe(3);
        // Rule 9.2: no alliance while the cost is 3 or less.
        expect(formAlliance(G, context("1"), {target: "england"})).toBe(INVALID_MOVE);
    });
});

describe("France may not ally with Spain and the Protestant together (rule 9.2)", () => {
    it("refuses the second alliance whichever order they arrive in", () => {
        const G = game();
        expect(formAlliance(G, context("1"), {target: "france"})).toBeUndefined();
        expect(formAlliance(G, context("5"), {target: "france"})).toBe(INVALID_MOVE);

        const H = game();
        expect(formAlliance(H, context("5"), {target: "france"})).toBeUndefined();
        expect(formAlliance(H, context("1"), {target: "france"})).toBe(INVALID_MOVE);
    });
});

describe("one payment covers every declaration in the diplomacy step (rule 9.4 step 3)", () => {
    it("spends a single 5 CP card on two declarations whose total is 5", () => {
        const G = game();
        G.powers.england.cards = ["vq-021"];
        G.powers.england.treasures = [];
        G.powers.england.cp = 0;

        expect(declareWar(G, context("2"), {target: "ottoman"})).toBeUndefined();
        expect(G.powers.england.cards).toEqual([]);
        // England-HRE is 3 CP, covered by the 3 CP left over from the 5 CP card.
        expect(declareWar(G, context("2"), {target: "hre"})).toBeUndefined();
        expect(G.powers.england.wars).toEqual(expect.arrayContaining(["ottoman", "hre"]));
    });
});

describe("Ottoman Tribute on Venice brings the intervening power to war (rule 9.4 step 4)", () => {
    it("sets war between the winner of the status check and the Ottoman", () => {
        const G = game();
        setInfluence(G, "venice", "france", 9);
        G.minorDiplomacyResolved = G.minorDiplomacyResolved.filter((minor) => minor !== "venice");

        declareOttomanTributeWar(G, context("0", "action"), "venice");

        expect(G.powers.france.alliedMinors).toContain("venice");
        expect(G.powers.france.wars).toContain("ottoman");
        expect(G.powers.ottoman.wars).toContain("france");
    });
});

describe("Ireland activation (rule 24.2)", () => {
    const prepare = (G: VQGame): void => {
        setInfluence(G, "ireland", "spain", 9);
        G.minorDiplomacyResolved = G.minorDiplomacyResolved.filter((minor) => minor !== "ireland");
        G.spaces.ulster.land = {england: {regular: 2, merc: 0, cav: 0}};
        G.spaces.ulster.control = "england";
        G.spaces.kinsale.land = {england: {regular: 1, merc: 0, cav: 0}};
        G.spaces.kinsale.control = "france";
    };

    it("keeps Dublin English, clears Ulster, places 3 rebels and displaces foreigners", () => {
        const G = game();
        prepare(G);
        expect(resolveMinorDiplomacy(G, context("1", "action"), "ireland")).toBe("spain");

        // England is not on Ireland's printed Activate line, so its marker stays.
        expect(G.spaces.dublin.control).toBe("england");
        expect(G.spaces.ulster.land.england).toBeUndefined();
        expect(G.spaces.ulster.land.ireland?.regular).toBe(3);
        expect(G.spaces.ulster.fortress).toBe(true);
        // France was an eligible Activate power: its marker is replaced and the
        // English units there are displaced.
        expect(G.spaces.kinsale.control).toBe("spain");
        expect(G.spaces.kinsale.land.england).toBeUndefined();
        expect(G.pendingRebelMove).toEqual({power: "spain", space: "ulster", minor: "ireland"});
        // Spain may only declare this free war on England while the cost is 3 or less.
        expect(G.powers.spain.wars).not.toContain("england");
    });

    it("declares the free war on England once the DOW cost has fallen to 3", () => {
        const G = game();
        prepare(G);
        G.espionage!.mary = "captured";
        expect(resolveMinorDiplomacy(G, context("1", "action"), "ireland")).toBe("spain");
        expect(G.powers.spain.wars).toContain("england");
        expect(G.powers.england.wars).toContain("spain");
    });
});
