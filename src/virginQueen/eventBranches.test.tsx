import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import {setupGame, setWar} from "./util";
import {Power, VQGame} from "./constant/general";
import {
    branchParamValues,
    effectiveBranchIds,
    eventBranchChoice,
    eventBranchTarget,
} from "./eventBranches";
import {EventBranchPanel} from "./components/board/EventBranchPanel";
import {WORLD_SETTLEMENTS} from "./data/world";
import {playCard} from "./moves";

const context = (playerID = "0"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

const hand = (G: VQGame, power: Power, cardId: string): void => {
    G.powers[power].cards = [cardId];
};

describe("event branch metadata", () => {
    it("offers every printed Papal Bull branch and a skip", () => {
        const G = game();
        G.powers.spain.alliedMinors.push("papacy");
        G.minorDiplomacyResolved = G.minorDiplomacyResolved.filter((id) => id !== "papacy");
        const choice = eventBranchChoice(G, "vq-005", "spain", 6);
        expect(choice?.branches.map((entry) => entry.id)).toEqual(expect.arrayContaining([
            "skip", "france", "netherlands",
        ]));
        expect(choice?.mode).toBe("single");
    });

    it("marks Grand Tour as a two-effect choice and defaults to two branches", () => {
        const G = game();
        G.powers.france.wars = ["spain"];
        G.powers.france.cards = ["vq-053", "vq-020"];
        G.discard = ["vq-063"];
        const choice = eventBranchChoice(G, "vq-053", "france", 6);
        expect(choice?.mode).toBe("two");
        expect(choice?.branches.map((entry) => entry.id)).toEqual(expect.arrayContaining([
            "peace", "retrieve", "give", "move",
        ]));
        expect(effectiveBranchIds(choice!, [])).toHaveLength(2);
        expect(effectiveBranchIds(choice!, ["peace"])).toEqual(["peace"]);
    });

    it("resolves dependent commander options from the chosen target power", () => {
        const G = game();
        G.powers.spain.leaders = ["alba"];
        G.leaders.alba = {id: "alba", location: "brussels"};
        const choice = eventBranchChoice(G, "vq-030", "france", 6);
        const ret = choice?.branches.find((entry) => entry.id === "return");
        expect(ret).toBeDefined();
        const power = ret!.params.find((entry) => entry.id === "power")!;
        const powerValues = branchParamValues(ret!, {power: "spain"});
        expect(power.options({}).map((entry) => entry.value)).toContain("spain");
        expect(powerValues.power).toBeDefined();
        const leader = ret!.params.find((entry) => entry.id === "leader")!;
        expect(leader.options({power: "spain"}).map((entry) => entry.value)).toContain("alba");
    });

    it("joins the two Grand Tour choices with the pipe grammar", () => {
        const G = game();
        G.powers.france.wars = ["spain"];
        G.discard = ["vq-063"];
        const choice = eventBranchChoice(G, "vq-053", "france", 6)!;
        const peace = choice.branches.find((entry) => entry.id === "peace")!;
        const retrieve = choice.branches.find((entry) => entry.id === "retrieve")!;
        expect(eventBranchTarget([peace, retrieve], {
            peace: branchParamValues(peace, {power: "spain"}),
            retrieve: {},
        })).toBe("peace:spain|retrieve");
    });
});

describe("event branches in the card drawer", () => {
    it("renders the Grand Vizier branch buttons", () => {
        const G = game();
        G.powers.ottoman.cards = ["vq-001"];
        const choice = eventBranchChoice(G, "vq-001", "ottoman", 6)!;
        const html = renderToStaticMarkup(<EventBranchPanel choice={choice} selected={[]} params={{}}
            onSelect={() => undefined} onParam={() => undefined}/>);
        expect(html).toContain("招募 4 个单位");
        expect(html).toContain("苏伊士运河检定");
    });

    it("renders both choices of a two-effect card", () => {
        const G = game();
        G.powers.france.wars = ["spain"];
        G.discard = ["vq-063"];
        const choice = eventBranchChoice(G, "vq-053", "france", 6)!;
        const html = renderToStaticMarkup(<EventBranchPanel choice={choice} selected={["retrieve"]} params={{}}
            onSelect={() => undefined} onParam={() => undefined}/>);
        expect(html).toContain("选择 2 项效果");
        expect(html).toContain("取回诺查丹玛斯");
        expect(html).toContain("与一个主要势力停战");
    });
});

describe("event branch engine support", () => {
    it("lets the Papal ally choose to do nothing (#5)", () => {
        const G = game();
        G.powers.spain.alliedMinors.push("papacy");
        G.minorDiplomacyResolved = G.minorDiplomacyResolved.filter((id) => id !== "papacy");
        hand(G, "spain", "vq-005");
        G.elizabethExcommunicated = false;
        expect(playCard(G, context("1"), {cardId: "vq-005", asEvent: true, target: "skip"})).toBeUndefined();
        expect(G.elizabethExcommunicated).toBe(false);
        expect(G.minorDiplomacyResolved).toContain("papacy");
    });

    it("resolves two chosen Grand Tour effects (#53)", () => {
        const G = game();
        G.activePower = "france";
        G.powers.france.cards = ["vq-053"];
        G.discard = ["vq-063"];
        setWar(G, "france", "spain");
        const regulars = G.spaces.paris.land.france?.regular ?? 0;
        expect(playCard(G, context("3"), {cardId: "vq-053", asEvent: true, target: "peace:spain|retrieve"})).toBeUndefined();
        expect(G.powers.france.wars).not.toContain("spain");
        expect(G.powers.france.cards).toContain("vq-063");
        expect(G.spaces.paris.land.france?.regular ?? 0).toBe(regulars);
    });

    it("places the Armada in the chosen port (#99)", () => {
        const G = game();
        G.activePower = "spain";
        G.powers.spain.cards = ["vq-099"];
        delete G.armada;
        G.spaces.corunna.control = "spain";
        expect(playCard(G, context("1"), {cardId: "vq-099", asEvent: true, target: "deploy:corunna"})).toBeUndefined();
        expect(G.armada?.location).toBe("corunna");
    });

    it("lets the Protestant choose unrest instead of a card (#65)", () => {
        const G = game();
        G.activePower = "spain";
        G.powers.spain.cards = ["vq-065"];
        G.powers.england.cards = ["vq-020"];
        expect(playCard(G, context("1"), {cardId: "vq-065", asEvent: true, target: "unrest"})).toBeUndefined();
        expect(G.powers.england.cards).toContain("vq-020");
        expect(Object.values(G.spaces).some((space) => space.unrest)).toBe(true);
    });

    it("honours the explicit Gouvernante branch when both conditions are legal (#33)", () => {
        const G = game();
        G.activePower = "france";
        G.powers.france.cards = ["vq-033"];
        setWar(G, "france", "protestant");
        const male = {id: "vq-test-henry", name: "henry", power: "france" as Power, gender: "male" as const, eligibility: 0, alive: true, married: false, status: "available" as const};
        const female = {id: "vq-test-elizabeth", name: "elizabeth", power: "england" as Power, gender: "female" as const, eligibility: 0, alive: true, married: false, status: "available" as const};
        G.royals = G.royals.filter((royal) => royal.id !== male.id && royal.id !== female.id);
        G.royals.push(male, female);
        G.betrothals = [{male: male.id, female: female.id}];
        expect(playCard(G, context("3"), {cardId: "vq-033", asEvent: true, target: "festivity"})).toBeUndefined();
        expect(G.marriageFestivities).toBe("france");
    });


    it("places a Cipher Key on the chosen power (#91)", () => {
        const G = game();
        G.year = 3;
        G.activePower = "spain";
        G.powers.spain.cards = ["vq-091"];
        expect(playCard(G, context("1"), {cardId: "vq-091", asEvent: true, target: "france"})).toBeUndefined();
        expect(G.espionage?.cipherKeys.spain).toBe("france");
    });

    it("uses the Portugal influence branch when not allied (#105)", () => {
        const G = game();
        G.activePower = "spain";
        G.powers.spain.cards = ["vq-105"];
        G.minorDiplomacyResolved = G.minorDiplomacyResolved.filter((id) => id !== "portugal");
        G.minorInfluenceDefaults.spain.portugal = 0;
        const before = G.powers.spain.influence.portugal ?? 0;
        expect(playCard(G, context("1"), {cardId: "vq-105", asEvent: true, target: "influence"})).toBeUndefined();
        expect(G.powers.spain.influence.portugal ?? 0).toBeGreaterThan(before);
    });

    it("fortifies the chosen settlement (#61)", () => {
        const G = game();
        G.activePower = "spain";
        G.powers.spain.cards = ["vq-061"];
        const settlement = WORLD_SETTLEMENTS.find((entry) => G.worldControls[entry.id] === "spain" && G.worldFortresses?.[entry.id] === undefined)
            ?? WORLD_SETTLEMENTS[0];
        G.worldControls[settlement.id] = "spain";
        G.worldFortresses = {...(G.worldFortresses ?? {})};
        delete G.worldFortresses[settlement.id];
        expect(playCard(G, context("1"), {cardId: "vq-061", asEvent: true, target: `fortress:${settlement.id}`})).toBeUndefined();
        expect(G.worldFortresses?.[settlement.id]).toBe("spain");
    });

    it("opens the Grand Vizier recruit stage directly from the drawer (#1)", () => {
        const G = game();
        G.powers.ottoman.cards = ["vq-001"];
        expect(playCard(G, context("0"), {cardId: "vq-001", asEvent: true, target: "recruit"})).toBeUndefined();
        expect(G.pendingCardEvent?.step).toBe("recruit");
    });
});
