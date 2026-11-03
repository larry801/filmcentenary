import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {canPlayBattleCard, chooseBattle, playBattleCard, startBattle} from "./combat";
import {playCard} from "./moves";
import {setupGame} from "./util";

const context = (playerID = "2"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const virginQueen = (G: VQGame): VQGame => {
    G.powers.england.cards = ["vq-036"];
    return G;
};

/** Spain attacks England at London: England is the controlling defender. */
const fieldBattle = (G: VQGame): void => {
    G.spaces.london.control = "england";
    G.spaces.london.land.england = {regular: 1, merc: 0, cav: 0};
    G.spaces.calais.land.spain = {regular: 1, merc: 0, cav: 0};
    startBattle(G, context("1"), "field", "london", "spain", ["england"], "calais");
};

/** France attacks the English fleet in the North Sea. */
const navalBattle = (G: VQGame): void => {
    G.seaZones.northSea.naval.france = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
    G.seaZones.northSea.naval.england = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
    startBattle(G, context("3"), "naval", "northSea", "france", ["england"], "calais");
};

/** France assaults London: the window opens in the assault phase. */
const assaultBattle = (G: VQGame): void => {
    G.spaces.london.control = "england";
    G.spaces.london.land.england = {regular: 2, merc: 0, cav: 0};
    G.spaces.calais.land.france = {regular: 4, merc: 0, cav: 0};
    startBattle(G, context("3"), "assault", "london", "france", ["england"], "calais");
};

const fieldDefenderDice = (G: VQGame): number => {
    chooseBattle(G, context("2"), {choice: "fight"});
    chooseBattle(G, context("1"), {choice: "done"});
    chooseBattle(G, context("2"), {choice: "done"});
    return G.pendingBattle!.rolls!.defender.length;
};

const navalDefenderDice = (G: VQGame): number => {
    chooseBattle(G, context("2"), {choice: "fight"});
    chooseBattle(G, context("3"), {choice: "done"});
    chooseBattle(G, context("2"), {choice: "done"});
    return G.pendingBattle!.rolls!.defender.length;
};

/** Asserts that #36 retrieves `cardId`, cannot play it, and leaves it discarded. */
const rejectedRetrieval = (G: VQGame, cardId: string): void => {
    expect(playCard(G, context("2"), {
        cardId: "vq-036", asEvent: true, target: `retrieve:${cardId}:play`,
    })).toBeUndefined();

    expect(G.pendingBattle!.cards).toEqual({});
    expect(G.discard).toEqual([cardId]);
    expect(G.powers.england.cards).toEqual([]);
    expect(G.homeSetAside).toContain("vq-036");
    expect(G.log.join("\n")).toContain("remains in the discard pile");
};

describe("Virgin Queen (#36) defender-side immediate Combat play", () => {
    it("registers a defender's field Combat card and applies its dice", () => {
        const control = virginQueen(game());
        fieldBattle(control);
        const baseDice = fieldDefenderDice(control);

        const G = virginQueen(game());
        G.discard = ["vq-008"];
        fieldBattle(G);

        expect(playCard(G, context("2"), {
            cardId: "vq-036", asEvent: true, target: "retrieve:vq-008:play",
        })).toBeUndefined();

        expect(G.pendingBattle!.cards.england).toEqual(["vq-008"]);
        expect(G.powers.england.cards).toEqual([]);
        expect(G.discard).toContain("vq-008");
        expect(G.homeSetAside).toContain("vq-036");
        expect(G.log.join("\n")).toContain("England plays 精锐部队 for the field battle");

        // Elite Troops adds three dice to the defending side.
        expect(fieldDefenderDice(G)).toBe(baseDice + 3);
    });

    it("registers a defender's naval Combat card and applies its dice", () => {
        const control = virginQueen(game());
        navalBattle(control);
        const baseDice = navalDefenderDice(control);

        const G = virginQueen(game());
        G.discard = ["vq-009"];
        navalBattle(G);

        expect(playCard(G, context("2"), {
            cardId: "vq-036", asEvent: true, target: "retrieve:vq-009:play",
        })).toBeUndefined();

        expect(G.pendingBattle!.cards.england).toEqual(["vq-009"]);
        expect(G.log.join("\n")).toContain("England plays 火攻战船 for the naval battle");

        // Fire Ships adds two dice in an ordinary naval battle.
        expect(navalDefenderDice(G)).toBe(baseDice + 2);
    });

    it("registers #40 for the defender in any battle phase", () => {
        const control = virginQueen(game());
        fieldBattle(control);
        const baseDice = fieldDefenderDice(control);

        const G = virginQueen(game());
        G.discard = ["vq-040"];
        fieldBattle(G);

        expect(playCard(G, context("2"), {
            cardId: "vq-036", asEvent: true, target: "retrieve:vq-040:play",
        })).toBeUndefined();

        expect(G.pendingBattle!.cards.england).toEqual(["vq-040"]);

        // Tilbury Speech grants England four dice.
        expect(fieldDefenderDice(G)).toBe(baseDice + 4);
    });

    it("rejects Desperate Assault (#7) for the defender and rolls the play back", () => {
        const G = virginQueen(game());
        G.discard = ["vq-007"];
        assaultBattle(G);

        expect(canPlayBattleCard(G, "england", "vq-007")).toBe(false);
        expect(playBattleCard(G, "england", "vq-007")).toBe(false);
        expect(G.pendingBattle!.cards).toEqual({});

        rejectedRetrieval(G, "vq-007");
        expect(G.powers.england.cardPlayed).toBe(true);
    });

    it("rejects Siege Engineering (#10) for the defender and rolls the play back", () => {
        const G = virginQueen(game());
        G.discard = ["vq-010"];
        assaultBattle(G);

        expect(canPlayBattleCard(G, "england", "vq-010")).toBe(false);
        expect(playBattleCard(G, "england", "vq-010")).toBe(false);
        expect(G.pendingBattle!.cards).toEqual({});

        rejectedRetrieval(G, "vq-010");
    });

    it("keeps a defender's Combat card in the discard pile when the phase does not match", () => {
        const G = virginQueen(game());
        // #9 Fire Ships is a naval card; this is a field window.
        G.discard = ["vq-009"];
        fieldBattle(G);

        rejectedRetrieval(G, "vq-009");
    });

    it("rejects a power that is not participating in the battle", () => {
        const G = virginQueen(game());
        G.discard = ["vq-008"];
        G.spaces.paris.control = "france";
        G.spaces.paris.land.france = {regular: 1, merc: 0, cav: 0};
        G.spaces.calais.land.spain = {regular: 1, merc: 0, cav: 0};
        startBattle(G, context("1"), "field", "paris", "spain", ["france"], "calais");

        expect(G.pendingBattle!.defender).toBe("france");
        expect(canPlayBattleCard(G, "england", "vq-008")).toBe(false);
        expect(canPlayBattleCard(G, "france", "vq-008")).toBe(true);

        rejectedRetrieval(G, "vq-008");
    });

    it("limits defender play to the controlling defender, not every allied defender", () => {
        const G = virginQueen(game());
        G.discard = ["vq-040"];
        G.spaces.london.control = "england";
        G.spaces.london.land.england = {regular: 1, merc: 0, cav: 0};
        G.spaces.calais.land.spain = {regular: 1, merc: 0, cav: 0};
        startBattle(G, context("1"), "field", "london", "spain", ["france", "england"], "calais");

        expect(G.pendingBattle!.defenders).toEqual(["france", "england"]);
        expect(G.pendingBattle!.defender).toBe("france");
        // The dice routine reads battle.cards[battle.defender] only, so an
        // allied defender's card cannot be registered (documented limitation).
        expect(canPlayBattleCard(G, "england", "vq-040")).toBe(false);

        rejectedRetrieval(G, "vq-040");
    });

    it("keeps a defender's Combat card in the discard pile when no battle is pending", () => {
        const G = virginQueen(game());
        G.discard = ["vq-008"];

        expect(playCard(G, context("2"), {
            cardId: "vq-036", asEvent: true, target: "retrieve:vq-008:play",
        })).toBeUndefined();

        expect(G.pendingBattle).toBeUndefined();
        expect(G.discard).toEqual(["vq-008"]);
        expect(G.powers.england.cards).toEqual([]);
    });
});
