import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {piracy} from "./moves";
import {choosePiracy, piracyOptions, startPiracy} from "./piracy";
import {setupGame} from "./util";

const context = (player = "1", values: number[] = []): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const prepareSpanishFleet = (G: VQGame): void => {
    G.powers.spain.cp = 2;
    G.seaZones.northAfricanCoast.naval.spain = {galley: 2, galleon: 0, racebuilt: 0, corsair: 0};
};

describe("Europe-map piracy awards (rule 16.4)", () => {
    it("offers and awards the VP option to a non-Ottoman pirate", () => {
        const G = game();
        G.powers.ottoman.cards.push("vq-008");
        G.pendingPiracy = {power: "spain", target: "ottoman", zone: "northAfricanCoast", step: "rewards", remaining: 1, rewards: {}};

        expect(piracyOptions(G).map((option) => option.id)).toContain("vp");
        const before = G.powers.spain.bonusVp;
        expect(choosePiracy(G, context("0"), {choice: "vp"})).toBeUndefined();
        expect(G.powers.spain.bonusVp).toBe(before + 1);
        expect(G.tutorialEffects).toBeUndefined();
    });

    it("counts a target fortress adjacent to the zone as a defense die", () => {
        const G = game();
        prepareSpanishFleet(G);

        startPiracy(G, context("1"), "spain", "ottoman", "northAfricanCoast");

        expect(G.log.join("\n")).toContain("Piracy defense [1] = 0 hits");
    });

    it("forbids Spain from initiating piracy in the Armada's sea zone", () => {
        const G = game();
        prepareSpanishFleet(G);
        G.armada = {strength: 2, location: "northAfricanCoast"};

        expect(piracy(G, context("1"), {zone: "northAfricanCoast", target: "ottoman"})).toBe(INVALID_MOVE);
    });
});
