import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {startBattle} from "./combat";
import {VQGame} from "./constant/general";
import {dragutFallsRoll, piracy, playCard} from "./moves";
import {setupGame} from "./util";

const context = (player = "0", values: number[] = []): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

/** Put Dragut and two Ottoman corsairs in the north African sea zone. */
const prepareDragutAtSea = (G: VQGame): void => {
    G.powers.ottoman.cp = 2;
    G.spaces.tripoli.control = "spain";
    G.spaces.algiers.leaders = G.spaces.algiers.leaders.filter((id) => id !== "dragut");
    G.seaZones.northAfricanCoast.leaders = ["dragut"];
    G.seaZones.northAfricanCoast.naval.ottoman = {galley: 0, galleon: 0, racebuilt: 0, corsair: 2};
    G.leaders.dragut = {id: "dragut", location: "northAfricanCoast"};
};

const ottomanPiracy = (G: VQGame): void | typeof INVALID_MOVE =>
    piracy(G, context("0"), {zone: "northAfricanCoast", target: "spain"});

describe("Dragut Falls (card #11) after piracy", () => {
    it("marks Dragut as having fought after a piracy action involving him", () => {
        const G = game();
        prepareDragutAtSea(G);

        expect(ottomanPiracy(G)).toBeUndefined();

        expect(G.dragutFought).toBe(true);
        expect(G.leaders.dragut.location).toBe("northAfricanCoast");
        expect(G.seaZones.northAfricanCoast.naval.ottoman!.corsair).toBe(2);
        expect(G.powers.ottoman.cp).toBe(1);
    });

    it("does not mark Dragut as having fought when he is not in the piracy zone", () => {
        const G = game();
        prepareDragutAtSea(G);
        G.seaZones.northAfricanCoast.leaders = [];
        G.leaders.dragut = {id: "dragut", location: "algiers"};
        G.spaces.algiers.leaders.push("dragut");

        expect(ottomanPiracy(G)).toBeUndefined();

        expect(G.dragutFought).toBeUndefined();
    });

    it("allows the response roll after piracy: 4-6 kills Dragut and returns Uluch Ali", () => {
        const G = game();
        prepareDragutAtSea(G);
        expect(ottomanPiracy(G)).toBeUndefined();
        G.powers.spain.cards = ["vq-011"];
        const year = G.year;

        expect(dragutFallsRoll(G, context("1", [6]))).toBeUndefined();

        expect(G.leaders.dragut).toBeUndefined();
        expect(G.seaZones.northAfricanCoast.leaders).not.toContain("dragut");
        expect(G.leaders.uluchAli).toEqual({id: "uluchAli", location: "pool", returnTurn: year + 1});
        expect(G.removed).toContain("vq-011");
        expect(G.powers.spain.cards).not.toContain("vq-011");
        expect(G.dragutFought).toBeUndefined();
    });

    it("allows the response roll after piracy: 1-3 returns Dragut next turn", () => {
        const G = game();
        prepareDragutAtSea(G);
        expect(ottomanPiracy(G)).toBeUndefined();
        G.powers.spain.cards = ["vq-011"];
        const year = G.year;

        expect(dragutFallsRoll(G, context("1", [1]))).toBeUndefined();

        expect(G.leaders.dragut).toEqual({id: "dragut", location: "pool", returnTurn: year + 1});
        expect(G.leaders.uluchAli.returnTurn).toBeUndefined();
        expect(G.discard).toContain("vq-011");
        expect(G.removed).not.toContain("vq-011");
        expect(G.dragutFought).toBeUndefined();
    });

    it("keeps the Spain event mode: kill Dragut, remove #11, and gain 1 VP", () => {
        const G = game();
        G.powers.spain.cards = ["vq-011"];
        G.spaces.algiers.leaders = G.spaces.algiers.leaders.filter((id) => id !== "dragut");
        G.spaces.tripoli.control = "spain";
        G.spaces.tripoli.leaders = ["dragut"];
        G.leaders.dragut = {id: "dragut", location: "tripoli"};
        const vp = G.powers.spain.bonusVp;

        expect(playCard(G, context("1"), {cardId: "vq-011", asEvent: true})).toBeUndefined();

        expect(G.leaders.dragut).toBeUndefined();
        expect(G.spaces.tripoli.leaders).not.toContain("dragut");
        expect(G.leaders.uluchAli.returnTurn).toBe(G.year + 1);
        expect(G.powers.spain.bonusVp).toBe(vp + 1);
        expect(G.removed).toContain("vq-011");
    });

    it("keeps battle behavior: starting a battle with Dragut still sets the flag", () => {
        const G = game();
        G.spaces.algiers.leaders = G.spaces.algiers.leaders.filter((id) => id !== "dragut");
        G.seaZones.northAfricanCoast.leaders = ["dragut"];
        G.leaders.dragut = {id: "dragut", location: "northAfricanCoast"};

        expect(startBattle(G, context("0"), "naval", "northAfricanCoast", "ottoman", ["spain"], "algiers")).toBeUndefined();

        expect(G.dragutFought).toBe(true);
    });
});
