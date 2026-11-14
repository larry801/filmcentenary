import {Ctx} from "boardgame.io";
import {INVALID_MOVE, isInvalid} from "boardgame.io/core";
import {LandStack, VQGame, landCount} from "./constant/general";
import {continueMove, moveLand, stopContinue} from "./moves";
import {setupGame} from "./util";

const context = (player = "0"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

/**
 * Move an *allied* formation into a fortress whose defenders are too few to
 * besiege, so the defender withdraws and the active power must decide whether
 * to continue.  `pendingContinue` must remember which power owns the moving
 * units: an ally's stack lives under its own key in `space.land`, not under the
 * active power's.
 */
const alliedMoveIntoFortress = (G: VQGame): void => {
    // HRE marches Spain's (its ally's) units from Rome into Florence.
    G.powers.hre.allies.push("spain");
    G.powers.spain.allies.push("hre");
    G.powers.hre.cp = 3;
    G.powers.hre.cardPlayed = true;
    G.spaces.rome.control = "hre";
    G.spaces.rome.land = {spain: {regular: 3, merc: 0, cav: 0} as LandStack};
    G.spaces.rome.leaders = [];
    for (const owner of Object.keys(G.spaces.rome.land)) {
        if (owner !== "spain") delete G.spaces.rome.land[owner as keyof typeof G.spaces.rome.land];
    }
    G.spaces.florence.control = "independent";
    G.spaces.florence.land = {papacy: {regular: 2, merc: 0, cav: 0} as LandStack};
    G.spaces.florence.leaders = [];
    G.spaces.florence.siege = undefined;
    G.spaces.florence.unrest = false;
    delete G.pendingWithdraw;
    delete G.pendingContinue;
};

describe("withdrawal continuation remembers the moving units' owner", () => {
    it("lets the active power keep or return an allied formation", () => {
        const G = game();
        alliedMoveIntoFortress(G);
        const units = {regular: 2, merc: 0, cav: 0};

        expect(moveLand(G, context("4"), {from: "rome", to: "florence", units, leaders: [], unitPower: "spain"})).toBeUndefined();
        // Two besiegers cannot invest a fortress held by two defenders: the
        // defender withdraws and the formation must choose to continue/return.
        expect(G.pendingContinue).toBeDefined();
        expect(G.pendingContinue!.power).toBe("hre");

        expect(stopContinue(G, context("4"))).toBeUndefined();
        expect(G.pendingContinue).toBeUndefined();
        // One unit stayed in Rome; the two that marched come back.
        expect(G.spaces.rome.land.spain).toMatchObject({regular: 3, merc: 0, cav: 0});
        expect(G.spaces.florence.land.spain).toBeUndefined();
    });

    it("lets the allied formation continue the march", () => {
        const G = game();
        alliedMoveIntoFortress(G);
        const units = {regular: 2, merc: 0, cav: 0};
        expect(moveLand(G, context("4"), {from: "rome", to: "florence", units, leaders: [], unitPower: "spain"})).toBeUndefined();
        // Ancona borders Florence and is not the origin.
        const destination = "ancona";
        G.spaces[destination].control = "independent";
        G.spaces[destination].land = {};
        G.spaces[destination].leaders = [];
        G.spaces[destination].unrest = false;

        expect(continueMove(G, context("4"), {to: destination})).toBeUndefined();
        expect(G.pendingContinue).toBeUndefined();
        expect(G.spaces[destination].land.spain).toMatchObject(units);
        expect(landCount(G.spaces[destination].land.spain ?? {regular: 0, merc: 0, cav: 0})).toBe(2);
    });

    it("still works for a power moving its own units", () => {
        const G = game();
        alliedMoveIntoFortress(G);
        const units = {regular: 2, merc: 0, cav: 0};
        G.spaces.rome.land = {hre: {regular: 2, merc: 0, cav: 0}};
        G.powers.hre.cp = 3;
        expect(moveLand(G, context("4"), {from: "rome", to: "florence", units, leaders: []})).toBeUndefined();
        expect(G.pendingContinue).toMatchObject({power: "hre"});
        expect(stopContinue(G, context("4"))).toBeUndefined();
        expect(G.spaces.rome.land.hre).toMatchObject(units);
    });
});

void INVALID_MOVE;
void isInvalid;

/**
 * Rule 13.4 compares the *active formation* with the defenders.  Counting the
 * acting power's own units instead of the moving stack made an allied march
 * that outnumbers the garrison fail to besiege (its stack lives under the
 * ally's key, so the acting power's total was 0).
 */
describe("withdrawal counts the incoming formation, not the acting power", () => {
    it("besieges when the allied stack outnumbers the defenders", () => {
        const G = game();
        alliedMoveIntoFortress(G);
        // Three allied units arrive against two defenders: rule 13.4 says siege.
        expect(moveLand(G, context("4"), {from: "rome", to: "florence", units: {regular: 3, merc: 0, cav: 0}, leaders: [], unitPower: "spain"})).toBeUndefined();
        expect(G.pendingContinue).toBeUndefined();
        expect(G.spaces.florence.siege?.by).toBe("hre");
        expect(G.spaces.florence.land.spain).toMatchObject({regular: 3});
    });

    it("offers the 1 CP continuation when the allied stack is not larger", () => {
        const G = game();
        alliedMoveIntoFortress(G);
        expect(moveLand(G, context("4"), {from: "rome", to: "florence", units: {regular: 2, merc: 0, cav: 0}, leaders: [], unitPower: "spain"})).toBeUndefined();
        expect(G.pendingContinue).toMatchObject({power: "hre", unitPower: "spain"});
        expect(G.spaces.florence.siege).toBeUndefined();
    });
});

/**
 * A field battle fought by an allied stack must roll the allied units, not the
 * acting power's (which are not in the space at all).  `fieldBattle` used to
 * derive both the dice and the retreat radius from the acting power alone.
 */
describe("allied stacks fight with their own units", () => {
    it("counts the allied units in the field battle dice", () => {
        const G = game();
        G.powers.hre.allies.push("spain");
        G.powers.spain.allies.push("hre");
        G.powers.hre.cp = 3;
        G.powers.hre.cardPlayed = true;
        G.spaces.rome.control = "hre";
        G.spaces.rome.land = {spain: {regular: 4, merc: 0, cav: 0} as LandStack};
        G.spaces.rome.leaders = [];
        // Ancona is open ground (not a fortress), so this is a plain field battle.
        G.spaces.ancona.control = "papacy";
        G.spaces.ancona.land = {papacy: {regular: 1, merc: 0, cav: 0} as LandStack};
        G.spaces.ancona.leaders = [];
        G.spaces.ancona.unrest = false;
        G.spaces.ancona.siege = undefined;
        G.powers.hre.wars = [...G.powers.hre.wars.filter((w) => w !== "papacy" as never)];

        expect(moveLand(G, context("4"), {from: "rome", to: "ancona", units: {regular: 4, merc: 0, cav: 0}, leaders: [], unitPower: "spain"})).toBeUndefined();
        // The log records the dice actually rolled; 4 allied regulars must count.
        const battleLog = G.log.find((line) => line.includes("Field battle"));
        expect(battleLog).toBeDefined();
        expect(battleLog).toMatch(/[4-9] dice/);
    });
});

/** A retreating allied formation must take its own units home, not the acting power's. */
describe("allied retreats move the allied stack", () => {
    it("returns the ally's survivors to the origin space", () => {
        const G = game();
        G.powers.hre.allies.push("spain");
        G.powers.spain.allies.push("hre");
        G.powers.hre.cp = 3;
        G.powers.hre.cardPlayed = true;
        G.spaces.rome.control = "hre";
        G.spaces.rome.land = {spain: {regular: 4, merc: 0, cav: 0} as LandStack};
        G.spaces.rome.leaders = [];
        G.spaces.ancona.control = "papacy";
        G.spaces.ancona.land = {papacy: {regular: 6, merc: 0, cav: 0} as LandStack};
        G.spaces.ancona.leaders = [];
        G.spaces.ancona.unrest = false;
        G.spaces.ancona.siege = undefined;

        const before = G.spaces.rome.land.spain.regular;
        moveLand(G, context("4"), {from: "rome", to: "ancona", units: {regular: 2, merc: 0, cav: 0}, leaders: [], unitPower: "spain"});
        // Whatever the roll, no Spanish units may be stranded in Ancona and Rome
        // must account for every unit that did not die.
        expect(G.spaces.ancona.land.spain).toBeUndefined();
        expect(G.spaces.rome.land.spain.regular).toBeLessThanOrEqual(before);
        expect(G.spaces.rome.land.spain.regular).toBeGreaterThanOrEqual(before - 2);
    });
});

/**
 * With no CP left after paying for the move, rule 13.4 sends the formation
 * straight back.  That fallback also used to write the units under the acting
 * power's key, losing them from the ally's stack.
 */
describe("allied fallback retreat when no CP remains", () => {
    it("returns the ally's units to the origin", () => {
        const G = game();
        alliedMoveIntoFortress(G);
        G.powers.hre.cp = 1;   // exactly the cost of the move
        const destination = "ancona";
        G.spaces[destination].control = "independent";
        G.spaces[destination].land = {papacy: {regular: 2, merc: 0, cav: 0} as LandStack};
        G.spaces[destination].leaders = [];
        G.spaces[destination].unrest = false;
        G.spaces[destination].siege = undefined;

        expect(moveLand(G, context("4"), {from: "rome", to: "florence", units: {regular: 2, merc: 0, cav: 0}, leaders: [], unitPower: "spain"})).toBeUndefined();
        // Florence's garrison is a fortress (2 defenders vs 2 attackers), so the
        // defender withdraws and, with 0 CP left, the formation returns at once.
        expect(G.pendingContinue).toBeUndefined();
        expect(G.pendingWithdraw).toBeUndefined();
        expect(G.spaces.florence.land.spain).toBeUndefined();
        expect(G.spaces.rome.land.spain.regular).toBe(3);
        // Nothing may be attributed to the acting power.
        expect(G.spaces.rome.land.hre).toBeUndefined();
    });
});
