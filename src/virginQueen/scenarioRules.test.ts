import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {SPACE_BY_ID} from "./mapData";
import {makePeace} from "./moves";
import {eventBranchChoice} from "./eventBranches";
import {diplomacyActionState} from "./diplomacyPolicy";
import {validateNegotiation} from "./negotiation";
import {atWar, friendlyController, peaceLockedThisTurn, setupGame} from "./util";

const context = (player = "0", phase: Ctx["phase"] = "diplomacy"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers: 6,
    events: {endStage: () => undefined, endTurn: () => undefined},
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
} as unknown as Ctx);

const campaign = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);
const tournament = (): VQGame => setupGame({...context(), phase: "action"} as Ctx, {scenario: "tournament"});
const tutorialContext = (player = "1"): Ctx => ({
    ...context(player),
    numPlayers: 2,
} as Ctx);
const tutorial = (): VQGame => setupGame({...tutorialContext(), phase: "action"} as Ctx, {scenario: "tutorial"});

describe("Scenario Book starting-war peace locks", () => {
    it("forbids ending either Campaign starting war during Turn 1", () => {
        const G = campaign();
        expect(peaceLockedThisTurn(G, "ottoman", "spain")).toBe(true);
        expect(peaceLockedThisTurn(G, "england", "france")).toBe(true);
        expect(makePeace(G, context("0"), {target: "spain"})).toBe(INVALID_MOVE);
        expect(makePeace(G, context("2"), {target: "france"})).toBe(INVALID_MOVE);
        expect(atWar(G, "ottoman", "spain")).toBe(true);
        expect(atWar(G, "england", "france")).toBe(true);
        expect(diplomacyActionState(G, "ottoman", "spain", "makePeace")).toEqual({
            ok: false,
            reason: "scenarioWarLock",
        });
    });

    it("blocks a Campaign peace clause in a negotiated deal", () => {
        const G = campaign();
        expect(validateNegotiation(G, "ottoman", "spain", [{kind: "peace"}]).map((issue) => issue.code))
            .toContain("peaceLocked");
        expect(validateNegotiation(G, "england", "france", [{kind: "peace"}]).map((issue) => issue.code))
            .toContain("peaceLocked");
    });

    it("lifts the Campaign lock after Turn 1", () => {
        const G = campaign();
        G.year = 2;
        expect(peaceLockedThisTurn(G, "ottoman", "spain")).toBe(false);
        expect(makePeace(G, context("0"), {target: "spain"})).toBeUndefined();
        expect(atWar(G, "ottoman", "spain")).toBe(false);
    });

    it("locks only Ottoman-Spain in the Tournament and allows France-Protestant peace", () => {
        const G = tournament();
        expect(peaceLockedThisTurn(G, "ottoman", "spain")).toBe(true);
        expect(peaceLockedThisTurn(G, "france", "protestant")).toBe(false);
        expect(validateNegotiation(G, "ottoman", "spain", [{kind: "peace"}]).map((issue) => issue.code))
            .toContain("peaceLocked");
        expect(makePeace(G, context("0"), {target: "spain"})).toBe(INVALID_MOVE);
        expect(makePeace(G, context("3"), {target: "protestant"})).toBeUndefined();
        expect(atWar(G, "france", "protestant")).toBe(false);
        expect(atWar(G, "ottoman", "spain")).toBe(true);
    });

    it("lifts the Tournament lock after Turn 3", () => {
        const G = tournament();
        G.year = 4;
        expect(peaceLockedThisTurn(G, "ottoman", "spain")).toBe(false);
        expect(makePeace(G, context("0"), {target: "spain"})).toBeUndefined();
    });
});

describe("Scenario Book setup corrections", () => {
    it("starts the Tournament with the Protestant-Scotland alliance", () => {
        const G = tournament();
        expect(G.powers.protestant.alliedMinors).toContain("scotland");
        expect(friendlyController(G, "protestant", "scotland")).toBe(true);
        const campaignGame = campaign();
        expect(campaignGame.powers.protestant.alliedMinors).not.toContain("scotland");
        expect(campaignGame.powers.france.alliedMinors).toContain("scotland");
    });

    it("keeps Bayonne independent (rule 24.7) except where the Tournament places a Huguenot garrison", () => {
        expect(SPACE_BY_ID.bayonne.home).toBe("independent");
        expect(SPACE_BY_ID.bayonne.kind).toBe("fortress");
        const campaignGame = campaign();
        expect(campaignGame.spaces.bayonne.control).toBe("independent");
        expect(campaignGame.spaces.bayonne.land).toEqual({});
        const tournamentGame = tournament();
        expect(tournamentGame.spaces.bayonne.control).toBe("protestant");
        expect(tournamentGame.spaces.bayonne.land.protestant?.regular).toBe(1);
    });

    it("keeps the already-played Morisco Revolt out of the Tournament deck", () => {
        const G = tournament();
        expect(G.morisco).toBeDefined();
        expect(G.deck).not.toContain("vq-028");
        expect(G.futureDeck).not.toContain("vq-028");
        const campaignGame = campaign();
        expect(campaignGame.morisco).toBeUndefined();
        expect(campaignGame.deck).toContain("vq-028");
    });
});

describe("Tutorial special rules (Scenario Book pp. 4-5)", () => {
    it("offers only Holy League recovery or no effect for Papal Bull", () => {
        const G = tutorial();
        const choice = eventBranchChoice(G, "vq-005", "spain", 2);
        expect(choice).toBeDefined();
        expect(choice!.branches.map((entry) => entry.id)).toEqual(["skip"]);
    });
});
