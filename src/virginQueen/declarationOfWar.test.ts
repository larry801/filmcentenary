import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {Power, VQGame} from "./constant/general";
import {canDeclareWar, setupGame, atWar} from "./util";
import {declareWar, makePeace, passBlock, passBlockReasons} from "./moves";
import {diplomacyActionState} from "./diplomacyPolicy";
import {seaCaptainById} from "./data/seaCaptains";
import {powerName} from "./constant/general";

const context = (player = "1", phase: Ctx["phase"] = "diplomacy"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers: 6,
    events: {endStage: () => undefined, endTurn: () => undefined},
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("declarations of war between Spain and the Protestant (rule 9.2/9.4)", () => {
    it("allows Spain to declare war on the Protestant", () => {
        const G = game();
        G.powers.spain.treasures = [5];

        expect(canDeclareWar(G, "spain", "protestant")).toBe(true);
        expect(declareWar(G, context("1"), {target: "protestant"})).toBeUndefined();
        expect(atWar(G, "spain", "protestant")).toBe(true);
    });

    it("allows the Protestant to declare war on Spain", () => {
        const G = game();
        G.powers.protestant.treasures = [5];

        expect(declareWar(G, context("5"), {target: "spain"})).toBeUndefined();
        expect(atWar(G, "spain", "protestant")).toBe(true);
    });

    it("allows re-declaring war after a negotiated peace", () => {
        const G = game();
        G.powers.spain.wars.push("protestant");
        G.powers.protestant.wars.push("spain");
        G.powers.spain.treasures = [5];

        expect(makePeace(G, context("1"), {target: "protestant"})).toBeUndefined();
        expect(atWar(G, "spain", "protestant")).toBe(false);
        // A new diplomacy phase starts with no peace list.
        G.peaceMadeThisPhase = [];
        expect(declareWar(G, context("1"), {target: "protestant"})).toBeUndefined();
        expect(atWar(G, "spain", "protestant")).toBe(true);
    });

    it("still forbids the Spain-Protestant alliance", () => {
        const G = game();
        expect(diplomacyActionState(G, "spain", "protestant", "formAlliance")).toEqual({
            ok: false,
            reason: "spainProtestantNeverAlliance",
        });
        expect(diplomacyActionState(G, "spain", "protestant", "declareWar").ok).toBe(true);
    });

    it("reports England-Spain as unable to make peace", () => {
        const G = game();
        G.powers.england.wars.push("spain");
        G.powers.spain.wars.push("england");
        expect(diplomacyActionState(G, "england", "spain", "makePeace")).toEqual({
            ok: false,
            reason: "spainEnglandNeverPeace",
        });
        // The rule layer agrees.
        expect(makePeace(G, context("2"), {target: "spain"})).toBe(INVALID_MOVE);
    });

    it("flags an unaffordable declaration to the UI", () => {
        const G = game();
        G.powers.spain.cards = [];
        G.powers.spain.treasures = [];
        expect(diplomacyActionState(G, "spain", "england", "declareWar")).toEqual({
            ok: false,
            reason: "cannotAfford",
        });
    });
});

describe("pass block reasons", () => {
    it("lists every applicable restriction instead of only the first", () => {
        const G = game();
        const power: Power = "ottoman";
        // Ottoman under Suleiman keeps both Home cards, so the hand carries a
        // Home card and exceeds the two-card administrative rating.
        G.powers[power].cards = ["vq-001", "vq-002", "vq-003"];
        G.powers[power].cardPlayed = false;

        expect(passBlock(G, power)).toBe("home");
        expect(passBlockReasons(G, power)).toEqual(["home", "admin"]);
    });
});

describe("sea captain data", () => {
    it("keeps expedition rules as structured fields, not English prefixes", () => {
        expect(seaCaptainById("henszlein").expeditionCost).toBe(2);
        expect(seaCaptainById("villegaignon").freeColonist).toBe(true);
        expect(seaCaptainById("laudonniere").freeColonist).toBe(true);
        expect(seaCaptainById("raleigh").freeColonist).toBe(true);
    });
});

describe("localized names tolerate stale controllers", () => {
    it("echoes an unknown power id instead of crashing on the locale lookup", () => {
        expect(powerName("martians" as Power)).toBe("martians");
        expect(powerName("martians" as Power, "en")).toBe("martians");
    });
});
