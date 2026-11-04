import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {Local} from "boardgame.io/multiplayer";
import {VirginQueenGameDef} from "./game";
import {untimelyDeathTargets} from "./cardEvents";
import {POWERS, VQGame} from "./constant/general";
import {ALL_CARDS, cardById} from "./constant/cards";
import {SEA_ZONE_BY_ID, SEA_ZONES} from "./constant/spaces";
import {LAND_LINKS, SPACES, SPACE_BY_ID} from "./mapData";
import {
    addLand,
    allied,
    assaultSpace,
    atWar,
    availableHomeCards,
    baseVp,
    canControlSpace,
    checkImmediateVictory,
    checkVictory,
    controlledKeys,
    dealYear,
    fieldBattle,
    homeCardChoiceRequired,
    homeCardsInHand,
    powerVp,
    protestantSpaceCount,
    resolveConversions,
    resolveMinorDiplomacy,
    resolveEvent,
    resolveRebellion,
    rulerStats,
    setupGame,
    setWar,
    winter,
} from "./util";
import {chooseHomeCard, chooseHreReligiousPreference, endPhaseTurn, fightForeignWar, gainIntelligence, playCard} from "./moves";
import {INVALID_MOVE} from "boardgame.io/core";

const fakeCtx = (roll = () => 6): Ctx => ({
    random: {
        Die: () => roll(),
        Shuffle: (a: any[]) => a,
    },
} as unknown as Ctx);

const newGame = (): VQGame => setupGame(fakeCtx());

describe("Virgin Queen setup and data", () => {
    it("builds all spaces, sea zones and powers", () => {
        const G = newGame();
        expect(Object.keys(G.spaces)).toHaveLength(SPACES.length);
        expect(Object.keys(G.seaZones)).toHaveLength(13);
        expect(Object.keys(G.powers)).toHaveLength(6);
        expect(G.spaces.london.control).toBe("england");
        expect(G.spaces.amsterdam.control).toBe("spain");
        expect(G.spaces.laRochelle.control).toBe("france");
        expect(G.spaces.vienna.control).toBe("hre");
        expect(G.powers.spain.treasures).toHaveLength(1);
    });

    it("deals only the Home cards available on the current turn", () => {
        const G = newGame();
        dealYear(G, fakeCtx());
        const expected: Record<string, number> = {
            ottoman: 2,
            spain: 1,
            england: 1,
            france: 1,
            hre: 2,
            protestant: 1,
        };
        for (const p of POWERS) {
            const hand = G.powers[p].cards;
            expect(hand.length).toBeGreaterThanOrEqual(3);
            expect(homeCardsInHand(G, p)).toHaveLength(expected[p]);
        }
        expect(availableHomeCards(G, "hre")).toEqual(["vq-034", "vq-035"]);
        expect(availableHomeCards(G, "protestant")).toEqual(["vq-032"]);
        expect(G.powers.ottoman.cards.length).toBeGreaterThan(0);
    });

    it("adds later Home cards when their printed turn arrives", () => {
        const G = newGame();
        dealYear(G, fakeCtx());
        expect(homeCardsInHand(G, "england")).toEqual(["vq-036"]);
        expect(homeCardsInHand(G, "france")).toEqual(["vq-033"]);
        expect(homeCardsInHand(G, "spain")).toEqual(["vq-003"]);

        G.year = 3;
        dealYear(G, fakeCtx());
        expect(homeCardsInHand(G, "england")).toHaveLength(2);
        expect(homeCardsInHand(G, "france")).toHaveLength(2);
        expect(homeCardsInHand(G, "spain")).toHaveLength(1);

        G.year = 4;
        dealYear(G, fakeCtx());
        expect(homeCardsInHand(G, "spain")).toHaveLength(2);
    });


    it("has consistent map links and sea zones", () => {
        const ids = new Set<string>();
        for (const s of SPACES) {
            expect(ids.has(s.id)).toBe(false);
            ids.add(s.id);
            for (const z of s.ports ?? []) {
                expect(SEA_ZONE_BY_ID[z]).toBeDefined();
            }
        }
        for (const [a, b] of LAND_LINKS) {
            expect(SPACE_BY_ID[a]).toBeDefined();
            expect(SPACE_BY_ID[b]).toBeDefined();
            expect(a).not.toBe(b);
        }
        for (const z of SEA_ZONES) {
            for (const other of z.adjacent) {
                expect(SEA_ZONE_BY_ID[other]).toBeDefined();
                expect(SEA_ZONE_BY_ID[other].adjacent).toContain(z.id);
            }
        }
    });

    it("starts with the historical wars", () => {
        const G = newGame();
        expect(atWar(G, "ottoman", "spain")).toBe(true);
        expect(atWar(G, "england", "france")).toBe(true);
        expect(atWar(G, "france", "protestant")).toBe(false);
        expect(atWar(G, "england", "spain")).toBe(false);
        expect(allied(G, "spain", "france")).toBe(false);
    });


    it("allows control of an unfortified space with a line of communication", () => {
        const G = newGame();
        addLand(G, "zagreb", "ottoman", "regular", 2);
        G.spaces.zagreb.control = "hre";
        setWar(G, "ottoman", "hre");
        expect(G.spaces.zagreb.unrest).toBe(false);
        const check = canControlSpace(G, "ottoman", "zagreb");
        expect(check.ok).toBe(true);
    });

    it("counts keys and base VP", () => {
        const G = newGame();
        expect(controlledKeys(G, "spain")).toHaveLength(8);
        expect(baseVp(G, "spain")).toBe(20);
        expect(protestantSpaceCount(G)).toBeGreaterThan(8);
        expect(powerVp(G, "spain")).toBeGreaterThanOrEqual(6);
    });

    it("does not treat a scenario's starting keys as an immediate military victory", () => {
        const G = newGame();
        expect(checkImmediateVictory(G)).toBeUndefined();

        for (const id of ["vienna", "prague", "buda", "brussels", "antwerp"]) {
            G.spaces[id].control = "hre";
        }
        expect(checkImmediateVictory(G)).toEqual({winner: "hre", reason: "military"});
    });

    it("lets Ottoman Venice diplomacy deactivate its existing ally", () => {
        const G = newGame();
        G.powers.spain.alliedMinors.push("venice");
        G.powers.ottoman.influence.venice = 9;

        resolveMinorDiplomacy(G, fakeCtx(), "venice");

        expect(G.powers.spain.alliedMinors).not.toContain("venice");
        expect(G.powers.ottoman.alliedMinors).not.toContain("venice");
        expect(G.log.some((line) => line.includes("deactivates venice"))).toBe(true);
    });

    it("lets England's Ireland result deactivate its existing ally", () => {
        const G = newGame();
        G.powers.spain.alliedMinors.push("ireland");
        G.powers.england.influence.ireland = 9;

        resolveMinorDiplomacy(G, fakeCtx(), "ireland");

        expect(G.powers.spain.alliedMinors).not.toContain("ireland");
        expect(G.powers.england.alliedMinors).not.toContain("ireland");
        expect(G.log.some((line) => line.includes("deactivates ireland"))).toBe(true);
    });

    it("excludes a power barred from minor diplomacy", () => {
        const G = newGame();
        G.minorInfluenceBlocked.france.push("venice");
        G.powers.france.influence.venice = 9;
        G.powers.spain.influence.venice = 9;

        const winner = resolveMinorDiplomacy(G, fakeCtx(), "venice");

        expect(winner).toBe("spain");
        expect(G.log.join("\n")).not.toContain("France 6+9");
    });

    it("applies and clears the Ottoman Persia-war card penalty", () => {
        const G = newGame();
        const ctx = {...fakeCtx(), currentPlayer: "0", phase: "action"} as unknown as Ctx;
        G.powers.ottoman.cards.push("vq-073");
        playCard(G, ctx, {cardId: "vq-073", asEvent: true, target: "3"});
        expect(G.powers.ottoman.cardModifier).toBe(-1);

        G.foreignWars.ottoman!.status = "active";
        G.foreignWars.ottoman!.units.regular = 3;
        G.foreignWars.ottoman!.enemyUnits = 1;
        G.powers.ottoman.cp = 1;
        fightForeignWar(G, ctx);

        expect(G.foreignWars.ottoman).toBeUndefined();
        expect(G.powers.ottoman.cardModifier).toBe(0);
    });

    it("preserves informant timing across winter", () => {
        const G = newGame();
        G.year = 3;
        G.impulse = 7;
        G.informants.push({owner: "spain", target: "france", neutralized: false, plantedImpulse: 7});
        winter(G, fakeCtx());

        expect(G.impulse).toBe(7);
        G.impulse += 1;
        G.powers.spain.cp = 2;
        const ctx = {...fakeCtx(), currentPlayer: "1", phase: "action"} as unknown as Ctx;
        gainIntelligence(G, ctx, {target: "france"});

        expect(G.lastRolls).toContain("4 dice");
    });
});

function startClients() {
    const spec = {
        numPlayers: 6,
        game: {...VirginQueenGameDef, seed: "vq-test"},
        multiplayer: Local(),
    };
    const clients = POWERS.map((_, i) => {
        const c = Client<VQGame, Ctx>({...spec, playerID: String(i)} as any) as any;
        c.start();
        return c;
    });
    return clients;
}

function driveToAction(clients: any[]) {
    // Each power completes Card Draw, Diplomacy and Spring Deployment.
    for (let i = 0; i < 6; i++) {
        clients[i].moves.endPhaseTurn();
    }
    expect(clients[0].getState().ctx.phase).toBe("diplomacy");
    for (let i = 0; i < 6; i++) {
        clients[i].moves.endPhaseTurn();
    }
    expect(clients[0].getState().ctx.phase).toBe("spring");
    for (let i = 0; i < 6; i++) {
        const state = clients[i].getState();
        if (i === 4 && !state.G.hreReligiousPreferenceChosen) clients[i].moves.chooseHreReligiousPreference({preference: "balanced"});
        if (homeCardChoiceRequired(state.G, POWERS[i])) {
            clients[i].moves.chooseHomeCard({cardId: homeCardsInHand(state.G, POWERS[i])[0]});
        }
        clients[i].moves.endPhaseTurn();
    }
    expect(clients[0].getState().ctx.phase).toBe("action");
    expect(clients[0].getState().ctx.currentPlayer).toBe("0");
}

function stopClients(clients: any[]) {
    for (const c of clients) {
        c.stop();
    }
}

/**
 * Resolve any Mandatory Events that block a pass, then pass until the Action
 * Phase ends.  A power may not pass while holding a Mandatory Event.
 */
function passToEndAction(clients: any[]) {
    for (let guard = 0; guard < 80; guard++) {
        const state = clients[0].getState();
        if (state.ctx.phase !== "action" || state.G.consecutivePasses >= 6) {
            return;
        }
        // The Ottoman's post-first-impulse #16 window is optional; decline it.
        if (state.G.pendingAction) {
            const responder = state.G.pendingAction.responder ??
                (state.G.pendingAction.power === "ottoman" ? "spain" : "ottoman");
            clients[POWERS.indexOf(responder)].moves.respondAction({choice: "continue"});
            continue;
        }
        const idx = Number(state.ctx.currentPlayer);
        const p = POWERS[idx];
        const hand = clients[idx].getState().G.powers[p].cards;
        const mandatory = hand.find((id: string) => cardById(id).officialKind === "mandatory");
        const homeCard = hand.find((id: string) => cardById(id).kind === "home");
        const overAdmin = hand.length > rulerStats(state.G, p).admin;
        if (mandatory !== undefined || homeCard !== undefined || overAdmin) {
            const cardToPlay = mandatory ?? homeCard ?? hand[0];
            const def = cardById(cardToPlay);
            // Untimely Death needs a leader choice; take the first legal one.
            const target = def.officialEffect?.kind === "manual" && def.officialEffect.handler === "untimelyDeath"
                ? (untimelyDeathTargets(state.G)[0] ?? "none") : undefined;
            clients[idx].moves.playCard({cardId: cardToPlay, asEvent: true, ...(target !== undefined ? {target} : {})});
            clients[idx].moves.endImpulse();
        } else {
            clients[idx].moves.pass();
        }
    }
}

describe("Virgin Queen turn flow", () => {
    it("runs diplomacy, spring and the first action impulses", () => {
        const clients = startClients();
        try {
            expect(clients[0].getState().ctx.phase).toBe("cardDraw");
            driveToAction(clients);
            const state = clients[0].getState();
            const ottoman = state.G.powers.ottoman;
            const card = ottoman.cards.find((id: string) => cardById(id).kind !== "home");
            expect(card).toBeDefined();
            clients[0].moves.playCard({cardId: card});
            const cp = clients[0].getState().G.powers.ottoman.cp;
            expect(cp).toBe(cardById(card).cp);
            const before = clients[0].getState().G.spaces.istanbul.land.ottoman.regular;
            clients[0].moves.recruit({space: "istanbul", kind: "regular"});
            const after = clients[0].getState().G.spaces.istanbul.land.ottoman.regular;
            expect(after).toBe(before + 1);
            expect(clients[0].getState().G.powers.ottoman.cp).toBe(cp - 2);
            clients[0].moves.endImpulse();
            expect(clients[0].getState().ctx.currentPlayer).toBe("1");
        } finally {
            stopClients(clients);
        }
    });

    it("ends the action phase after six consecutive passes", () => {
        const clients = startClients();
        try {
            driveToAction(clients);
            passToEndAction(clients);
            const state = clients[0].getState();
            // Winter advances the year and begins the next Card Draw phase.
            expect(state.G.year).toBe(2);
            expect(state.ctx.phase).toBe("cardDraw");
            expect(state.G.powers.ottoman.cards.length).toBeGreaterThan(0);
        } finally {
            stopClients(clients);
        }
    });


    it("requires the HRE to make its secret Spring Home card choice", () => {
        const G = newGame();
        dealYear(G, fakeCtx());
        const ctx = {
            ...fakeCtx(),
            phase: "spring",
            currentPlayer: "4",
            events: {endTurn: jest.fn()},
        } as unknown as Ctx;

        expect(homeCardChoiceRequired(G, "hre")).toBe(true);
        expect(endPhaseTurn(G, ctx)).toBe(INVALID_MOVE);
        expect(G.powers.hre.homeCardChoiceDone).toBe(false);

        const home = homeCardsInHand(G, "hre");
        expect(home).toHaveLength(2);
        expect(chooseHomeCard(G, ctx, {cardId: home[0]})).toBeUndefined();
        expect(G.powers.hre.homeCardChoiceDone).toBe(true);
        expect(homeCardsInHand(G, "hre")).toEqual([home[0]]);
        expect(G.powers.hre.homeCardSetAside).toEqual([home[1]]);
        expect(chooseHomeCard(G, ctx, {cardId: home[0]})).toBe(INVALID_MOVE);
        expect(endPhaseTurn(G, ctx)).toBe(INVALID_MOVE);
        expect(chooseHreReligiousPreference(G, ctx, {preference: "balanced"})).toBeUndefined();
        expect(endPhaseTurn(G, ctx)).toBeUndefined();
    });

    it("requires the Tournament Ottoman to choose because Selim II rules", () => {
        const G = setupGame(fakeCtx(), {scenario: "tournament"});
        dealYear(G, fakeCtx());
        expect(G.powers.ottoman.ruler).toBe("selimII");
        expect(homeCardChoiceRequired(G, "ottoman")).toBe(true);
    });

    it("returns used and set-aside Home cards at the next Card Draw", () => {
        const G = newGame();
        dealYear(G, fakeCtx());
        const home = homeCardsInHand(G, "hre");
        const springCtx = {
            ...fakeCtx(),
            phase: "spring",
            currentPlayer: "4",
        } as unknown as Ctx;
        expect(chooseHomeCard(G, springCtx, {cardId: home[0]})).toBeUndefined();
        expect(G.powers.hre.homeCardSetAside).toEqual([home[1]]);

        const actionCtx = {...fakeCtx(), phase: "action", currentPlayer: "4"} as unknown as Ctx;
        expect(playCard(G, actionCtx, {cardId: home[0], asEvent: true})).toBeUndefined();
        expect(G.homeSetAside).toContain(home[0]);

        G.year += 1;
        dealYear(G, fakeCtx());
        const returned = homeCardsInHand(G, "hre");
        expect(returned).toHaveLength(2);
        expect(new Set(returned).size).toBe(2);
        expect(returned).toEqual(expect.arrayContaining(home));
        expect(G.powers.hre.homeCardSetAside).toEqual([]);
        expect(G.powers.hre.homeCardChoiceDone).toBe(false);
        expect(G.homeSetAside).toEqual([]);
    });

    it("does not require the Ottoman to choose while Suleiman rules", () => {
        const G = newGame();
        dealYear(G, fakeCtx());
        const ctx = {
            ...fakeCtx(),
            phase: "spring",
            currentPlayer: "0",
            events: {endTurn: jest.fn()},
        } as unknown as Ctx;

        expect(G.powers.ottoman.ruler).toBe("suleiman");
        expect(homeCardChoiceRequired(G, "ottoman")).toBe(false);
        expect(endPhaseTurn(G, ctx)).toBeUndefined();

        G.powers.ottoman.ruler = "selimII";
        expect(homeCardChoiceRequired(G, "ottoman")).toBe(true);
        expect(endPhaseTurn(G, ctx)).toBe(INVALID_MOVE);
    });

    it("switches the Ottoman ruler when Selim II is played", () => {
        const G = newGame();
        dealYear(G, fakeCtx());
        G.powers.ottoman.cards.push("vq-006");
        const ctx = {...fakeCtx(), phase: "action", currentPlayer: "0"} as unknown as Ctx;

        expect(playCard(G, ctx, {cardId: "vq-006", asEvent: true})).toBeUndefined();
        expect(G.powers.ottoman.ruler).toBe("selimII");
        expect(homeCardChoiceRequired(G, "ottoman")).toBe(true);
    });

    it("keeps the Spring Home card choice secret from other powers", () => {
        const clients = startClients();
        try {
            for (let i = 0; i < 6; i++) {
                clients[i].moves.endPhaseTurn();
            }
            for (let i = 0; i < 6; i++) {
                clients[i].moves.endPhaseTurn();
            }
            for (let i = 0; i < 4; i++) {
                clients[i].moves.endPhaseTurn();
            }
            const hre = clients[4];
            const home = homeCardsInHand(hre.getState().G, "hre");
            hre.moves.chooseHomeCard({cardId: home[0]});

            const hreView = hre.getState().G;
            const spainView = clients[1].getState().G;
            expect(hreView.powers.hre.homeCardSetAside).toHaveLength(1);
            expect(hreView.powers.hre.homeCardSetAside[0]).toBe(home[1]);
            expect(spainView.powers.hre.homeCardSetAside).toHaveLength(0);
            expect(spainView.homeCardSetAsideCounts?.hre).toBe(1);
            expect(spainView.powers.hre.cards).toHaveLength(0);
            const choiceLog = clients[1].getState().log.slice(-1)[0] as any;
            expect(choiceLog.action.type).toBe("MAKE_MOVE");
            expect(choiceLog.action.payload.type).toBe("chooseHomeCard");
            expect(choiceLog.action.payload.args).toBeNull();
        } finally {
            stopClients(clients);
        }
    });

    it("spring-deploys a formation from the capital", () => {
        const clients = startClients();
        try {
            for (let i = 0; i < 6; i++) {
                clients[i].moves.endPhaseTurn();
            }
            for (let i = 0; i < 6; i++) {
                clients[i].moves.endPhaseTurn();
            }
            expect(clients[0].getState().ctx.phase).toBe("spring");
            // Returning naval leaders now ask for a home port before deployment.
            const pending = clients[0].getState().G.navalLeaderArrivals?.filter((entry) => entry.power === "ottoman") ?? [];
            expect(pending.length).toBeGreaterThan(0);
            for (const entry of pending) {
                clients[0].moves.chooseNavalLeaderPort({leader: entry.leader, port: entry.ports[0]});
            }
            const before = clients[0].getState().G.spaces.edirne.land.ottoman?.regular ?? 0;
            clients[0].moves.springDeploy({from: "istanbul", to: "edirne", units: {regular: 6}, leaders: ["mehmed"]});
            const state = clients[0].getState();
            expect(state.G.spaces.edirne.land.ottoman.regular).toBe(before + 6);
            expect(state.G.spaces.istanbul.land.ottoman.regular).toBe(2);
            expect(state.G.spaces.istanbul.leaders).not.toContain("mehmed");
        } finally {
            stopClients(clients);
        }
    });

    it("declares war during diplomacy by paying cards", () => {
        const clients = startClients();
        try {
            for (let i = 0; i < 6; i++) {
                clients[i].moves.endPhaseTurn();
            }
            clients[0].moves.endPhaseTurn();
            clients[1].moves.endPhaseTurn();
            expect(clients[0].getState().ctx.currentPlayer).toBe("2");
            const england = clients[0].getState().G.powers.england;
            const cp = england.cards.reduce((n: number, id: string) => n + cardById(id).cp, 0);
            if (cp >= 5) {
                clients[2].moves.declareWar({target: "spain"});
                expect(atWar(clients[0].getState().G, "england", "spain")).toBe(true);
            }
        } finally {
            stopClients(clients);
        }
    });

    it("moves a formation during the action phase", () => {
        const clients = startClients();
        try {
            driveToAction(clients);
            const state = clients[0].getState();
            const card = state.G.powers.ottoman.cards.find((id: string) => cardById(id).cp >= 1);
            clients[0].moves.playCard({cardId: card});
            const before = state.G.spaces.edirne.land.ottoman?.regular ?? 0;
            clients[0].moves.moveLand({from: "istanbul", to: "edirne"});
            if (clients[0].getState().G.pendingAction) clients[1].moves.respondAction({choice: "continue"});
            const after = clients[0].getState().G.spaces.edirne.land.ottoman.regular;
            expect(after).toBeGreaterThan(before);
            expect(clients[0].getState().G.spaces.istanbul.land.ottoman).toBeUndefined();
        } finally {
            stopClients(clients);
        }
    });


    it("ends by time limit after turn seven", () => {
        const G = newGame();
        G.year = G.endTurn + 1;
        G.checkVictory = true;
        const v = checkVictory(G);
        expect(v).toBeDefined();
        expect(v?.reason).toBe("timeLimit");
    });

    it("hides other powers' hands in playerView", () => {
        const clients = startClients();
        try {
            const spainView = clients[1].getState().G;
            expect(spainView.powers.spain.cards.length).toBeGreaterThan(0);
            expect(spainView.powers.ottoman.cards.length).toBe(0);
            expect(spainView.handCounts?.ottoman).toBeGreaterThan(0);
            expect(spainView.deckCount).toBeGreaterThan(0);
        } finally {
            stopClients(clients);
        }
    });
});

describe("Virgin Queen combat", () => {
    it("resolves a field battle and captures an empty fortified space", () => {
        const G = newGame();
        addLand(G, "graz", "ottoman", "regular", 5);
        // Graz is held by a single Holy Roman regular.
        const result = fieldBattle(G, fakeCtx(), "graz", "ottoman", ["hre"], "buda");
        expect(result.attackerHits).toBeGreaterThan(result.defenderHits);
        expect(G.spaces.graz.siege?.by).toBe("ottoman");
    });

    it("assaults a besieged key after one impulse", () => {
        const G = newGame();
        addLand(G, "graz", "ottoman", "regular", 6);
        G.spaces.graz.siege = {by: "ottoman", sinceImpulse: 1};
        G.impulse = 2;
        const ok = assaultSpace(G, fakeCtx(), "ottoman", "graz");
        expect(ok).toBe(true);
        expect(G.spaces.graz.control).toBe("ottoman");
        expect(G.spaces.graz.siege).toBeUndefined();
    });
});

describe("Virgin Queen religion and rebellion", () => {
    it("converts spaces with Protestant conversion attempts", () => {
        const G = newGame();
        const before = protestantSpaceCount(G);
        resolveConversions(G, fakeCtx(), "protestant", "protestant", "france", 5);
        expect(protestantSpaceCount(G)).toBeGreaterThan(before);
    });

    it("starts a Huguenot rebellion and goes to war with France", () => {
        const G = newGame();
        G.spaces.laRochelle.control = "france";
        // Remove the French garrison so the rebellion is unopposed.
        G.spaces.laRochelle.land = {};
        const ok = resolveRebellion(G, fakeCtx(), "protestant", "laRochelle", 2);
        expect(ok).toBe(true);
        expect(G.spaces.laRochelle.control).toBe("protestant");
        expect(atWar(G, "protestant", "france")).toBe(true);
    });
});


describe("Virgin Queen events", () => {
    it("resolves every event and home-card effect without throwing", () => {
        for (const card of ALL_CARDS) {
            const G = newGame();
            const p = card.power ?? "spain";
            expect(() => resolveEvent(G, fakeCtx(), p, card.effect)).not.toThrow();
        }
    });

    it("plays through three full years of all-pass impulses", () => {
        const clients = startClients();
        try {
            for (let year = 1; year <= 3; year++) {
                driveToAction(clients);
                passToEndAction(clients);
                const state = clients[0].getState();
                if (state.ctx.gameover !== undefined) {
                    // A domination victory can legitimately end the match
                    // before the fourth Card Draw Phase.
                    expect(state.ctx.gameover.reason).toBe("domination");
                    return;
                }
                expect(state.G.year).toBe(year + 1);
                expect(state.ctx.phase).toBe("cardDraw");
            }
        } finally {
            stopClients(clients);
        }
    });
});

describe("Virgin Queen victory", () => {
    it("detects a military victory", () => {
        const G = newGame();
        (["vienna", "prague", "buda", "brussels", "antwerp"] as string[]).forEach((id) => {
            G.spaces[id].control = "hre";
        });
        const v = checkVictory(G);
        expect(v?.winner).toBe("hre");
        expect(v?.reason).toBe("military");
    });

    it("awards a standard victory at 25 VP after the winter check", () => {
        const G = newGame();
        G.powers.spain.bonusVp += 20;
        G.checkVictory = true;
        G.year = 3;
        const v = checkVictory(G);
        expect(v?.winner).toBe("spain");
        expect(v?.reason).toBe("standard");
    });
});
