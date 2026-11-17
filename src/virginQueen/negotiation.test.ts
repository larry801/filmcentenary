import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {VirginQueenGameDef} from "./game";
import {counterDeal, proposeDeal, respondDeal, withdrawDeal} from "./negotiationMoves";
import {
    canYieldSpace,
    executeNegotiation,
    expireOpenOffer,
    loanOptions,
    negotiationTermText,
    validateNegotiation,
    yieldableSpaces,
} from "./negotiation";
import {atWar, capitalSpacesFor, setupGame} from "./util";

const events = () => ({
    setActivePlayers: jest.fn(),
    endStage: jest.fn(),
    endTurn: jest.fn(),
});

const context = (player = "3", extra: Partial<Ctx> = {}): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "diplomacy",
    numPlayers: 6,
    events: events(),
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
    ...extra,
} as unknown as Ctx);

const game = (): VQGame => {
    const G = setupGame({...context(), phase: "action"} as Ctx);
    G.log = [];
    G.negotiation = {offer: null, history: [], nextId: 1};
    return G;
};

const owner = (power: string): string => String(["ottoman", "spain", "england", "france", "hre", "protestant"].indexOf(power));

describe("Virgin Queen negotiation table (rule 9.1)", () => {
    it("opens a private offer and gives both sides one temporary move", () => {
        const G = game();
        G.powers.france.cards = ["vq-020", "vq-050"];
        const ctx = context("3");

        expect(proposeDeal(G, ctx, {
            target: "spain",
            terms: [{kind: "cards", from: "france", to: "spain", count: 1}],
            promises: [{from: "france", text: "I will not attack Milan this turn."}],
        })).toBeUndefined();

        expect(G.negotiation!.offer).toMatchObject({
            from: "france", to: "spain",
            terms: [{kind: "cards", from: "france", to: "spain", count: 1}],
            promises: [{from: "france", text: "I will not attack Milan this turn."}],
        });
        expect(ctx.events!.setActivePlayers).toHaveBeenCalledWith({
            value: {[owner("france")]: "dealOffer", [owner("spain")]: "dealResponse"},
            moveLimit: 1,
        });
        // Opening the table is not a public event: the log stays empty.
        expect(G.log).toEqual([]);
    });

    it("executes every clause atomically when the other power seals the deal", () => {
        const G = game();
        G.powers.france.cards = ["vq-020"];
        G.spaces.paris.land.france = {regular: 0, merc: 4, cav: 0};
        G.powers.spain.treasures = [];
        const proposerCtx = context("3");
        const offerId = "deal-1";
        expect(proposeDeal(G, proposerCtx, {
            target: "spain",
            terms: [
                {kind: "cards", from: "france", to: "spain", count: 1},
                {kind: "mercenaries", from: "france", to: "spain", count: 2},
            ],
        })).toBeUndefined();

        const responderCtx = context("1", {playerID: "1"});
        expect(respondDeal(G, responderCtx, {offerId, action: "accept"})).toBeUndefined();

        expect(G.powers.france.cards).toEqual([]);
        expect(G.powers.spain.cards).toContain("vq-020");
        const capital = capitalSpacesFor(G, "spain").find((id) =>
            G.spaces[id].control === "spain" && !G.spaces[id].unrest);
        expect(capital).toBeDefined();
        expect(G.spaces[capital!].land.spain?.merc).toBe(2);
        // The formal proposer is the earlier power in impulse order.
        expect(G.negotiation!.history).toHaveLength(1);
        expect(G.negotiation!.history[0]).toMatchObject({proposer: "spain", confirmer: "france"});
        expect(G.negotiation!.offer).toBeNull();
        expect(G.log.join("\n")).toContain("announce an agreement");
        expect(responderCtx.events!.setActivePlayers).toHaveBeenCalledWith({value: {}});
    });

    it("rejects an offer without changing the game", () => {
        const G = game();
        G.powers.france.cards = ["vq-020"];
        expect(proposeDeal(G, context("3"), {
            target: "spain", terms: [{kind: "cards", from: "france", to: "spain", count: 1}],
        })).toBeUndefined();
        const before = G.powers.france.cards.slice();

        expect(respondDeal(G, context("1", {playerID: "1"}), {offerId: "deal-1", action: "reject"})).toBeUndefined();
        expect(G.negotiation!.offer).toBeNull();
        expect(G.powers.france.cards).toEqual(before);
        expect(G.negotiation!.history).toEqual([]);
    });

    it("counters by turning the table around and replacing the offer", () => {
        const G = game();
        G.powers.france.cards = ["vq-020"];
        G.powers.spain.cards = ["vq-050"];
        expect(proposeDeal(G, context("3"), {
            target: "spain", terms: [{kind: "cards", from: "france", to: "spain", count: 1}],
        })).toBeUndefined();

        expect(counterDeal(G, context("1", {playerID: "1"}), {
            offerId: "deal-1",
            terms: [{kind: "cards", from: "spain", to: "france", count: 1}],
            promises: [{from: "spain", text: "I will keep the galleys in port."}],
        })).toBeUndefined();

        expect(G.negotiation!.offer).toMatchObject({
            id: "deal-2", from: "spain", to: "france", counterOf: "deal-1",
            terms: [{kind: "cards", from: "spain", to: "france", count: 1}],
        });
        expect(respondDeal(G, context("3", {playerID: "3"}), {offerId: "deal-2", action: "accept"})).toBeUndefined();
        expect(G.powers.france.cards).toContain("vq-050");
        expect(G.powers.spain.cards).toEqual([]);
    });

    it("lets the proposer withdraw while the other side is reading", () => {
        const G = game();
        expect(proposeDeal(G, context("3"), {
            target: "spain", terms: [{kind: "alliance"}],
        })).toBeUndefined();
        expect(withdrawDeal(G, context("3"), {offerId: "deal-1"})).toBeUndefined();
        expect(G.negotiation!.offer).toBeNull();
    });

    it("resolves a peace together with a marriage that peace makes legal", () => {
        const G = game();
        if (!atWar(G, "england", "hre")) {
            G.powers.england.wars.push("hre");
            G.powers.hre.wars.push("england");
        }
        G.betrothals = [];
        const male = G.royals.find((royal) => royal.id === "charlesII");
        const female = G.royals.find((royal) => royal.id === "elizabeth");
        expect(male).toBeDefined();
        expect(female).toBeDefined();

        expect(proposeDeal(G, context("2"), {
            target: "hre",
            terms: [{kind: "peace"}, {kind: "betrothal", male: "charlesII", female: "elizabeth"}],
        })).toBeUndefined();
        expect(respondDeal(G, context("4", {playerID: "4"}), {offerId: "deal-1", action: "accept"})).toBeUndefined();

        expect(atWar(G, "england", "hre")).toBe(false);
        expect(G.betrothals).toEqual([{male: "charlesII", female: "elizabeth"}]);
    });

    it("yields a French space between France and the Protestant", () => {
        const G = game();
        G.spaces.bordeaux.control = "france";
        G.spaces.bordeaux.land = {};
        expect(canYieldSpace(G, "france", "protestant", "bordeaux")).toBe(true);
        expect(yieldableSpaces(G, "france", "protestant")).toContain("bordeaux");

        expect(proposeDeal(G, context("3"), {
            target: "protestant",
            terms: [{kind: "yieldSpace", from: "france", to: "protestant", space: "bordeaux"}],
        })).toBeUndefined();
        expect(respondDeal(G, context("5", {playerID: "5"}), {offerId: "deal-1", action: "accept"})).toBeUndefined();
        expect(G.spaces.bordeaux.control).toBe("protestant");
    });

    it("adds a naval loan to the same alliance announcement", () => {
        const G = game();
        G.powers.france.allies = G.powers.france.allies.filter((p) => p !== "spain");
        G.powers.spain.allies = G.powers.spain.allies.filter((p) => p !== "france");
        G.spaces.marseille.control = "france";
        G.spaces.marseille.naval = {france: {galley: 2, galleon: 0, racebuilt: 0, corsair: 0}};
        G.spaces.barcelona.control = "spain";
        G.spaces.barcelona.naval = {};
        G.loanedNaval = [];
        const loan = loanOptions(G, "france", "spain")[0];
        expect(loan).toBeDefined();

        expect(proposeDeal(G, context("3"), {
            target: "spain",
            terms: [
                {kind: "alliance"},
                {
                    kind: "navalLoan", from: "france", to: "spain",
                    fromPort: loan.fromPort, toPort: loan.toPort, ship: "galley",
                },
            ],
        })).toBeUndefined();
        expect(respondDeal(G, context("1", {playerID: "1"}), {offerId: "deal-1", action: "accept"})).toBeUndefined();

        expect(G.powers.france.allies).toContain("spain");
        expect(G.spaces.barcelona.naval.spain?.galley).toBe(1);
        expect(G.loanedNaval).toHaveLength(1);
    });

    it("rejects a naval loan that runs in both directions in one deal", () => {
        const G = game();
        G.spaces.marseille.control = "france";
        G.spaces.marseille.naval = {france: {galley: 2, galleon: 0, racebuilt: 0, corsair: 0}};
        G.spaces.barcelona.control = "spain";
        G.spaces.barcelona.naval = {spain: {galley: 2, galleon: 0, racebuilt: 0, corsair: 0}};
        G.loanedNaval = [];
        const codes = validateNegotiation(G, "france", "spain", [
            {kind: "alliance"},
            {kind: "navalLoan", from: "france", to: "spain", fromPort: "marseille", toPort: "barcelona", ship: "galley"},
            {kind: "navalLoan", from: "spain", to: "france", fromPort: "barcelona", toPort: "marseille", ship: "galley"},
        ]).map((issue) => issue.code);
        expect(codes).toContain("loanReciprocal");
    });

    it("rejects a partial execution and leaves the table untouched", () => {
        const G = game();
        G.powers.france.cards = [];
        const before = JSON.stringify(G);
        const issues = executeNegotiation(G, context("3"), "france", "spain",
            [{kind: "cards", from: "france", to: "spain", count: 1}]);
        expect(issues.map((issue) => issue.code)).toContain("noCards");
        // Validation is non-mutating; the snapshot only guards the execution path.
        expect(JSON.parse(JSON.stringify(G))).toEqual(JSON.parse(before));
    });

    it("expires an unconfirmed offer with the segment", () => {
        const G = game();
        G.negotiation!.offer = {
            id: "deal-9", from: "france", to: "spain", terms: [{kind: "alliance"}],
            promises: [], year: G.year, turn: 1,
        };
        expireOpenOffer(G);
        expect(G.negotiation!.offer).toBeNull();
    });
});

describe("negotiation validation", () => {
    const issues = (G: VQGame, terms: Parameters<typeof validateNegotiation>[3], from = "france", to = "spain") =>
        validateNegotiation(G, from as never, to as never, terms).map((issue) => issue.code);

    it("requires at least one clause and both powers at the table", () => {
        const G = game();
        expect(issues(G, [])).toContain("empty");
        expect(issues(G, [{kind: "alliance"}], "france", "france")).toContain("samePower");
    });

    it("enforces the per-direction gift limits and reciprocity", () => {
        const G = game();
        G.powers.france.cards = ["vq-020", "vq-050"];
        expect(issues(G, [{kind: "cards", from: "france", to: "spain", count: 3}])).toContain("badCount");
        expect(issues(G, [
            {kind: "cards", from: "france", to: "spain", count: 1},
            {kind: "cards", from: "spain", to: "france", count: 1},
        ])).toContain("giftReciprocal");
        G.diplomacyGifts = {"spain->france": {cards: 1, treasures: 0, mercenaries: 0}};
        expect(issues(G, [{kind: "cards", from: "france", to: "spain", count: 1}])).toContain("giftReciprocal");
    });

    it("checks the whole direction, not each clause in isolation", () => {
        const G = game();
        G.powers.france.cards = ["vq-020", "vq-050"];
        expect(issues(G, [
            {kind: "cards", from: "france", to: "spain", count: 2},
            {kind: "cards", from: "france", to: "spain", count: 1},
        ])).toContain("noCards");
    });

    it("rejects gifts to an enemy without a peace clause", () => {
        const G = game();
        expect(atWar(G, "france", "england")).toBe(true);
        G.powers.france.cards = ["vq-020"];
        expect(issues(G, [{kind: "cards", from: "france", to: "england", count: 1}], "france", "england"))
            .toContain("giftAtWar");
    });

    it("applies the Catholic League deal ban to every clause kind", () => {
        const G = game();
        G.catholicLeagueNoDealsUntil = G.year;
        G.powers.france.cards = ["vq-020"];
        expect(issues(G, [{kind: "cards", from: "france", to: "spain", count: 1}])).toContain("catholicLeague");
    });

    it("keeps the printed alliance restrictions", () => {
        const G = game();
        expect(issues(G, [{kind: "alliance"}], "spain", "protestant")).toContain("allianceSpainProtestant");
        if (!atWar(G, "france", "spain")) {
            G.powers.france.wars.push("spain");
            G.powers.spain.wars.push("france");
        }
        expect(issues(G, [{kind: "alliance"}], "france", "spain")).toContain("allianceAtWar");
    });

    it("formats clauses for both interface languages", () => {
        const G = game();
        const term = {kind: "yieldSpace", from: "france", to: "protestant", space: "bordeaux"} as const;
        expect(negotiationTermText(G, term, "en")).toContain("Bordeaux");
        expect(negotiationTermText(G, term, "zh_CN")).toContain("波尔多");
    });
});

describe("negotiation privacy", () => {
    it("hides the open offer and private promises from uninvolved clients", () => {
        const G = game();
        G.powers.france.cards = ["vq-020"];
        G.negotiation!.offer = {
            id: "deal-1", from: "france", to: "spain",
            terms: [{kind: "cards", from: "france", to: "spain", count: 1}],
            promises: [{from: "france", text: "A private promise"}],
            year: G.year, turn: 1,
        };
        G.negotiation!.history = [{
            id: "deal-0", proposer: "spain", confirmer: "france",
            terms: [{kind: "alliance"}],
            promises: [{from: "france", text: "A private promise"}],
            year: G.year, turn: 1,
        }];
        const viewFor = (player: string) => VirginQueenGameDef.playerView!(G, context(player), player);

        expect(viewFor("3").negotiation!.offer).not.toBeNull();
        expect(viewFor("1").negotiation!.offer).not.toBeNull();
        expect(viewFor("2").negotiation!.offer).toBeNull();
        expect(viewFor("3").negotiation!.history[0].promises).toHaveLength(1);
        expect(viewFor("2").negotiation!.history[0].promises).toEqual([]);
        expect(viewFor("2").negotiation!.history[0].terms).toEqual([{kind: "alliance"}]);
    });
});
