import {
    ALL_CARD_NUMBERS,
    ALL_SCENARIOS,
    CAMPAIGN,
    CAMPAIGN_REMOVED_CARDS,
    CARD_BY_ID,
    CARD_BY_NUMBER,
    OFFICIAL_CARDS,
    OFFICIAL_LAND_LINKS,
    OFFICIAL_SPACE_BY_ID,
    OFFICIAL_SPACES,
    PATRON_BY_ID,
    ROYAL_BY_ID,
    SCIENCE_BONUS_BY_ID,
    TOURNAMENT,
    TOURNAMENT_REMOVED_CARDS,
    WORLD_SETTLEMENT_BY_ID,
    WORLD_SEA_ZONE_BY_ID,
    WORLD_SEA_ZONES,
    cpCoverage,
    leaderOrThrow,
    officialSpace,
    patronOrThrow,
    scenarioById,
    scienceBonusOrThrow,
    seaCaptainById,
} from "./index";
import {Controller, MINOR_POWERS, POWERS, SeaZoneID} from "../constant/general";
import {SEA_ZONE_BY_ID} from "../constant/spaces";

const controllers: Controller[] = [...POWERS, ...MINOR_POWERS, "independent"];

const stackTotal = (stack: object): number =>
    Object.values(stack).reduce(
        (sum: number, n) => sum + (typeof n === "number" ? n : 0),
        0,
    );

describe("Virgin Queen official data - cards", () => {
    it("contains all 112 unique card numbers and ids", () => {
        expect(OFFICIAL_CARDS).toHaveLength(112);
        expect(new Set(OFFICIAL_CARDS.map((c) => c.number)).size).toBe(112);
        expect(new Set(OFFICIAL_CARDS.map((c) => c.id)).size).toBe(112);
        expect(ALL_CARD_NUMBERS).toEqual(Array.from({length: 112}, (_, i) => i + 1));
        for (const card of OFFICIAL_CARDS) {
            expect(card.id).toBe(`vq-${String(card.number).padStart(3, "0")}`);
            expect(CARD_BY_NUMBER[card.number]).toBe(card);
            expect(CARD_BY_ID[card.id]).toBe(card);
        }
    });

    it("has exactly the twelve official family/home cards", () => {
        const home = OFFICIAL_CARDS.filter((c) => c.kind === "home");
        expect(home.map((c) => c.number)).toEqual([
            1, 2, 3, 32, 33, 34, 35, 36, 80, 81, 99, 111,
        ]);
        expect(home.map((c) => c.power)).toEqual([
            "ottoman",
            "ottoman",
            "spain",
            "protestant",
            "france",
            "hre",
            "hre",
            "england",
            "france",
            "england",
            "spain",
            "protestant",
        ]);
        expect(CARD_BY_NUMBER[54].kind).toBe("event");
    });

    it("records a command-point value for every card", () => {
        const coverage = cpCoverage();
        expect(coverage).toEqual({
            total: 112,
            known: 112,
            missing: 0,
            missingNumbers: [],
        });
        for (const card of OFFICIAL_CARDS) {
            expect(card.cp).not.toBeNull();
            expect(card.cpSource).toBe("pdf-text-layer");
        }
        expect(CARD_BY_NUMBER[1].cp).toBe(5);
        expect(CARD_BY_NUMBER[7].cp).toBe(1);
        expect(CARD_BY_NUMBER[17].cp).toBe(4);
        expect(CARD_BY_NUMBER[54].cp).toBe(3);
        expect(CARD_BY_NUMBER[99].cp).toBe(5);
        expect(CARD_BY_NUMBER[111].cp).toBe(5);
        expect(CARD_BY_NUMBER[112].cp).toBe(4);
    });

    it("records the official first-turn availability", () => {
        for (const card of OFFICIAL_CARDS) {
            expect(card.availableFromTurn).not.toBeNull();
            expect(card.turnSource).toBe("pdf-text-layer");
        }
        for (const n of [1, 73]) {
            expect(CARD_BY_NUMBER[n].availableFromTurn).toBe(1);
        }
        for (const n of [74, 79]) {
            expect(CARD_BY_NUMBER[n].availableFromTurn).toBe(2);
        }
        for (const n of [80, 98]) {
            expect(CARD_BY_NUMBER[n].availableFromTurn).toBe(3);
        }
        for (const n of [99, 110]) {
            expect(CARD_BY_NUMBER[n].availableFromTurn).toBe(4);
        }
        expect(CARD_BY_NUMBER[111].availableFromTurn).toBe("variable");
        expect(CARD_BY_NUMBER[112].availableFromTurn).toBe("variable");
    });

    it("uses the official printed card categories", () => {
        expect(CARD_BY_NUMBER[4].kind).toBe("mandatory");
        expect(CARD_BY_NUMBER[7].kind).toBe("combat");
        expect(CARD_BY_NUMBER[11].kind).toBe("response");
        expect(CARD_BY_NUMBER[17].kind).toBe("event");
        expect(CARD_BY_NUMBER[39].kind).toBe("combat");
        expect(CARD_BY_NUMBER[110].kind).toBe("event");
        expect(CARD_BY_NUMBER[111].kind).toBe("home");
    });

    it("preserves Chinese names/effects without layout line breaks", () => {
        for (const card of OFFICIAL_CARDS) {
            expect(card.nameZh.length).toBeGreaterThan(0);
            expect(card.textZh.length).toBeGreaterThan(0);
            expect(card.textZh).not.toContain("\n");
            expect(card.source).toBe("中文卡表.pdf");
        }
        expect(CARD_BY_NUMBER[4].nameZh).toBe("日耳曼干涉");
        expect(CARD_BY_NUMBER[11].nameZh).toBe("德拉加特戰死");
        expect(CARD_BY_NUMBER[58].nameZh).toBe("納瓦拉的珍妮");
        expect(CARD_BY_NUMBER[59].nameZh).toBe("約翰．霍金斯");
        expect(CARD_BY_NUMBER[112].nameZh).toBe("街壘日†");
    });

    it("makes every complex effect explicit instead of silently faking it", () => {
        for (const card of OFFICIAL_CARDS) {
            expect(card.effect).toBeDefined();
            if (card.effect.kind === "manual") {
                expect(card.effect.handler).toMatch(/^[a-z][A-Za-z0-9]*$/);
            }
            if (card.effect.kind === "conversion") {
                expect(card.effect.dice).toBeGreaterThan(0);
                expect(card.effect.areas.length).toBeGreaterThan(0);
            }
        }
        expect(CARD_BY_NUMBER[54].effect).toMatchObject({
            kind: "conversion",
            side: "protestant",
            dice: 8,
            autoSix: true,
        });
        expect(CARD_BY_NUMBER[7].effect).toMatchObject({kind: "combat"});
    });

    it("marks cards that leave play", () => {
        for (const n of [49, 50, 63, 67, 79, 82, 86, 93, 95, 97, 109, 111, 112]) {
            expect(CARD_BY_NUMBER[n].removeOnEvent).toBe(true);
        }
        expect(CARD_BY_NUMBER[58].removeAfterUse).toBe(true);
        expect(CARD_BY_NUMBER[28].removeCondition).toContain("Morisco");
        expect(CARD_BY_NUMBER[11].removeCondition).toContain("Dragut");
    });
});

describe("Virgin Queen official data - deck composition", () => {
    const checkScenario = (scenario: typeof CAMPAIGN | typeof TOURNAMENT, removed: readonly number[]) => {
        const inPlay = scenario.cardsInPlay;
        expect(new Set(inPlay).size).toBe(inPlay.length);
        expect(new Set(scenario.cardsRemoved).size).toBe(scenario.cardsRemoved.length);
        expect([...inPlay].sort((a, b) => a - b)).toEqual(
            ALL_CARD_NUMBERS.filter((n) => !removed.includes(n)),
        );
        expect(inPlay.length + scenario.cardsRemoved.length).toBe(112);
        for (const n of scenario.cardsRemoved) {
            expect(inPlay).not.toContain(n);
        }
        for (const n of scenario.cardsOnBoard) {
            expect(inPlay).toContain(n);
        }
    };

    it("partitions the deck correctly for the Campaign", () => {
        expect(CAMPAIGN_REMOVED_CARDS).toEqual([4, 37]);
        checkScenario(CAMPAIGN, CAMPAIGN_REMOVED_CARDS);
        expect(CAMPAIGN.cardsInPlay).toHaveLength(110);
    });

    it("partitions the deck correctly for the Tournament", () => {
        expect(TOURNAMENT_REMOVED_CARDS).toEqual([4, 11, 37, 58]);
        checkScenario(TOURNAMENT, TOURNAMENT_REMOVED_CARDS);
        expect(TOURNAMENT.cardsInPlay).toHaveLength(108);
        expect(TOURNAMENT.cardsOnBoard).toEqual([28]);
    });

    it("exposes both scenarios through the lookup helpers", () => {
        expect(scenarioById("campaign")).toBe(CAMPAIGN);
        expect(scenarioById("tournament")).toBe(TOURNAMENT);
        expect(ALL_SCENARIOS.map((s) => s.id)).toEqual(["campaign", "tournament"]);
    });
});

describe("Virgin Queen official data - map catalogue", () => {
    it("has unique spaces and valid land links", () => {
        expect(new Set(OFFICIAL_SPACES.map((s) => s.id)).size).toBe(OFFICIAL_SPACES.length);
        for (const link of OFFICIAL_LAND_LINKS) {
            expect(link.a).not.toBe(link.b);
            expect(officialSpace(link.a)).toBeDefined();
            expect(officialSpace(link.b)).toBeDefined();
        }
    });

    it("does not duplicate undirected land links or port entries", () => {
        const seenLinks = new Set<string>();
        for (const link of OFFICIAL_LAND_LINKS) {
            const key = [link.a, link.b].sort().join("|");
            expect(seenLinks.has(key)).toBe(false);
            seenLinks.add(key);
        }
        for (const s of OFFICIAL_SPACES) {
            for (const z of s.ports ?? []) {
                expect(z in SEA_ZONE_BY_ID).toBe(true);
                expect(OFFICIAL_SPACE_BY_ID[s.id]).toBeDefined();
            }
        }
        expect(Object.keys(SEA_ZONE_BY_ID).length).toBeGreaterThan(0);
        const allPorts = new Set<string>();
        for (const s of OFFICIAL_SPACES) {
            for (const z of s.ports ?? []) {
                allPorts.add(z as SeaZoneID);
            }
        }
        expect(allPorts.size).toBeGreaterThan(0);
    });

    it("keeps the official Cyprus id and drops the runtime Nicosia id", () => {
        expect(OFFICIAL_SPACE_BY_ID.cyprus).toBeDefined();
        expect(OFFICIAL_SPACE_BY_ID.nicosia).toBeUndefined();
        expect(() => officialSpace("nicosia")).not.toThrow();
    });

    it("places every scenario space, unit, leader, captain and patron on a known record", () => {
        for (const scenario of ALL_SCENARIOS) {
            for (const [id, setup] of Object.entries(scenario.spaces)) {
                expect(OFFICIAL_SPACE_BY_ID[id]).toBeDefined();
                if (setup.control !== undefined) {
                    expect(controllers).toContain(setup.control);
                }
                if (setup.controlMarker !== undefined) {
                    expect(setup.control).toBeDefined();
                    expect(["scm", "hcm"]).toContain(setup.controlMarker);
                }
                for (const owner of Object.keys(setup.units ?? {})) {
                    expect(controllers).toContain(owner);
                    const stack = setup.units![owner as Controller]!;
                    expect(stackTotal(stack)).toBeGreaterThan(0);
                }
                for (const owner of Object.keys(setup.naval ?? {})) {
                    expect(controllers).toContain(owner);
                    const stack = setup.naval![owner as Controller]!;
                    expect(stackTotal(stack)).toBeGreaterThan(0);
                }
                for (const leader of setup.leaders ?? []) {
                    expect(() => leaderOrThrow(leader)).not.toThrow();
                }
            }
            for (const [id, setup] of Object.entries(scenario.worldSpaces ?? {})) {
                expect(WORLD_SETTLEMENT_BY_ID[id]).toBeDefined();
                if (setup.controlMarker !== undefined) {
                    expect(["scm", "hcm"]).toContain(setup.controlMarker);
                }
            }
            for (const captainIds of [
                ...Object.values(scenario.powerCard).flatMap((p) => [
                    ...(p.seaCaptains ?? []),
                    ...(p.sharedSeaCaptains ?? []),
                    ...(p.components ? Object.values(p.components).flatMap((c) => c.seaCaptains ?? []) : []),
                ]),
            ]) {
                expect(() => seaCaptainById(captainIds)).not.toThrow();
            }
            for (const powerCard of Object.values(scenario.powerCard)) {
                const cards = [powerCard, ...(powerCard.components ? Object.values(powerCard.components) : [])];
                for (const card of cards) {
                    for (const leader of card.leadersOffMap ?? []) {
                        expect(() => leaderOrThrow(leader)).not.toThrow();
                    }
                }
            }
            for (const id of scenario.patronage.artists) {
                expect(() => patronOrThrow(id)).not.toThrow();
                expect(patronOrThrow(id).kind).toBe("artist");
            }
            for (const id of scenario.patronage.scientists) {
                expect(() => patronOrThrow(id)).not.toThrow();
                expect(patronOrThrow(id).kind).toBe("scientist");
            }
            for (const id of scenario.patronage.scienceBonuses) {
                expect(() => scienceBonusOrThrow(id)).not.toThrow();
            }
        }
    });

    it("has a complete patronage catalogue and royal catalogue", () => {
        expect(Object.keys(PATRON_BY_ID).length).toBeGreaterThanOrEqual(20);
        expect(Object.keys(ROYAL_BY_ID).length).toBeGreaterThanOrEqual(20);
        expect(Object.keys(SCIENCE_BONUS_BY_ID)).toHaveLength(9);
        expect(Object.keys(WORLD_SEA_ZONE_BY_ID).length).toBe(9);
        expect(WORLD_SETTLEMENT_BY_ID.florida).toBeDefined();
        expect(WORLD_SETTLEMENT_BY_ID.philippines).toBeDefined();
    });

    it("keeps World Map sea-zone adjacency symmetric", () => {
        for (const zone of WORLD_SEA_ZONES) {
            for (const adjacent of zone.adjacent) {
                expect(WORLD_SEA_ZONE_BY_ID[adjacent]).toBeDefined();
                expect(WORLD_SEA_ZONE_BY_ID[adjacent].adjacent).toContain(zone.id);
            }
        }
    });
});

describe("Virgin Queen official data - scenario values", () => {
    it("tracks the exact campaign and tournament VP starts", () => {
        expect(CAMPAIGN.vpStart).toEqual({
            ottoman: 11,
            spain: 17,
            england: 6,
            france: 9,
            hre: 8,
            protestant: 1,
        });
        expect(TOURNAMENT.vpStart).toEqual({
            ottoman: 14,
            spain: 15,
            england: 11,
            france: 10,
            hre: 8,
            protestant: 10,
        });
    });

    it("sets the correct Protestant Spaces totals", () => {
        expect(CAMPAIGN.protestantSpaces).toBe(18);
        expect(TOURNAMENT.protestantSpaces).toBe(30);
    });

    it("keeps war and alliance declarations symmetric and scenario-specific", () => {
        expect(CAMPAIGN.wars).toEqual([
            ["ottoman", "spain"],
            ["england", "france"],
        ]);
        expect(TOURNAMENT.wars).toEqual([
            ["ottoman", "spain"],
            ["france", "protestant"],
        ]);
        expect(CAMPAIGN.alliances).toEqual([
            ["spain", "papacy"],
            ["france", "scotland"],
        ]);
        expect(TOURNAMENT.alliances).toEqual([
            ["spain", "papacy"],
            ["spain", "venice"],
        ]);
        for (const scenario of ALL_SCENARIOS) {
            const pairs = new Set<string>();
            for (const [a, b] of scenario.wars) {
                expect(POWERS).toContain(a);
                expect(POWERS).toContain(b);
                const key = [a, b].sort().join("|");
                expect(pairs.has(key)).toBe(false);
                pairs.add(key);
            }
            for (const [a, b] of scenario.alliances) {
                expect(POWERS).toContain(a);
                expect(["ireland", "papacy", "portugal", "scotland", "venice"]).toContain(b);
            }
        }
    });

    it("records the official power-card markers and special components", () => {
        expect(CAMPAIGN.powerCard.ottoman.scmOnCard).toBe(4);
        expect(CAMPAIGN.powerCard.spain.scmOnCard).toBe(3);
        expect(CAMPAIGN.powerCard.england.scmOnCard).toBe(3);
        expect(CAMPAIGN.powerCard.france.scmOnCard).toBe(2);
        expect(CAMPAIGN.powerCard.hre.scmOnCard).toBe(4);
        expect(CAMPAIGN.powerCard.protestant.components?.dutch.scmOnCard).toBe(3);
        expect(CAMPAIGN.powerCard.protestant.components?.huguenot.scmOnCard).toBe(5);

        expect(TOURNAMENT.powerCard.ottoman.scmOnCard).toBe(3);
        expect(TOURNAMENT.powerCard.spain.scmOnCard).toBe(2);
        expect(TOURNAMENT.powerCard.england.scmOnCard).toBe(3);
        expect(TOURNAMENT.powerCard.france.scmOnCard).toBe(4);
        expect(TOURNAMENT.powerCard.hre.scmOnCard).toBe(4);
        expect(TOURNAMENT.powerCard.protestant.components?.dutch.scmOnCard).toBe(3);
        expect(TOURNAMENT.powerCard.protestant.components?.huguenot.scmOnCard).toBe(3);

        expect(TOURNAMENT.powerCard.spain.worldMapFortresses).toBe(1);
        expect(TOURNAMENT.powerCard.spain.jesuits).toBe(1);
        expect(TOURNAMENT.powerCard.spain.treasureFleetEscorts).toBe(1);
        expect(TOURNAMENT.powerCard.spain.treasures).toBe(2);
        expect(CAMPAIGN.powerCard.protestant.components?.huguenot.leadersOffMap).toEqual([
            "coligny",
        ]);
        expect(TOURNAMENT.powerCard.protestant.components?.dutch.leadersOffMap).toEqual([
            "orange",
        ]);
        expect(TOURNAMENT.powerCard.france.valoisMarriage).toBe("Elisabeth de Valois");
    });

    it("uses the official setup order", () => {
        for (const scenario of ALL_SCENARIOS) {
            expect(scenario.phaseOrder).toEqual(["cardDraw", "diplomacy", "spring", "action"]);
        }
    });

    it("snapshots the scenario identity and length", () => {
        expect({
            campaign: {
                nameEn: CAMPAIGN.nameEn,
                startTurn: CAMPAIGN.startTurn,
                endTurn: CAMPAIGN.endTurn,
                startYear: CAMPAIGN.startYear,
                endYear: CAMPAIGN.endYear,
            },
            tournament: {
                nameEn: TOURNAMENT.nameEn,
                startTurn: TOURNAMENT.startTurn,
                endTurn: TOURNAMENT.endTurn,
                startYear: TOURNAMENT.startYear,
                endYear: TOURNAMENT.endYear,
            },
        }).toEqual({
            campaign: {
                nameEn: "The Siege of La Rochelle",
                startTurn: 1,
                endTurn: 7,
                startYear: 1559,
                endYear: 1598,
            },
            tournament: {
                nameEn: "The Dutch Revolt Starts",
                startTurn: 3,
                endTurn: 6,
                startYear: 1570,
                endYear: 1593,
            },
        });
    });
});
