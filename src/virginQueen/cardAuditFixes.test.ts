import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {eventTargetOptions} from "./eventTargets";
import {playCard} from "./moves";
import {KEY_SPACES, SPACES} from "./mapData";
import {setupGame} from "./util";

/**
 * Regressions for five card-implementation defects found while auditing every
 * printed card:
 *
 *  - #99 Spanish Armada ignored the printed "+1 CP if Elizabeth I is
 *    excommunicated" clause.
 *  - #46 Spanish Fury gave the seized card and the draw to Spain instead of the
 *    power that had just captured the key, so any non-Spanish capture produced
 *    the wrong result.
 *  - #46's target list offered every power except Spain, including powers that
 *    were not the defender.
 *  - #44 Sack! gave the "+1 Card" marker to only the first defending power even
 *    when several powers defended the surrendered fortresses.
 *  - #50 Council of Troubles could take a Dutch key, which the printed card
 *    forbids ("...and are not keys").
 */

const ctx = (seat = "1"): Ctx => ({
    currentPlayer: seat,
    playerID: seat,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...ctx(), phase: "action"} as Ctx);

describe("#99 Spanish Armada excommunication bonus", () => {
    it("adds 1 CP when Elizabeth I has been excommunicated", () => {
        const G = game();
        G.powers.spain.cards = ["vq-099"];
        G.elizabethExcommunicated = true;
        G.armada = undefined;
        G.powers.spain.cp = 0;

        expect(playCard(G, ctx(), {cardId: "vq-099", asEvent: true})).toBeUndefined();

        expect(G.armada).toBeDefined();
        expect(G.powers.spain.cp).toBe(6);
    });

    it("grants the printed 5 CP without the excommunication", () => {
        const G = game();
        G.powers.spain.cards = ["vq-099"];
        G.elizabethExcommunicated = false;
        G.armada = undefined;
        G.powers.spain.cp = 0;

        expect(playCard(G, ctx(), {cardId: "vq-099", asEvent: true})).toBeUndefined();

        expect(G.powers.spain.cp).toBe(5);
    });

    it("adds the bonus to the 7 CP upgrade branch too", () => {
        const G = game();
        G.powers.spain.cards = ["vq-099"];
        G.elizabethExcommunicated = true;
        G.armada = {strength: 2, location: "seville"};
        G.powers.spain.cp = 0;

        expect(playCard(G, ctx(), {cardId: "vq-099", asEvent: true})).toBeUndefined();

        expect(G.powers.spain.cp).toBe(8);
    });
});

describe("#46 Spanish Fury belongs to the capturing power", () => {
    it("gives the seized card and the draw to England after an English capture", () => {
        const G = game();
        G.powers.england.cards = ["vq-046"];
        G.powers.france.cards = ["vq-020", "vq-021"];
        G.lastCapture = {space: "dover", attacker: "england", impulse: G.impulse};
        const englishHand = G.powers.england.cards.length;
        const frenchIds = [...G.powers.france.cards];

        expect(playCard(G, ctx("2"), {cardId: "vq-046", asEvent: true, target: "france"})).toBeUndefined();

        // #46 itself leaves the hand, then the seized card and one drawn card
        // arrive, so the net change is +1.
        expect(G.powers.england.cards.length).toBe(englishHand + 1);
        const seized = frenchIds.filter((id) => G.powers.england.cards.includes(id));
        expect(seized).toHaveLength(1);
        expect(G.powers.france.cards).toHaveLength(1);
        expect(G.powers.france.marriageCardModifier).toBe(1);
    });

    it("offers only the defender as a target and nothing without a capture", () => {
        const G = game();
        G.lastCapture = undefined;
        expect(eventTargetOptions(G, "vq-046", "england")).toEqual([]);

        G.lastCapture = {space: "dover", attacker: "england", impulse: G.impulse};
        const values = eventTargetOptions(G, "vq-046", "england").map((option) => option.value);
        expect(values).not.toContain("england");
        expect(values).toContain("france");
    });
});

describe("#44 Sack! compensates every defending power", () => {
    it("gives each defending power a +1 Card marker", () => {
        const G = game();
        G.powers.england.cards = ["vq-044"];
        G.spaces.portsmouth.control = "england";
        G.spaces.portsmouth.fortress = true;
        // Dover is defended by both France and the Protestant.
        G.spaces.dover.control = "france";
        G.spaces.dover.fortress = true;
        G.spaces.dover.land = {
            france: {regular: 0, merc: 0, cav: 0},
            protestant: {regular: 1, merc: 0, cav: 0},
        };
        G.spaces.dover.siege = undefined;
        G.lastCapture = {space: "portsmouth", attacker: "england", impulse: G.impulse};

        expect(playCard(G, ctx("2"), {cardId: "vq-044", asEvent: true, target: "portsmouth"})).toBeUndefined();

        expect(G.spaces.dover.control).toBe("england");
        expect(G.powers.france.marriageCardModifier).toBe(1);
        expect(G.powers.protestant.marriageCardModifier).toBe(1);
    });
});

describe("#50 Council of Troubles never takes a key", () => {
    it("skips Protestant keys when choosing the three spaces", () => {
        const G = game();
        G.powers.spain.cards = ["vq-050"];
        G.spaces.brussels.control = "spain";
        G.spaces.brussels.land.spain = {regular: 5, merc: 0, cav: 0};
        const dutchKey = SPACES.find((space) => space.area === "netherlands" && KEY_SPACES.includes(space.id))!;
        G.spaces[dutchKey.id].control = "protestant";
        G.spaces[dutchKey.id].land = {};
        G.spaces[dutchKey.id].unrest = false;

        expect(playCard(G, ctx(), {cardId: "vq-050", asEvent: true})).toBeUndefined();

        expect(G.spaces[dutchKey.id].control).toBe("protestant");
    });
});
