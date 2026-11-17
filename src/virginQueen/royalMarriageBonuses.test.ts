import {Ctx} from "boardgame.io";
import {Power, VQGame} from "./constant/general";
import {SPACES} from "./mapData";
import {acceptBetroth, proposeBetroth} from "./moves";
import {royalAvailable} from "./scenario";
import {
    availableHomeCards,
    resolveMarriage,
    resolveMarriages,
    setupGame,
    settlePrearrangedValoisMarriage,
    winter,
} from "./util";

/** Dice are consumed in order; the fallback keeps other rolls deterministic. */
const context = (dice: number[] = [], phase = "winter", currentPlayer = "0"): Ctx => ({
    currentPlayer,
    playerID: currentPlayer,
    phase,
    numPlayers: 6,
    random: {Die: () => dice.shift() ?? 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame(context([], "action") as Ctx);

const royal = (G: VQGame, id: string) => G.royals.find((entry) => entry.id === id)!;

/**
 * Replace both royals with plain definitions so the test drives only the
 * bonus under test (the scenario pool is otherwise full of real royals).
 */
const pair = (
    G: VQGame,
    maleId: string,
    malePower: Power,
    femaleId: string,
    femalePower: Power,
    femaleFamily?: "valois" | "hapsburg",
): void => {
    G.royals = G.royals.filter((entry) => entry.id !== maleId && entry.id !== femaleId);
    G.royals.push(
        {id: maleId, name: maleId, power: malePower, gender: "male", eligibility: 0, alive: true, married: false, status: "available"},
        {id: femaleId, name: femaleId, power: femalePower, gender: "female", eligibility: 0, alive: true, married: false, status: "available",
            ...(femaleFamily !== undefined ? {family: femaleFamily} : {})},
    );
};

const marry = (G: VQGame, maleId: string, femaleId: string, dice: number[]): void => {
    G.betrothals = [{male: maleId, female: femaleId}];
    resolveMarriages(G, context(dice));
};

describe("Royal marriage bonuses (Scenario Book p. 33)", () => {
    describe("Earl of Arran", () => {
        it("resolves a Protestant sermon in Scotland after the wedding", () => {
            const G = game();
            pair(G, "arran", "protestant", "f19", "england");
            // Give the sermon something to do: a Protestant anchor next to
            // Catholic Scottish spaces, which is what a real game looks like.
            G.spaces.edinburgh.religion = "protestant";
            G.spaces.stirling.religion = "catholic";
            G.spaces.perth.religion = "catholic";
            const before = SPACES.filter((space) => space.area === "scotland" && G.spaces[space.id].religion === "protestant").length;

            // 6+6 is the wedding; the five 5s are the sermon's conversion dice.
            marry(G, "arran", "f19", [6, 6, 5, 5, 5, 5, 5]);

            const after = SPACES.filter((space) => space.area === "scotland" && G.spaces[space.id].religion === "protestant").length;
            expect(after).toBeGreaterThan(before);
            expect(G.log.join("\n")).toContain("Earl of Arran's marriage: the Protestant preaches a sermon in Scotland.");
        });

        it("does nothing on a Last Minute Cancellation", () => {
            const G = game();
            pair(G, "arran", "protestant", "f19", "england");
            const religions = SPACES.map((space) => G.spaces[space.id].religion);

            marry(G, "arran", "f19", [4, 5]); // 9: the marriage never happens.

            expect(G.betrothals).toEqual([]);
            expect(SPACES.map((space) => G.spaces[space.id].religion)).toEqual(religions);
            expect(G.log.join("\n")).not.toContain("Earl of Arran's marriage");
        });
    });

    describe("Mary Queen of Scots and Lord Darnley", () => {
        it("adds 2 influence in Scotland for her husband's power", () => {
            const G = game();
            pair(G, "maryScots", "france", "m20", "spain");
            const before = G.powers.spain.influence.scotland ?? 0;

            marry(G, "m20", "maryScots", [6, 6]);

            expect(G.powers.spain.influence.scotland).toBe(before + 2);
        });

        it("adds 2 French influence in Scotland when Darnley marries Mary", () => {
            const G = game();
            pair(G, "darnley", "england", "maryScots", "france");
            const before = G.powers.france.influence.scotland ?? 0;

            marry(G, "darnley", "maryScots", [6, 6]);

            expect(G.powers.france.influence.scotland).toBe(before + 2);
            expect(G.log.join("\n")).toContain("Henry, Lord Darnley's marriage adds 2 French influence in Scotland.");
        });

        it("resolves a Mary Queen of Scots betrothal inside the Diplomacy Phase", () => {
            const G = game();
            G.year = 2;
            G.royals = G.royals.filter((entry) => entry.id !== "maryScots" && entry.id !== "donCarlos");
            G.royals.push(
                {id: "donCarlos", name: "donCarlos", power: "spain", gender: "male", eligibility: 2, alive: true, married: false, status: "available"},
                {id: "maryScots", name: "maryScots", power: "france", gender: "female", eligibility: 3, alive: true, married: false, status: "available"},
            );

            const spain = context([6, 6], "diplomacy", "1");
            expect(proposeBetroth(G, spain, {male: "donCarlos", female: "maryScots"})).toBeUndefined();
            expect(acceptBetroth(G, context([6, 6], "diplomacy", "3"))).toBeUndefined();

            // The wedding happened during the phase, so nothing is left to
            // resolve at the end of the turn.
            expect(G.betrothals).toEqual([]);
            expect(royal(G, "maryScots").married).toBe(true);
            expect(G.log.join("\n")).toContain("Mary Queen of Scots' wedding is resolved immediately");
        });
    });

    describe("Elisabeth of Austria", () => {
        it("makes her Spanish husband suppress heresy in the Netherlands", () => {
            const G = game();
            pair(G, "elisabethAustria", "hre", "m21", "spain");
            // Leave a Catholic anchor so the suppression has a legal target.
            G.spaces.brussels.religion = "catholic";
            for (const space of SPACES.filter((entry) => entry.area === "netherlands" && entry.id !== "brussels")) {
                G.spaces[space.id].religion = "protestant";
            }
            const before = SPACES.filter((space) => space.area === "netherlands" && G.spaces[space.id].religion === "protestant").length;

            // 6+6 is the wedding; the five 5s are the suppression dice.
            marry(G, "m21", "elisabethAustria", [6, 6, 5, 5, 5, 5, 5]);

            const after = SPACES.filter((space) => space.area === "netherlands" && G.spaces[space.id].religion === "protestant").length;
            expect(after).toBeLessThan(before);
            expect(G.log.join("\n")).toContain("Elisabeth of Austria's marriage:");
        });

        it("leaves a husband with no Suppress Heresy action without effect", () => {
            const G = game();
            pair(G, "elisabethAustria", "hre", "m22", "protestant");
            const religions = SPACES.map((space) => G.spaces[space.id].religion);

            marry(G, "m22", "elisabethAustria", [6, 6]);

            expect(SPACES.map((space) => G.spaces[space.id].religion)).toEqual(religions);
            expect(G.log.join("\n")).not.toContain("Elisabeth of Austria's marriage");
        });
    });

    describe("Earl of Leicester", () => {
        it("stays in the pool at eligibility 1 while Elizabeth is unmarried", () => {
            const G = game();
            const leicester = royal(G, "leicester");
            Object.assign(leicester, {alive: true, married: false, status: "available", eligibility: 1, turn: 1});
            const elizabeth = royal(G, "elizabeth");
            Object.assign(elizabeth, {alive: true, married: false, status: "available", eligibility: 5});

            winter(G, context());

            expect(leicester.eligibility).toBe(1);
            expect(royalAvailable(leicester)).toBe(true);
        });

        it("ages normally once Elizabeth has married", () => {
            const G = game();
            const leicester = royal(G, "leicester");
            Object.assign(leicester, {alive: true, married: false, status: "available", eligibility: 1, turn: 1});
            Object.assign(royal(G, "elizabeth"), {married: true, status: "aged"});

            winter(G, context([3]));

            expect(leicester.eligibility).toBe(0);
            expect(leicester.status).toBe("aged");
        });
    });

    describe("Rudolf II", () => {
        it("removes the Patron of Arts & Sciences Home Card when he marries", () => {
            const G = game();
            G.year = 4;
            pair(G, "rudolfII", "hre", "f23", "england");

            marry(G, "rudolfII", "f23", [6, 6]);

            expect(G.rudolfHomeCardLost).toBe(true);
            expect(G.removed).toContain("vq-035");
            expect(availableHomeCards(G, "hre")).not.toContain("vq-035");
            expect(G.log.join("\n")).toContain("loses the Patron of Arts & Sciences Home Card");
        });

        it("keeps the Home Card while Rudolf stays unmarried", () => {
            const G = game();
            expect(G.rudolfHomeCardLost).toBeUndefined();
            expect(availableHomeCards(G, "hre")).toContain("vq-035");
        });
    });

    describe("Philip II's prearranged marriage", () => {
        it("starts both royals in the Turn 1 pool instead of married", () => {
            const G = game();
            expect(royalAvailable(royal(G, "philip"))).toBe(true);
            expect(royalAvailable(royal(G, "elisabethValois"))).toBe(true);
            expect(G.prearrangedValoisMarriage).toEqual({year: 1});
        });

        it("charges Spain a card on Turn 2 when the agreement is not honoured", () => {
            const G = game();
            G.year = 1;

            settlePrearrangedValoisMarriage(G);

            expect(G.prearrangedValoisMarriage).toEqual({year: 1, broken: true});
            expect(G.pendingCardDraws).toEqual([{power: "spain", turn: 2, amount: -1}]);
            G.year = 2;
            expect(G.pendingCardDraws).toBeDefined();
        });

        it("does not charge Spain when the two actually marry on Turn 1", () => {
            const G = game();
            G.year = 1;
            royal(G, "philip").eligibility = 3;
            royal(G, "elisabethValois").eligibility = 2;

            marry(G, "philip", "elisabethValois", [6, 6]);
            settlePrearrangedValoisMarriage(G);

            expect(G.prearrangedValoisMarriage).toEqual({year: 1, broken: true, honoured: true});
            expect(G.pendingCardDraws ?? []).toEqual([]);
        });

        it("charges Spain after a Last Minute Cancellation", () => {
            const G = game();
            G.year = 1;
            royal(G, "philip").eligibility = 0;
            royal(G, "elisabethValois").eligibility = 0;

            marry(G, "philip", "elisabethValois", [4, 5]); // 9
            settlePrearrangedValoisMarriage(G);

            expect(G.pendingCardDraws).toEqual([{power: "spain", turn: 2, amount: -1}]);
        });

        it("charges the penalty only once", () => {
            const G = game();
            G.year = 1;
            settlePrearrangedValoisMarriage(G);
            settlePrearrangedValoisMarriage(G);
            expect(G.pendingCardDraws).toHaveLength(1);
        });

        it("does not exist outside the Campaign scenario", () => {
            const tournament = setupGame(context([], "action") as Ctx, {scenario: "tournament"});
            expect(tournament.prearrangedValoisMarriage).toBeUndefined();
        });
    });

    describe("William of Orange", () => {
        it("is removed from the game on a Husband Murdered result", () => {
            const G = game();
            pair(G, "williamOrange", "protestant", "f24", "england");

            marry(G, "williamOrange", "f24", [3, 3]); // 6: the husband is murdered.

            const william = royal(G, "williamOrange");
            expect(william.alive).toBe(false);
            expect(william.status).toBe("dead");
            expect(G.log.join("\n")).toContain("Rumors of Murder");
        });

        it("returns to the pool after a non-VP result", () => {
            const G = game();
            G.year = 2;
            pair(G, "williamOrange", "protestant", "f25", "england");

            marry(G, "williamOrange", "f25", [4, 4]); // 8: no VP.

            const william = royal(G, "williamOrange");
            expect(william.alive).toBe(true);
            expect(william.married).toBe(false);
            expect(william.eligibility).toBe(2);
        });
    });

    describe("Victory points still land", () => {
        it("awards the Valois VP and the wedding VP together", () => {
            const G = game();
            pair(G, "m26", "spain", "elisabethValois", "france", "valois");
            royal(G, "m26").eligibility = 3;
            royal(G, "elisabethValois").eligibility = 2;
            const france = G.powers.france.bonusVp;
            const spain = G.powers.spain.bonusVp;

            marry(G, "m26", "elisabethValois", [6, 6]); // 6+6+3+2 = 17

            // Wedding VP (+2) and the Valois marriage bonus (+1) both apply.
            expect(G.powers.france.bonusVp).toBe(france + 3);
            expect(G.powers.spain.bonusVp).toBe(spain + 2);
        });
    });
});

describe("Mary Queen of Scots immediate resolution via the negotiation table", () => {
    it("never leaves a Mary betrothal for the Marriage Resolution Phase", () => {
        const G = game();
        G.year = 2;
        G.royals = G.royals.filter((entry) => entry.id !== "maryScots");
        G.royals.push({id: "maryScots", name: "maryScots", power: "france", gender: "female", eligibility: 3,
            alive: true, married: false, status: "available"});

        resolveMarriage(G, context([6, 6]), {male: "donCarlos", female: "maryScots"});

        expect(royal(G, "maryScots").married).toBe(true);
    });
});
