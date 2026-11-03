import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {Local} from "boardgame.io/multiplayer";
import {VirginQueenGameDef} from "./game";
import {POWERS, VQGame} from "./constant/general";
import {ALL_CARDS, cardById} from "./constant/cards";
import {LAND_LINKS, SEA_ZONE_BY_ID, SEA_ZONES, SPACES, SPACE_BY_ID} from "./constant/spaces";
import {
    addLand,
    allied,
    assaultSpace,
    atWar,
    baseVp,
    canControlSpace,
    checkVictory,
    controlledKeys,
    fieldBattle,
    powerVp,
    protestantSpaceCount,
    resolveConversions,
    resolveEvent,
    resolveRebellion,
    setupGame,
    winter,
} from "./util";

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
        expect(G.spaces.laRochelle.control).toBe("protestant");
        expect(G.spaces.vienna.control).toBe("hre");
        expect(G.powers.spain.treasures).toHaveLength(4);
    });

    it("deals a home card and a hand to every power", () => {
        const G = newGame();
        for (const p of POWERS) {
            const hand = G.powers[p].cards;
            expect(hand.length).toBeGreaterThanOrEqual(3);
            expect(hand.filter((id) => cardById(id).kind === "home")).toHaveLength(1);
        }
        expect(G.powers.ottoman.cards.length).toBeGreaterThan(0);
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
        expect(atWar(G, "france", "protestant")).toBe(true);
        expect(atWar(G, "england", "spain")).toBe(false);
        expect(allied(G, "spain", "france")).toBe(false);
    });


    it("allows control of an unfortified space with a line of communication", () => {
        const G = newGame();
        addLand(G, "zagreb", "ottoman", "regular", 2);
        G.spaces.zagreb.control = "hre";
        expect(G.spaces.zagreb.unrest).toBe(false);
        const check = canControlSpace(G, "ottoman", "zagreb");
        expect(check.ok).toBe(true);
    });

    it("counts keys and base VP", () => {
        const G = newGame();
        expect(controlledKeys(G, "spain")).toHaveLength(6);
        expect(baseVp(G, "spain")).toBe(12);
        expect(protestantSpaceCount(G)).toBeGreaterThan(8);
        expect(powerVp(G, "spain")).toBeGreaterThanOrEqual(6);
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
    // Diplomacy: each power ends its turn.
    for (let i = 0; i < 6; i++) {
        clients[i].moves.endPhaseTurn();
    }
    expect(clients[0].getState().ctx.phase).toBe("spring");
    for (let i = 0; i < 6; i++) {
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

describe("Virgin Queen turn flow", () => {
    it("runs diplomacy, spring and the first action impulses", () => {
        const clients = startClients();
        try {
            expect(clients[0].getState().ctx.phase).toBe("diplomacy");
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
            expect(clients[0].getState().G.powers.ottoman.cp).toBe(cp - 1);
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
            for (let i = 0; i < 6; i++) {
                clients[i].moves.pass();
            }
            const state = clients[0].getState();
            // The winter resolution advances the year and starts a new diplomacy phase.
            expect(state.G.year).toBe(2);
            expect(state.ctx.phase).toBe("diplomacy");
            expect(state.G.powers.ottoman.cards.length).toBeGreaterThan(0);
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
            expect(clients[0].getState().ctx.phase).toBe("spring");
            const before = clients[0].getState().G.spaces.edirne.land.ottoman.regular;
            clients[0].moves.springDeploy({from: "istanbul", to: "edirne"});
            const state = clients[0].getState();
            expect(state.G.spaces.edirne.land.ottoman.regular).toBe(before + 4);
            expect(state.G.spaces.istanbul.land.ottoman).toBeUndefined();
        } finally {
            stopClients(clients);
        }
    });

    it("declares war during diplomacy by paying cards", () => {
        const clients = startClients();
        try {
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
            const before = state.G.spaces.edirne.land.ottoman.regular;
            clients[0].moves.moveLand({from: "istanbul", to: "edirne"});
            const after = clients[0].getState().G.spaces.edirne.land.ottoman.regular;
            expect(after).toBeGreaterThan(before);
            expect(clients[0].getState().G.spaces.istanbul.land.ottoman).toBeUndefined();
        } finally {
            stopClients(clients);
        }
    });


    it("ends by time limit after turn seven", () => {
        const clients = startClients();
        try {
            for (let year = 1; year <= 7; year++) {
                driveToAction(clients);
                for (let i = 0; i < 6; i++) {
                    clients[i].moves.pass();
                }
            }
            let state = clients[0].getState();
            if (state.ctx.gameover === undefined) {
                // The end-of-winter victory check may be evaluated at the start
                // of the next phase's first move.
                state = clients[0].getState();
                if (state.ctx.phase === "diplomacy") {
                    clients[0].moves.endPhaseTurn();
                }
                state = clients[0].getState();
            }
            expect(state.ctx.gameover).toBeDefined();
            expect(state.ctx.gameover.reason).toBe("timeLimit");
        } finally {
            stopClients(clients);
        }
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
                for (let i = 0; i < 6; i++) {
                    clients[i].moves.pass();
                }
                expect(clients[0].getState().G.year).toBe(year + 1);
                expect(clients[0].getState().ctx.phase).toBe("diplomacy");
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
