import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {Local} from "boardgame.io/multiplayer";
import {INVALID_MOVE} from "boardgame.io/core";
import {POWERS, Power, VQGame} from "./constant/general";
import {assassinationResult, catholicRebellionResult} from "./data/espionage";
import {assassinationTargets, beginEspionageEvent, canPlayEspionageEvent, canPlayNorthernRising, chooseEspionage, massacreConversionTargets, doubleAgentTargets, espionageDice, espionageOptions, northernConversionTargets, northernUnrestTargets, refreshJesuits} from "./espionage";
import {assassinate, endImpulse, englishCatholicRebellion, gainIntelligence, plantInformant, playCard} from "./moves";
import {ownerOf} from "./ownership";
import {arriveLeaders, atWar, checkImmediateVictory, dealYear, drawCount, resolveConversions, setWar, setupGame, winter} from "./util";
import {VirginQueenGameDef} from "./game";
import {LAND_NEIGHBORS, SPACE_BY_ID, SPACES} from "./mapData";

const context = (p: Power = "spain", values: number[] = [], fallback = 1): Ctx => ({
    currentPlayer: String(POWERS.indexOf(p)), playerID: String(POWERS.indexOf(p)), phase: "action", numPlayers: 6,
    random: {Die: () => values.shift() ?? fallback, Shuffle: (a: unknown[]) => a},
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), endTurn: jest.fn()},
} as unknown as Ctx);
const game = (): VQGame => {
    const G = setupGame(context());
    G.year = 3; G.impulse = 10; G.activePower = "spain";
    for (const p of POWERS) {G.powers[p].cards = []; G.powers[p].treasures = []; G.powers[p].cp = 20;}
    return G;
};
const options = (G: VQGame) => espionageOptions(G).map((o) => o.id);
const choose = (G: VQGame, choice: string, ctx = context()) => chooseEspionage(G,
    {...ctx, playerID: ownerOf(G, G.pendingEspionage?.responding ?? "spain")}, {choice});
const rolls = (a: number, d: number, attack: number, defense: number) => [
    ...Array(a).fill(6), ...Array(attack - a).fill(1), ...Array(d).fill(6), ...Array(defense - d).fill(1),
];
const rebel = (G: VQGame, a: number, d: number, extra: number[] = []) => {
    const ctx = context("spain", [...rolls(a, d, 6, 5), ...extra]);
    englishCatholicRebellion(G, ctx, {cp: 3});
    return ctx;
};

describe("official Espionage Table", () => {
    it.each([-3, -2, -1, 0, 1, 2, 3, 4, 5])("assassination thresholds at hit difference %i", (difference) => {
        expect(assassinationResult(difference, 2)).toEqual({killed: difference >= 3, discard: difference >= 2,
            reroll: difference === 1, neutralize: difference === 0, defensiveActions: difference <= -2 ? 3 : difference === -1 ? 2 : 0});
    });
    it.each([[5, "victory"], [4, "victory"], [3, "conversionsAndRebellion"], [2, "conversions"],
        [1, "inspectEngland"], [0, "loseOperatives"], [-1, "inspectSpain"], [-2, "minusCard"], [-4, "minusCard"]])(
        "rebellion hit difference %s gives %s", (difference, outcome) => expect(catholicRebellionResult(Number(difference))).toBe(outcome));

    it("stacks only the attacker's older informant and does not stack Cipher Key with Cryptography", () => {
        const G = game();
        G.informants = [
            {owner: "spain", target: "england", neutralized: false, plantedImpulse: 9},
            {owner: "france", target: "england", neutralized: false, plantedImpulse: 8},
        ];
        G.powers.spain.scienceBonuses = ["cryptography"];
        G.espionage!.cipherKeys.spain = "england";
        const p = {kind: "assassination", power: "spain", targetPower: "england", target: "elizabeth", cp: 4} as any;
        expect(espionageDice(G, p)).toEqual({attack: 8, defense: 4});
        G.informants[0].plantedImpulse = 10;
        expect(espionageDice(G, p).attack).toBe(6);
        G.informants[0].plantedImpulse = 9; G.informants[0].neutralized = true;
        expect(espionageDice(G, p).attack).toBe(6);
    });
    it("adds home control and battle rating to a leader's defense; no defensive informant bonus", () => {
        const G = game();
        G.leaders.leicester = {id: "leicester", location: "london"};
        G.spaces.london.leaders.push("leicester");
        G.powers.england.scienceBonuses = ["cryptography"];
        G.informants.push({owner: "england", target: "spain", neutralized: false, plantedImpulse: 1});
        const p = {kind: "assassination", power: "spain", targetPower: "england", target: "leicester", cp: 2} as any;
        expect(espionageDice(G, p)).toEqual({attack: 2, defense: 4});
        G.spaces.london.control = "france";
        expect(espionageDice(G, p).defense).toBe(3);
    });
    it("adds each Jesuit and the presence bonuses once, irrespective of regular count", () => {
        const G = game(); G.espionage!.jesuits = ["york", "london"];
        G.spaces.edinburgh.land.spain = {regular: 5, merc: 0, cav: 0};
        G.spaces.london.land.spain = {regular: 3, merc: 0, cav: 0};
        const p = {kind: "rebellion", power: "spain", targetPower: "england", cp: 3} as any;
        expect(espionageDice(G, p)).toEqual({attack: 14, defense: 5});
    });
});

describe("operative lifecycle and legal moves", () => {
    it("allows different powers to spy on the same target and allows moving a non-neutralized informant", () => {
        const G = game();
        plantInformant(G, context(), {target: "france"});
        expect(plantInformant(G, context("england"), {target: "france"})).toBeUndefined();
        plantInformant(G, context(), {target: "england"});
        const before = JSON.stringify(G);
        expect(plantInformant(G, context(), {target: "hre"})).toBe(INVALID_MOVE);
        expect(JSON.stringify(G)).toBe(before);
        expect(plantInformant(G, context(), {target: "hre", fromTarget: "france"})).toBeUndefined();
        expect(G.informants.find((i) => i.owner === "spain" && i.target === "hre")?.plantedImpulse).toBe(10);
        G.informants.find((i) => i.owner === "spain" && i.target === "hre")!.neutralized = true;
        const saved = JSON.stringify(G);
        expect(plantInformant(G, context(), {target: "hre"})).toBe(INVALID_MOVE);
        expect(plantInformant(G, context(), {target: "france", fromTarget: "hre"})).toBe(INVALID_MOVE);
        expect(JSON.stringify(G)).toBe(saved);
    });
    it.each(["bad", "spain"])("rejects illegal intelligence targets %s without spending CP", (target) => {
        const G = game(), before = JSON.stringify(G);
        expect(gainIntelligence(G, context(), {target: target as Power})).toBe(INVALID_MOVE);
        expect(JSON.stringify(G)).toBe(before);
    });
    it("gates the year, tutorial, activated powers and invalid numeric costs", () => {
        const G = game(); G.year = 2;
        expect(englishCatholicRebellion(G, context(), {cp: 3})).toBe(INVALID_MOVE);
        expect(plantInformant(G, context(), {target: "england"})).toBe(INVALID_MOVE);
        G.year = 3;
        for (const cp of [NaN, Infinity, -1, 2, 3.5, 6]) {
            const before = JSON.stringify(G);
            expect(englishCatholicRebellion(G, context(), {cp})).toBe(INVALID_MOVE);
            expect(JSON.stringify(G)).toBe(before);
        }
        G.scenario = "tutorial";
        expect(gainIntelligence(G, context(), {target: "england"})).toBe(INVALID_MOVE);
        G.scenario = "campaign"; G.playerPowers = {"0": ["spain", "france"], "1": ["england", "protestant"]};
        G.activePower = "hre";
        expect(gainIntelligence(G, context(), {target: "england"})).toBe(INVALID_MOVE);
        G.activePower = "spain";
        expect(assassinate(G, context(), {target: "schwendi", cp: 2})).toBe(INVALID_MOVE);
    });
    it("shares Spain's assassination marker, resets it in winter, and forbids rebellion while allied", () => {
        const G = game(); G.powers.spain.allies.push("england");
        const before = JSON.stringify(G);
        expect(englishCatholicRebellion(G, context(), {cp: 3})).toBe(INVALID_MOVE);
        expect(JSON.stringify(G)).toBe(before);
        G.powers.spain.allies = [];
        rebel(G, 0, 0);
        expect(G.assassinationUsed).toContain("spain");
        expect(assassinate(G, context(), {target: "elizabeth", cp: 2})).toBe(INVALID_MOVE);
        winter(G, context());
        expect(G.assassinationUsed).toEqual([]);
    });
    it("keeps Jesuits within England, charges 2 CP without immediate conversion and refills only available counters", () => {
        const G = game(); refreshJesuits(G);
        expect(G.espionage!.jesuitsOnCard).toBe(1);
        const religion = G.spaces.london.religion;
        expect(plantInformant(G, context(), {space: "paris"})).toBe(INVALID_MOVE);
        expect(plantInformant(G, context("france"), {space: "london"})).toBe(INVALID_MOVE);
        expect(plantInformant(G, context(), {space: "london"})).toBeUndefined();
        expect(G.powers.spain.cp).toBe(18);
        expect(G.spaces.london.religion).toBe(religion);
        refreshJesuits(G); G.espionage!.douai = true;
        G.espionage!.jesuits = ["london", "york", "bristol", "plymouth"];
        refreshJesuits(G);
        expect(G.espionage!.jesuitsOnCard).toBe(1);
        G.espionage!.jesuits = [];
        refreshJesuits(G); expect(G.espionage!.jesuitsOnCard).toBe(2);
        refreshJesuits(G); expect(G.espionage!.jesuitsOnCard).toBe(2);
    });
    it("protects a Jesuit from minor Protestant conversions even when no Catholic regular is present", () => {
        const G = game();
        for (const s of SPACES.filter((s) => s.area === "england")) {G.spaces[s.id].religion = "protestant"; G.spaces[s.id].land = {}; G.spaces[s.id].naval = {};}
        G.spaces.york.religion = "catholic"; G.spaces.london.religion = "catholic";
        G.espionage!.jesuits = ["york", "london"];
        resolveConversions(G, context("england", [], 4), "england", "protestant", "england", 5);
        expect(G.spaces.york.religion).toBe("catholic");
        expect(G.spaces.london.religion).toBe("catholic");
    });
});

describe("intelligence results and privacy", () => {
    it("chooses distinct effects, requires a 6 for discard, never steals cards, and rejects wrong responders atomically", () => {
        let G = game(); G.powers.france.cards = ["vq-033", "vq-020", "vq-021"];
        const ctx = context("spain", [6, 5]);
        gainIntelligence(G, ctx, {target: "france"});
        expect(G.pendingEspionage?.remaining).toBe(2);
        expect(endImpulse(G, ctx)).toBe(INVALID_MOVE);
        const before = JSON.stringify(G);
        expect(chooseEspionage(G, context("france"), {choice: "inspect"})).toBe(INVALID_MOVE);
        expect(JSON.stringify(G)).toBe(before);
        choose(G, "inspect", ctx);
        expect(options(G)).not.toContain("inspect");
        G = JSON.parse(JSON.stringify(G));
        const view = VirginQueenGameDef.playerView as any;
        expect(view(G, ctx, "1").espionage.inspections[0].cards).toEqual(G.powers.france.cards);
        expect(view(G, ctx, "3").espionage.inspections).toEqual([]);
        expect(view(G, ctx, null).espionage.inspections).toEqual([]);
        expect(G.log.join(" ")).not.toContain("vq-020");
        choose(G, "discard", ctx);
        expect(G.powers.france.cards).toEqual(["vq-033", "vq-021"]);
        expect(G.powers.spain.cards).toEqual([]);
        expect(G.pendingEspionage).toBeUndefined();
    });
    it("requires three cards including Home cards, ignores treasures for the eligibility test, and uses treasure ties", () => {
        const G = game(); G.powers.france.cards = ["vq-033", "vq-020"];
        G.powers.france.treasures = [1, 2, 3];
        gainIntelligence(G, context("spain", [6, 1]), {target: "france"});
        expect(options(G)).not.toContain("discard"); choose(G, "inspect");
        G.powers.france.cards.push("vq-021");
        gainIntelligence(G, context("spain", [6, 1]), {target: "france"});
        choose(G, "discard");
        expect(G.powers.france.cards).toHaveLength(3);
        expect(G.powers.france.treasures).toEqual([2, 3]);
    });
    it("offers only inspection without a six, neutralizes the target's operative then a second on 4–6", () => {
        const G = game();
        G.informants = [{owner: "france", target: "spain", neutralized: false, plantedImpulse: 1},
            {owner: "england", target: "spain", neutralized: false, plantedImpulse: 1}];
        const ctx = context("spain", [5, 5, 4]);
        gainIntelligence(G, ctx, {target: "france"});
        expect(options(G)).not.toContain("discard"); choose(G, "neutralize", ctx);
        expect(options(G)).toEqual(["informant:france"]);
        choose(G, "informant:france", ctx);
        expect(options(G)).toContain("informant:england");
        choose(G, "informant:england", ctx);
        expect(G.informants.every((i) => i.neutralized)).toBe(true);
        expect(G.pendingEspionage?.step).toBe("offense");
        winter(G, ctx); expect(G.informants).toEqual([]);
    });
});

describe("assassination results", () => {
    it("discards at +2 but kills Elizabeth only at +3, awarding 1 VP and permanently disabling her Home card", () => {
        for (const a of [2, 3]) {
            const G = game(); G.powers.england.cards = ["vq-036", "vq-020"];
            const vp = G.powers.spain.bonusVp;
            assassinate(G, context("spain", rolls(a, 0, 5, 4)), {target: "elizabeth", cp: 4});
            expect(G.powers.england.cards).not.toContain("vq-020");
            expect(G.royals.find((r) => r.id === "elizabeth")!.alive).toBe(a === 2);
            expect(G.powers.spain.bonusVp).toBe(vp + (a === 3 ? 1 : 0));
            if (a === 3) {expect(G.removed).toContain("vq-036"); expect(G.powers.england.ruler).toBe("elizabethDead");}
        }
    });
    it("rerolls a +1 result without another CP charge or annual use", () => {
        const G = game();
        const ctx = context("spain", [...rolls(1, 0, 3, 4), ...rolls(0, 0, 3, 4)]);
        assassinate(G, ctx, {target: "elizabeth", cp: 2});
        expect(G.pendingEspionage?.step).toBe("responses");
        choose(G, "continue", ctx);
        expect(G.pendingEspionage).toBeUndefined();
        expect(G.assassinationUsed).toEqual(["spain"]); expect(G.powers.spain.cp).toBe(18);
    });
    it("neutralizes only an informant which actually provided dice on a tie", () => {
        const G = game();
        G.informants = [{owner: "spain", target: "england", plantedImpulse: 9, neutralized: false}];
        assassinate(G, context(), {target: "elizabeth", cp: 2});
        expect(G.informants[0].neutralized).toBe(true);
    });
    it("allows the defender two distinct actions on −1, with a one-time next-turn penalty", () => {
        const G = game(); G.powers.spain.cards = ["vq-003", "vq-020"];
        const base = drawCount(G, "spain");
        assassinate(G, context("spain", rolls(0, 1, 3, 4)), {target: "elizabeth", cp: 2});
        expect(G.pendingEspionage).toMatchObject({step: "defense", remaining: 2, responding: "england"});
        choose(G, "minusCard"); expect(options(G)).not.toContain("minusCard");
        choose(G, "inspect");
        expect(G.pendingEspionage).toBeUndefined();
        expect(G.espionage!.inspections[0].viewer).toBe("england");
        expect(drawCount(G, "spain")).toBe(base - 1);
        dealYear(G, context()); expect(G.espionage!.nextDraw.spain).toBeUndefined();
        expect(drawCount(G, "spain")).toBe(base);
    });
    it("does not allow naval, off-map, captured or absent army leaders to be assassinated", () => {
        const G = game();
        for (const target of ["howard", "unknown", "orange"]) expect(assassinationTargets(G, "spain")).not.toContain(target);
        G.leaders.leicester = {id: "leicester", location: "captured"};
        expect(assassinationTargets(G, "spain")).not.toContain("leicester");
        // 19.3 also excludes default army leaders, even when serving on the map.
        G.leaders.leicester = {id: "leicester", location: "london"};
        G.spaces.london.leaders.push("leicester");
        G.leaders["default-england"] = {id: "default-england", location: "london"};
        G.spaces.london.leaders.push("default-england");
        expect(assassinationTargets(G, "spain")).toContain("leicester");
        expect(assassinationTargets(G, "spain")).not.toContain("default-england");
    });
});

describe("English Catholic Rebellion results and continuation", () => {
    it("wins immediately at +4 and awards no ordinary VP", () => {
        const G = game(); const vp = G.powers.spain.bonusVp;
        rebel(G, 4, 0);
        expect(checkImmediateVictory(G)).toEqual({winner: "spain", reason: "catholicRebellion"});
        expect(G.powers.spain.bonusVp).toBe(vp);
    });
    it("ends the game without resolving Winter after the Gunpowder Plot succeeds", () => {
        const G = game();
        rebel(G, 4, 0);
        expect(G.espionage!.catholicRebellionVictory).toBe(true);
        const year = G.year;
        // boardgame.io calls the phase onEnd hook even when endIf already
        // declared the game over.  That must not resolve Winter first.
        (VirginQueenGameDef.phases!.action!.onEnd as (G: VQGame, ctx: Ctx) => void)(G, context());
        expect(G.year).toBe(year);
        expect(G.log.some((line) => line.includes("Winter ends"))).toBe(false);
        expect((VirginQueenGameDef.endIf as (G: VQGame, ctx: Ctx) => unknown)(G, context()))
            .toEqual({winner: "1", power: "spain", reason: "catholicRebellion"});
    });
    it.each([[1, 0, "spain", "england"], [0, 1, "england", "spain"]] as const)("reveals only to the correct viewer (%s,%s)", (a,d,viewer,target) => {
        const G = game(); G.powers.england.cards = ["vq-020"]; G.powers.spain.cards = ["vq-021"];
        rebel(G, a, d);
        expect(G.espionage!.inspections[0]).toMatchObject({viewer, target});
        expect(G.espionage!.inspections[0].cards).toEqual(G.powers[target].cards);
    });
    it("loses operatives on a tie or loss, applies −1 draw only at −2, and offers captured Mary's execution", () => {
        const G = game(); G.espionage!.mary = "captured";
        G.espionage!.jesuits = ["york"];
        G.informants = [{owner: "france", target: "england", plantedImpulse: 1, neutralized: false}];
        // Jesuit adds one attack die; all attack dice miss, two defense dice hit.
        englishCatholicRebellion(G, context("spain", rolls(0, 2, 7, 5)), {cp: 3});
        expect(G.espionage!.jesuits).toEqual([]); expect(G.informants[0].neutralized).toBe(true);
        expect(G.espionage!.nextDraw.spain).toBe(-1);
        expect(G.pendingEspionage?.step).toBe("mary");
        const vp = G.powers.england.bonusVp;
        choose(G, "executeMary");
        expect(G.espionage!.mary).toBe("dead"); expect(G.powers.england.bonusVp).toBe(vp - 1);
    });
    it("resolves +3 conversions, lets England assign regular/naval losses, displaces mercenaries and limits captures to four", () => {
        let G = game();
        const target = "york";
        for (const s of SPACES.filter((s) => s.area === "england")) {G.spaces[s.id].religion = "catholic"; G.spaces[s.id].land = {}; G.spaces[s.id].naval = {}; G.spaces[s.id].leaders = [];}
        G.spaces[target].land.england = {regular: 1, merc: 2, cav: 0};
        G.spaces[target].naval.england = {galley: 0, galleon: 1, racebuilt: 0, corsair: 0};
        const ctx = rebel(G, 3, 0, [1,1,1,1,1,1,6,6,1,1,1]);
        expect(G.pendingEspionage?.step).toBe("conversions"); choose(G, "conversionsDone", ctx);
        expect(options(G)).toContain("rebel:york");
        G = JSON.parse(JSON.stringify(G));
        choose(G, "rebel:york", ctx);
        expect(G.pendingEspionage).toMatchObject({step: "rebelLosses", responding: "england", remaining: 2});
        choose(G, "galleon:england", ctx); choose(G, "regular:england", ctx);
        expect(G.spaces.york.control).toBe("spain");
        expect(G.pendingEspionage).toMatchObject({step: "displace", responding: "england"});
        choose(G, options(G).find((id) => id.startsWith("displace:"))!, ctx);
        expect(G.spaces.york.land.spain?.regular).toBe(2);
        expect(G.spaces.york.land.england).toBeUndefined();
        expect(G.powers.england.wars).toContain("spain");
        const adjacent = LAND_NEIGHBORS.york.map((n) => n.id).filter((id) => SPACE_BY_ID[id].area === "england");
        G.spaces[adjacent[0]].unrest = true;
        expect(options(G)).not.toContain(`seize:${adjacent[0]}`);
        let captures = 1;
        while (options(G).some((id) => id.startsWith("seize:"))) {choose(G, options(G).find((id) => id.startsWith("seize:"))!, ctx); captures++;}
        expect(captures).toBeLessThanOrEqual(4);
        if (G.pendingEspionage) choose(G, "done", ctx);
        expect(G.pendingEspionage).toBeUndefined();
    });
    it("converts only English spaces, blocks minor conversion under Protestant units and freezes the base in the final step", () => {
        const G = game();
        for (const s of SPACES.filter((s) => s.area === "england")) G.spaces[s.id].religion = "protestant";
        G.spaces.york.religion = "catholic";
        const ctx = rebel(G, 2, 0, [6,5,4,2,2,2]);
        const opts = options(G);
        for (const id of opts.filter((s) => s.startsWith("convert:"))) expect(SPACE_BY_ID[id.split(":")[2]].area).toBe("england");
        const option = opts.find((s) => s.startsWith("convert:6:"));
        expect(option).toBeDefined(); choose(G, option!, ctx);
        expect(options(G).some((s) => s.startsWith("expand:"))).toBe(false);
    });
});

it("preserves the final Protestant space even when a Jesuit event would convert it", () => {
    const G = game();
    for (const space of SPACES.filter((s) => s.area === "england")) {
        G.spaces[space.id].religion = "catholic";
        G.spaces[space.id].land = {}; G.spaces[space.id].naval = {}; G.spaces[space.id].leaders = [];
    }
    G.spaces.york.religion = "protestant";
    beginEspionageEvent(G, context(), "spain", "englishCollegeAtDouai");
    choose(G, "place:york");
    expect(G.spaces.york.religion).toBe("protestant");
    expect(G.espionage!.jesuits).toContain("york");
    rebel(G, 2, 0);
    expect(options(G).some((id) => id.startsWith("convert:"))).toBe(false);
});

it("does not allow a killed army leader to return during Spring", () => {
    const G = game();
    G.leaders.leicester = {id: "leicester", location: "london"};
    G.spaces.london.leaders.push("leicester");
    assassinate(G, context("spain", rolls(3, 0, 4, 4)), {target: "leicester", cp: 4});
    expect(G.leaders.leicester.location).toBe("offMap");
    G.year = 4; arriveLeaders(G);
    expect(G.leaders.leicester.location).toBe("offMap");
});

it("applies Topcliffe's two chosen neutralizations, five Protestant attempts and one-time Spanish draw bonus", () => {
    const G = game(); G.espionage!.jesuits = ["york", "london"];
    const ctx = context("england", [], 5);
    beginEspionageEvent(G, ctx, "england", "richardTopcliffe");
    expect(G.pendingEspionage?.responding).toBe("england");
    choose(G, "jesuit:york", ctx); choose(G, "jesuit:london", ctx);
    expect(G.espionage!.jesuits).toEqual([]);
    expect(G.pendingEspionage?.conversionDice).toHaveLength(5);
    expect(G.pendingEspionage?.conversionSide).toBe("protestant");
    expect(G.espionage!.nextDraw.spain).toBe(1);
});

it("executes captured Mary when Elizabeth dies and keeps the rebellion bonus only for this turn", () => {
    const G = game(); G.espionage!.mary = "captured";
    const ctx = context("spain", rolls(3, 0, 5, 4));
    const vp = G.powers.england.bonusVp;
    assassinate(G, ctx, {target: "elizabeth", cp: 4});
    expect(G.espionage!.mary).toBe("dead");
    expect(G.powers.england.bonusVp).toBe(vp - 1);
    const pending = {kind: "rebellion", power: "spain", targetPower: "england", cp: 3} as any;
    expect(espionageDice(G, pending).attack).toBe(6);
    winter(G, context());
    expect(espionageDice(G, pending).attack).toBe(3);
});

describe("espionage cards", () => {
    it("handles Walsingham's offensive/defensive hit thresholds and resets his marker in winter", () => {
        const G = game(); G.powers.england.cards = ["vq-081"];
        gainIntelligence(G, context("england", [4,4]), {target: "spain"});
        choose(G, "walsingham:offensive"); choose(G, "continue", context("england", [4,4]));
        expect(G.pendingEspionage?.remaining).toBe(2); choose(G, "inspect"); choose(G, "done");
        winter(G, context()); expect(G.espionage!.walsingham).toBeUndefined();
        G.espionage!.walsingham = "defensive";
        gainIntelligence(G, context("spain", [5,5]), {target: "england"});
        expect(G.pendingEspionage).toBeUndefined();
    });
    it("plays Pistols and Mary before a roll, never twice on a reroll", () => {
        const G = game(); G.powers.france.cards = ["vq-088", "vq-089"];
        assassinate(G, context(), {target: "elizabeth", cp: 2});
        expect(G.pendingEspionage?.responding).toBe("france");
        choose(G, "pistols"); choose(G, "maryCard");
        expect(espionageDice(G, G.pendingEspionage!).attack).toBe(8);
        expect(G.discard).toEqual(expect.arrayContaining(["vq-088", "vq-089"]));
        expect(options(G)).not.toContain("pistols"); expect(options(G)).not.toContain("maryCard");
    });
    it("uses Priest Holes to prevent a selected Jesuit loss and resumes the original intelligence action", () => {
        const G = game(); G.espionage!.jesuits = ["york"]; G.powers.spain.cards = ["vq-090"];
        const ctx = context("england", [6,6,1]);
        gainIntelligence(G, ctx, {target: "spain"}); choose(G, "neutralize", ctx); choose(G, "jesuit:york", ctx);
        expect(G.pendingEspionage).toMatchObject({step: "priestHoles", responding: "spain"});
        choose(G, "priestHoles", ctx);
        expect(G.espionage!.jesuits).toEqual(["york"]);
        expect(G.pendingEspionage).toMatchObject({step: "offense", responding: "england"});
        expect(G.discard).toContain("vq-090");
    });
    it("implements Douai placement from the pool and God's Secret Agents placement/conversion plus one existing Jesuit move", () => {
        const G = game();
        const empty = SPACES.filter((s) => s.area === "england").map((s) => s.id);
        for (const id of empty) {G.spaces[id].land = {}; G.spaces[id].naval = {}; G.spaces[id].leaders = []; G.spaces[id].religion = "protestant";}
        G.powers.spain.cards = ["vq-093"];
        playCard(G, context(), {cardId: "vq-093", asEvent: true});
        expect(G.espionage!.douai).toBe(true); expect(G.removed).toContain("vq-093");
        choose(G, `place:${empty[0]}`);
        expect(G.spaces[empty[0]].religion).toBe("catholic");
        refreshJesuits(G); expect(G.espionage!.jesuitsOnCard).toBe(2);
        beginEspionageEvent(G, context(), "spain", "godsSecretAgents");
        choose(G, `place:${empty[1]}`); choose(G, `place:${empty[2]}`);
        expect(options(G)).toContain(`move:${empty[0]}`); expect(options(G)).not.toContain(`move:${empty[1]}`);
        choose(G, `move:${empty[0]}`); choose(G, `place:${empty[3]}`);
        expect(G.espionage!.jesuits).toEqual([empty[1],empty[2],empty[3]]);
        expect(G.pendingEspionage).toBeUndefined();
    });
    it("supports Cipher Key event targeting/removal without mutating on bad targets", () => {
        const G = game(); G.powers.spain.cards = ["vq-091"];
        const before = JSON.stringify(G);
        expect(playCard(G, context(), {cardId: "vq-091", asEvent: true, target: "bogus"})).toBe(INVALID_MOVE);
        expect(JSON.stringify(G)).toBe(before);
        playCard(G, context(), {cardId: "vq-091", asEvent: true, target: "england"});
        expect(G.espionage!.cipherKeys.spain).toBe("england");
        beginEspionageEvent(G, context("england"), "england", "cipherKey", "remove");
        expect(G.espionage!.cipherKeys.spain).toBeUndefined();
    });

    describe("Double Agent", () => {
        const informant = (owner: Power, target: Power, neutralized = false) => ({owner, target, neutralized, plantedImpulse: 1});

        it("removes an enemy informant on the player's card and plants one of the player's own on that enemy", () => {
            const G = game(); G.powers.spain.cards = ["vq-092"];
            G.informants = [informant("england", "spain", true)];
            expect(doubleAgentTargets(G, "spain")).toEqual(["england"]);
            playCard(G, context(), {cardId: "vq-092", asEvent: true, target: "england"});
            expect(G.informants).toEqual([{owner: "spain", target: "england", neutralized: false, plantedImpulse: 10}]);
            expect(G.pendingEspionage).toBeUndefined();
        });

        it("needs an enemy informant on the player's own card and leaves state unchanged otherwise", () => {
            const G = game(); G.powers.spain.cards = ["vq-092"];
            G.informants = [informant("england", "france"), informant("spain", "france")];
            expect(doubleAgentTargets(G, "spain")).toEqual([]);
            const before = JSON.stringify(G);
            expect(playCard(G, context(), {cardId: "vq-092", asEvent: true, target: "england"})).toBe(INVALID_MOVE);
            expect(JSON.stringify(G)).toBe(before);
            G.year = 2; G.informants = [informant("england", "spain")];
            expect(canPlayEspionageEvent(G, "spain", "doubleAgent", "england")).toBe(false);
        });

        it("moves a non-neutralized own informant when both are in use", () => {
            const G = game(); G.powers.spain.cards = ["vq-092"];
            G.informants = [informant("france", "spain"), informant("spain", "england"), informant("spain", "ottoman", true)];
            expect(doubleAgentTargets(G, "spain")).toEqual(["france>england"]);
            expect(canPlayEspionageEvent(G, "spain", "doubleAgent", "france")).toBe(false);
            playCard(G, context(), {cardId: "vq-092", asEvent: true, target: "france>england"});
            expect(G.informants).toEqual([
                {owner: "spain", target: "france", neutralized: false, plantedImpulse: 10},
                informant("spain", "ottoman", true),
            ]);
        });

        it("still removes the enemy informant when the player already spies on that enemy", () => {
            const G = game(); G.powers.spain.cards = ["vq-092"];
            G.informants = [informant("england", "spain"), informant("spain", "england", true), informant("spain", "france")];
            expect(doubleAgentTargets(G, "spain")).toEqual(["england"]);
            playCard(G, context(), {cardId: "vq-092", asEvent: true, target: "england"});
            expect(G.informants).toEqual([informant("spain", "england", true), informant("spain", "france")]);
        });
    });
});

it("switches real multiplayer response stages between England and Spain and restores the original impulse", () => {
    const spec: any = {numPlayers: 6, multiplayer: Local(), game: {...VirginQueenGameDef, seed: "espionage-stages",
        setup: () => {
            const G = game(); G.powers.england.cards = ["vq-081"]; G.powers.france.cards = ["vq-020", "vq-021", "vq-022"];
            G.powers.spain.scienceBonuses = ["cryptography"];
            G.informants.push({owner: "spain", target: "france", neutralized: false, plantedImpulse: 1});
            return G;
        },
        phases: {action: {start: true, turn: {order: {first: () => 1, next: () => 1},
            stages: {espionageChoice: {moves: {chooseEspionage}}}}}},
    }};
    const clients = POWERS.map((_, i) => {const c = Client({...spec, playerID: String(i)}) as any; c.start(); return c;});
    try {
        clients[1].moves.gainIntelligence({target: "france"});
        expect(clients[2].getState().ctx.activePlayers).toEqual({"2": "espionageChoice"});
        clients[2].moves.chooseEspionage({choice: "walsingham:defensive"});
        clients[2].moves.chooseEspionage({choice: "continue"});
        expect(clients[1].getState().ctx.activePlayers).toEqual({"1": "espionageChoice"});
        clients[1].moves.chooseEspionage({choice: "inspect"});
        for (let count = 0; clients[1].getState().G.pendingEspionage && count < 4; count++) {
            const choice = options(clients[1].getState().G)[0];
            clients[1].moves.chooseEspionage({choice});
        }
        for (const client of clients) {
            const state = client.getState(); expect(state.ctx.activePlayers).toBeNull(); expect(state.ctx.currentPlayer).toBe("1");
        }
        expect(clients[1].getState().G.espionage.inspections[0].cards).toHaveLength(3);
        expect(clients[2].getState().G.espionage.inspections).toEqual([]);
    } finally {clients.forEach((c) => c.stop());}
});

describe("#78 Northern Rising", () => {
    const nr = (): VQGame => {
        const G = game();
        G.powers.spain.cards = ["vq-078"];
        G.espionage!.mary = "captured";
        // Flip a few spaces to Protestant so there is something to convert.
        G.spaces.norwich.religion = "protestant"; G.spaces.plymouth.religion = "protestant";
        G.spaces.berwick.religion = "protestant"; G.spaces.carlisle.religion = "protestant";
        G.spaces.york.religion = "protestant";
        return G;
    };
    it("requires Mary captured and rejects when she is not", () => {
        const G = game(); G.powers.spain.cards = ["vq-078"];
        G.espionage!.mary = "scotland";
        expect(canPlayNorthernRising(G)).toBe(false);
        expect(playCard(G, context(), {cardId: "vq-078", asEvent: true})).toBe(INVALID_MOVE);
    });

    it("lets Spain convert exactly 3 regions then place 4 unrest when not at war", () => {
        const G = nr();
        playCard(G, context(), {cardId: "vq-078", asEvent: true});
        expect(G.pendingEspionage?.step).toBe("northernConvert");
        expect(G.pendingEspionage?.responding).toBe("spain");
        for (const id of ["norwich", "york", "plymouth"]) choose(G, `nconvert:${id}`);
        expect(["norwich", "york", "plymouth"].map((id) => G.spaces[id].religion)).toEqual(["catholic", "catholic", "catholic"]);
        expect(G.spaces.berwick.religion).toBe("protestant");
        expect(G.pendingEspionage?.step).toBe("northernUnrest");
        expect(G.pendingEspionage?.remaining).toBe(4);
        for (const id of northernUnrestTargets(G).slice(0, 4)) choose(G, `nunrest:${id}`);
        expect(G.pendingEspionage).toBeUndefined();
        expect(Object.values(G.spaces).filter((s) => s.unrest).length).toBe(4);
        expect(atWar(G, "spain", "england")).toBe(false);
    });

    it("excludes spaces with Protestant units and keeps the last Protestant English space", () => {
        const G = nr();
        // Normalize England so the last Protestant space is unambiguous; the
        // Campaign setup now marks London, Bristol and York Protestant.
        for (const space of SPACES.filter((def) => def.area === "england")) G.spaces[space.id].religion = "catholic";
        G.spaces.london.religion = "protestant";
        G.spaces.york.religion = "protestant";
        G.spaces.york.land.england = {regular: 1, merc: 0, cav: 0};
        expect(northernConversionTargets(G, ["london"])).not.toContain("york");
        for (const id of ["norwich", "plymouth", "berwick", "york"]) G.spaces[id].religion = "catholic";
        expect(northernConversionTargets(G, ["london"])).toEqual([]);
        // Occupied Protestant spaces are not legal unrest targets.
        G.spaces.carlisle.religion = "protestant";
        G.spaces.carlisle.land.england = {regular: 1, merc: 0, cav: 0};
        expect(northernUnrestTargets(G)).not.toContain("carlisle");
    });

    it("follows 19.4 from step 2 when at war, without using the rebellion marker", () => {
        const G = nr();
        setWar(G, "spain", "england");
        playCard(G, context(), {cardId: "vq-078", asEvent: true});
        for (const id of ["norwich", "york", "plymouth"]) choose(G, `nconvert:${id}`);
        expect(G.pendingEspionage?.step).toBe("rebelTarget");
        expect(G.assassinationUsed).not.toContain("spain");
        choose(G, "rebel:norwich");
        expect(G.spaces.norwich.control).toBe("spain");
    });

    it("goes straight to unrest when no space can be converted", () => {
        const G = nr();
        for (const space of SPACES.filter((def) => def.area === "england")) G.spaces[space.id].religion = "catholic";
        G.spaces.london.religion = "protestant";
        playCard(G, context(), {cardId: "vq-078", asEvent: true});
        expect(G.pendingEspionage?.step).toBe("northernUnrest");
    });
});

describe("#97 St. Bartholomew's Day Massacre", () => {
    const PROTESTANT = ["laRochelle", "orleans", "bourges", "lyon", "toulouse", "poitiers", "limoges", "nimes"];
    const massacre = (): VQGame => {
        const G = game(); G.activePower = "france";
        G.powers.france.cards = ["vq-097"];
        // Normalize the area first: newer setup fixes mark additional French
        // spaces Protestant (Rouen, Nantes, Amboise), which would otherwise
        // change the number of legal conversion targets mid-test.
        for (const space of SPACES.filter((def) => def.area === "france")) G.spaces[space.id].religion = "catholic";
        for (const id of PROTESTANT) G.spaces[id].religion = "protestant";
        G.spaces.lyon.land.protestant = {regular: 1, merc: 2, cav: 0};
        G.spaces.antwerp.land.protestant = {regular: 0, merc: 1, cav: 0};
        G.spaces.laRochelle.leaders.push("coligny");
        G.leaders.coligny = {id: "coligny", location: "laRochelle"};
        return G;
    };
    const fr = (values: number[] = []) => context("france", values);
    const chooseFr = (G: VQGame, choice: string, values: number[] = []) => choose(G, choice, fr(values));

    it("removes Protestant mercs in France only, gives +1 card, then converts up to 5 French-controlled spaces", () => {
        const G = massacre();
        G.spaces.nimes.control = "protestant";
        playCard(G, fr(), {cardId: "vq-097", asEvent: true});
        expect(G.spaces.lyon.land.protestant).toEqual({regular: 1, merc: 0, cav: 0});
        expect(G.spaces.antwerp.land.protestant?.merc).toBe(1);
        expect(G.espionage!.nextDraw.protestant).toBe(1);
        expect(G.pendingEspionage?.step).toBe("massacreConvert");
        expect(G.pendingEspionage?.remaining).toBe(5);
        expect(massacreConversionTargets(G)).not.toContain("nimes");
        expect(G.removed).toContain("vq-097");
        for (const id of ["laRochelle", "orleans", "bourges", "lyon", "toulouse"]) chooseFr(G, `mconvert:${id}`);
        expect(G.spaces.poitiers.religion).toBe("protestant");
        expect(G.pendingEspionage?.step).toBe("massacreAssassinate");
        expect(G.pendingEspionage?.cp).toBe(2);
    });

    it("raises the limit to 8 spaces and 4 CP when Navarre is betrothed to a French royal, keeping the last Protestant space", () => {
        const G = massacre();
        G.royals.push({id: "henryIV", name: "Henry IV", power: "protestant", gender: "male", alive: true, married: false},
            {id: "margueriteValois", name: "Marguerite", power: "france", gender: "female", alive: true, married: false});
        G.betrothals = [{male: "henryIV", female: "margueriteValois"}];
        playCard(G, fr(), {cardId: "vq-097", asEvent: true});
        expect(G.pendingEspionage?.remaining).toBe(8);
        expect(G.pendingEspionage?.cp).toBe(4);
        for (const id of PROTESTANT.slice(0, 7)) chooseFr(G, `mconvert:${id}`);
        expect(G.spaces.nimes.religion).toBe("protestant");
        expect(G.pendingEspionage?.step).toBe("massacreAssassinate");
    });

    it("runs a free assassination of Coligny that costs no CP and uses France's yearly marker", () => {
        const G = massacre();
        // An older French informant adds 2 dice: 2 CP + 2 = 4 attack dice against 1 + Coligny's battle 3 = 4 defense dice.
        G.informants = [{owner: "france", target: "protestant", neutralized: false, plantedImpulse: 1}];
        playCard(G, fr(), {cardId: "vq-097", asEvent: true});
        chooseFr(G, "massacreConvertDone");
        const cpBefore = G.powers.france.cp, vpBefore = G.powers.france.bonusVp;
        expect(espionageDice(G, {...G.pendingEspionage!, kind: "assassination", power: "france", targetPower: "protestant", target: "coligny"}))
            .toEqual({attack: 4, defense: 2});
        chooseFr(G, "massacreAssassinate", [6, 6, 6, 6, 1, 1, 1, 1]);
        expect(G.powers.france.cp).toBe(cpBefore);
        expect(G.assassinationUsed).toContain("france");
        expect(G.leaders.coligny.location).toBe("offMap");
        expect(G.spaces.laRochelle.leaders).not.toContain("coligny");
        expect(G.powers.france.bonusVp).toBe(vpBefore + 1);
        expect(G.pendingEspionage).toBeUndefined();
    });

    it("skips the assassination when France already used its attempt or Coligny is off the map", () => {
        const G = massacre();
        G.assassinationUsed = ["france"];
        playCard(G, fr(), {cardId: "vq-097", asEvent: true});
        chooseFr(G, "massacreConvertDone");
        expect(G.pendingEspionage).toBeUndefined();

        const off = massacre();
        off.spaces.laRochelle.leaders = []; off.leaders.coligny = {id: "coligny", location: "pool"};
        for (const id of PROTESTANT.slice(0, 7)) off.spaces[id].religion = "catholic";
        playCard(off, fr(), {cardId: "vq-097", asEvent: true});
        expect(off.pendingEspionage).toBeUndefined();
        expect(off.espionage!.nextDraw.protestant).toBe(1);
    });
});
