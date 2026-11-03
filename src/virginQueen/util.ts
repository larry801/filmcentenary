import {Ctx} from "boardgame.io";
import {
    AREA_NAMES,
    CardDef,
    Controller,
    EventEffect,
    LandStack,
    landCount,
    LeaderDef,
    MinorPower,
    MINOR_POWERS,
    NavalStack,
    navalCount,
    POWER_COLORS,
    POWER_INFO,
    POWER_NAMES,
    POWERS,
    Power,
    Religion,
    ReligionArea,
    ROYALS,
    SeaZoneID,
    VQGame,
    isPower,
    emptyLand,
    emptyNaval,
} from "./constant/general";
import {
    CAPITAL_SPACES,
    DUTCH_KEYS,
    initialControl,
    initialLandFor,
    initialNavalFor,
    initialReligion,
    KEY_SPACES,
    LAND_NEIGHBORS,
    SEA_PORTS,
    SEA_ZONE_BY_ID,
    SEA_ZONES,
    SPACES,
    SPACE_BY_ID,
} from "./constant/spaces";
import {cardById, DECK_CARD_IDS, HOME_CARDS} from "./constant/cards";
import {LEADER_BY_ID, LEADERS, startingLeaders} from "./constant/leaders";

export {SPACE_BY_ID, KEY_SPACES, DUTCH_KEYS, initialControl, initialReligion, initialLandFor, initialNavalFor};

// --------------------------------------------------------------------------
// Generic helpers
// --------------------------------------------------------------------------

export const shuffle = <T>(ctx: Ctx, arr: T[]): T[] =>
    (ctx.random?.Shuffle(arr) as T[] | undefined) ?? arr.slice();

export const die = (ctx: Ctx, sides = 6): number =>
    (ctx.random?.Die(sides) as number | undefined) ?? 1 + Math.floor(Math.random() * sides);

export const roll = (ctx: Ctx, n: number): number[] =>
    Array.from({length: Math.max(0, n)}, () => die(ctx, 6));

export const hits = (dice: number[]): number =>
    dice.filter((d) => d >= 5).length;

export const pushLog = (G: VQGame, msg: string): void => {
    G.log.push(msg);
    if (G.log.length > 250) {
        G.log.splice(0, G.log.length - 250);
    }
};

export const powerLabel = (p: Power): string => POWER_NAMES[p].en;

export const controllerLabel = (c: Controller): string =>
    isPower(c) ? POWER_NAMES[c].short : c === "independent" ? "Independent" : c.charAt(0).toUpperCase() + c.slice(1);

export const sortByImpulse = (list: Power[]): Power[] =>
    [...list].sort((a, b) => POWERS.indexOf(a) - POWERS.indexOf(b));

// --------------------------------------------------------------------------
// Initial state
// --------------------------------------------------------------------------

export const setupGame = (ctx: Ctx): VQGame => {
    const spaces: VQGame["spaces"] = {};
    for (const def of SPACES) {
        const land: VQGame["spaces"][string]["land"] = {};
        const naval: VQGame["spaces"][string]["naval"] = {};
        for (const c of new Set<Controller>([
            ...Object.keys(def.initial ?? {}) as Controller[],
            ...Object.keys(def.initialNaval ?? {}) as Controller[],
        ])) {
            const l = initialLandFor(def, c);
            if (l !== undefined && landCount(l) > 0) {
                land[c] = l;
            }
            const n = initialNavalFor(def, c);
            if (n !== undefined && navalCount(n) > 0) {
                naval[c] = n;
            }
        }
        const leaders = LEADERS.filter((l) => l.start === def.id).map((l) => l.id);
        spaces[def.id] = {
            control: initialControl(def),
            religion: initialReligion(def),
            land,
            naval,
            leaders,
            unrest: false,
            fortress: def.kind !== "open",
        };
    }

    const seaZones: VQGame["seaZones"] = {} as VQGame["seaZones"];
    for (const zone of SEA_ZONES) {
        seaZones[zone.id] = {naval: {}, leaders: []};
    }

    const powers = {} as VQGame["powers"];
    const leaders: VQGame["leaders"] = {};
    for (const p of POWERS) {
        powers[p] = {
            power: p,
            cards: [],
            treasures: [],
            cp: 0,
            cardPlayed: false,
            treasurePlayed: false,
            bonusVp: 0,
            cardModifier: 0,
            wars: [],
            warsMinors: [],
            allies: [],
            influence: {},
            patrons: [],
            passed: false,
        };
        for (const id of startingLeaders[p]) {
            leaders[id] = {id, location: LEADER_BY_ID[id].start ?? "pool"};
        }
    }
    // Leaders deliberately held off the map until a rebellion.
    for (const l of LEADERS) {
        if (leaders[l.id] === undefined) {
            leaders[l.id] = {id: l.id, location: "pool"};
        }
    }

    // Initial diplomatic situation (Treaty of Cateau-Cambresis leaves France and
    // Spain at peace; the Ottomans are at war with the Habsburgs and the
    // Huguenots are in open rebellion against the French crown).
    powers.ottoman.wars = ["spain", "hre"];
    powers.spain.wars = ["ottoman"];
    powers.hre.wars = ["ottoman"];
    powers.france.wars = ["protestant"];
    powers.protestant.wars = ["france"];

    const G: VQGame = {
        year: 1,
        dealtYear: 0,
        turnsCompleted: 0,
        phaseTurns: 0,
        consecutivePasses: 0,
        impulse: 0,
        activePower: "ottoman",
        spaces,
        seaZones,
        powers,
        leaders,
        deck: shuffle(ctx, DECK_CARD_IDS.slice()),
        discard: [],
        removed: [],
        homeSetAside: [],
        doWCostEnglandSpain: 5,
        suezAttempts: 0,
        suezDone: false,
        betrothals: [],
        marriages: 0,
        log: [],
        vpHistory: {},
        checkVictory: false,
        lastAction: "1559 年开局",
        lastRolls: "",
        springDone: [],
        patronizedThisTurn: [],
        royals: ROYALS.map((r) => ({...r})),
    };
    pushLog(G, "Virgin Queen: Wars of Religion, 1559.");
    dealYear(G, ctx);
    return G;
};

// --------------------------------------------------------------------------
// Cards, treasures, deck
// --------------------------------------------------------------------------

export const drawCards = (G: VQGame, ctx: Ctx, p: Power, n: number): string[] => {
    const drawn: string[] = [];
    for (let i = 0; i < n; i++) {
        if (G.deck.length === 0) {
            if (G.discard.length === 0) {
                break;
            }
            G.deck = shuffle(ctx, G.discard.slice());
            G.discard = [];
            pushLog(G, "Deck reshuffled from the discard pile.");
        }
        const c = G.deck.shift();
        if (c === undefined) {
            break;
        }
        G.powers[p].cards.push(c);
        drawn.push(c);
    }
    return drawn;
};

export const handCount = (G: VQGame, p: Power): number => G.powers[p].cards.length;

export const removeCardFromHand = (G: VQGame, p: Power, cardId: string): boolean => {
    const hand = G.powers[p].cards;
    const idx = hand.indexOf(cardId);
    if (idx < 0) {
        return false;
    }
    hand.splice(idx, 1);
    return true;
};

export const discardCard = (G: VQGame, p: Power, cardId: string, asEvent: boolean): void => {
    const def = cardById(cardId);
    if (def.kind === "home") {
        G.homeSetAside.push(cardId);
        return;
    }
    if (asEvent && def.kind === "event" && def.text?.includes("Remove from deck")) {
        G.removed.push(cardId);
    } else {
        G.discard.push(cardId);
    }
};

export const drawCount = (G: VQGame, p: Power): number => {
    const keys = controlledKeys(G, p).length;
    const info = POWER_INFO[p];
    const table = info.drawByKeys;
    const base = table[Math.min(keys, table.length - 1)] ?? 3;
    return Math.max(1, base + info.ruler.cardBonus + G.powers[p].cardModifier);
};

/** Deal a new year's hands. Home cards return, hands are trimmed to Admin. */
export const dealYear = (G: VQGame, ctx: Ctx): void => {
    for (const p of POWERS) {
        const ps = G.powers[p];
        // Home cards set aside last year become available again.
        const home = HOME_CARDS.filter((c) => c.power === p);
        const availableHome = home.filter((c) => !ps.cards.includes(c.id));
        for (const c of availableHome) {
            if (G.homeSetAside.includes(c.id)) {
                G.homeSetAside = G.homeSetAside.filter((id) => id !== c.id);
            }
            ps.cards.push(c.id);
        }
        // Keep at most the ruler's admin rating of non-home cards.
        const nonHome = ps.cards.filter((c) => cardById(c).kind !== "home");
        const keep = Math.min(nonHome.length, POWER_INFO[p].ruler.admin);
        const dropped = nonHome.slice(keep);
        for (const d of dropped) {
            ps.cards = ps.cards.filter((c) => c !== d);
            G.discard.push(d);
        }
        const n = drawCount(G, p);
        drawCards(G, ctx, p, n);
        ps.passed = false;
        ps.cp = 0;
        ps.cardPlayed = false;
        ps.treasurePlayed = false;
        ps.influence = {};
        ps.allies = [];
    }
    G.dealtYear = G.year;
    G.springDone = [];
    G.patronizedThisTurn = [];
    if (G.powers.spain.treasures.length === 0) {
        G.powers.spain.treasures = Array.from({length: 4}, () => 1 + die(ctx, 5) - 1);
    }
};

export const shuffleTreasure = (ctx: Ctx): number => 1 + (die(ctx, 5) - 1);

export const addTreasure = (G: VQGame, ctx: Ctx, p: Power, n: number): void => {
    for (let i = 0; i < n; i++) {
        G.powers[p].treasures.push(shuffleTreasure(ctx));
    }
};

export const playTreasure = (G: VQGame, p: Power, index: number): number => {
    const t = G.powers[p].treasures[index];
    if (t === undefined) {
        return 0;
    }
    G.powers[p].treasures.splice(index, 1);
    G.powers[p].cp += t;
    G.powers[p].treasurePlayed = true;
    return t;
};

// --------------------------------------------------------------------------
// Political / diplomatic state
// --------------------------------------------------------------------------

export const atWar = (G: VQGame, a: Power, b: Power): boolean =>
    G.powers[a].wars.includes(b) || G.powers[b].wars.includes(a);

export const atWarWithMinor = (G: VQGame, p: Power, m: MinorPower): boolean =>
    G.powers[p].warsMinors.includes(m);

export const allied = (G: VQGame, a: Power, b: Power): boolean =>
    a !== b && G.powers[a].allies.includes(b);

export const friendly = (G: VQGame, a: Power, b: Power): boolean => a === b || allied(G, a, b);

export const setWar = (G: VQGame, a: Power, b: Power): void => {
    if (!G.powers[a].wars.includes(b)) {
        G.powers[a].wars.push(b);
    }
    if (!G.powers[b].wars.includes(a)) {
        G.powers[b].wars.push(a);
    }
    G.powers[a].allies = G.powers[a].allies.filter((x) => x !== b);
    G.powers[b].allies = G.powers[b].allies.filter((x) => x !== a);
    pushLog(G, `${powerLabel(a)} declares war on ${powerLabel(b)}.`);
};

export const clearWar = (G: VQGame, a: Power, b: Power): void => {
    G.powers[a].wars = G.powers[a].wars.filter((x) => x !== b);
    G.powers[b].wars = G.powers[b].wars.filter((x) => x !== a);
    pushLog(G, `${powerLabel(a)} and ${powerLabel(b)} make peace.`);
};

const WAR_COST: Record<string, number> = {
    "england-france": 3,
    "england-spain": 5,
    "france-hre": 2,
    "france-ottoman": 3,
    "france-protestant": 1,
    "france-spain": 2,
    "hre-ottoman": 2,
    "hre-protestant": 3,
    "hre-spain": 1,
    "ottoman-protestant": 3,
    "ottoman-spain": 2,
    "protestant-spain": 2,
};

export const warCost = (G: VQGame, a: Power, b: Power): number => {
    if ((a === "england" && b === "spain") || (a === "spain" && b === "england")) {
        return Math.max(1, G.doWCostEnglandSpain);
    }
    return WAR_COST[[a, b].sort().join("-")] ?? 2;
};

export const canDeclareWar = (G: VQGame, a: Power, b: Power): boolean => {
    if (a === b || atWar(G, a, b) || allied(G, a, b)) {
        return false;
    }
    if ((a === "spain" && b === "protestant") || (a === "protestant" && b === "spain")) {
        return false;
    }
    return true;
};

export const declareWar = (G: VQGame, a: Power, b: Power): boolean => {
    if (!canDeclareWar(G, a, b)) {
        return false;
    }
    setWar(G, a, b);
    return true;
};

// --------------------------------------------------------------------------
// Controlled spaces, keys, VP and religion
// --------------------------------------------------------------------------

export const controlled = (G: VQGame, p: Power, space: string): boolean => {
    const s = G.spaces[space];
    return s !== undefined && s.control === p;
};

export const friendlyControlled = (G: VQGame, p: Power, space: string): boolean => {
    const s = G.spaces[space];
    if (s === undefined) {
        return false;
    }
    return s.control === p || (isPower(s.control) && allied(G, p, s.control));
};

export const controlledKeys = (G: VQGame, p: Power): string[] =>
    KEY_SPACES.filter((id) => {
        const s = G.spaces[id];
        return s !== undefined && s.control === p && !s.unrest;
    });

export const controlledKeysInNetherlands = (G: VQGame, p: Power): string[] =>
    controlledKeys(G, p).filter((id) => DUTCH_KEYS.includes(id));

export const protestantKeysOutsideNetherlands = (G: VQGame): string[] =>
    controlledKeys(G, "protestant").filter((id) => !DUTCH_KEYS.includes(id));

export const baseVp = (G: VQGame, p: Power): number => {
    if (p === "protestant") {
        const keys = controlledKeys(G, "protestant");
        return keys.reduce((sum, id) => sum + (DUTCH_KEYS.includes(id) ? 3 : 2), 0);
    }
    const keys = controlledKeys(G, p).length;
    const table = POWER_INFO[p].vpByKeys;
    return table[Math.min(keys, table.length - 1)] ?? 0;
};

export const protestantSpaceCount = (G: VQGame): number =>
    SPACES.filter((s) => s.area !== undefined && G.spaces[s.id].religion === "protestant" && !G.spaces[s.id].unrest).length;

export const protestantSpacesInArea = (G: VQGame, area: ReligionArea): number =>
    SPACES.filter((s) => s.area === area && G.spaces[s.id].religion === "protestant" && !G.spaces[s.id].unrest).length;

export const religiousSpecialVp = (G: VQGame, p: Power): number => {
    const n = protestantSpaceCount(G);
    switch (p) {
        case "spain":
            return n <= 3 ? 3 : n <= 6 ? 2 : n <= 9 ? 1 : 0;
        case "england":
            return n <= 3 ? 0 : n <= 6 ? 1 : n <= 9 ? 2 : n <= 12 ? 2 : n <= 15 ? 3 : 4;
        case "protestant":
            return n <= 3 ? 0 : n <= 6 ? 1 : n <= 9 ? 2 : n <= 12 ? 3 : n <= 15 ? 4 : 5;
        case "hre":
            // Secret religious preference is simplified to a balanced emperor.
            return n >= 7 && n <= 13 ? 2 : 0;
        default:
            return 0;
    }
};

export const powerVp = (G: VQGame, p: Power): number =>
    baseVp(G, p) + religiousSpecialVp(G, p) + G.powers[p].bonusVp;

export const victoryStandings = (G: VQGame): { power: Power; vp: number }[] =>
    POWERS.map((p) => ({power: p, vp: powerVp(G, p)})).sort((a, b) => b.vp - a.vp);

export const addVp = (G: VQGame, p: Power, n: number): void => {
    G.powers[p].bonusVp += n;
};

// --------------------------------------------------------------------------
// Unit helpers
// --------------------------------------------------------------------------

export const exactLand = (G: VQGame, space: string, c: Controller): LandStack =>
    G.spaces[space].land[c] ?? emptyLand();

export const exactNaval = (G: VQGame, space: string, c: Controller): NavalStack =>
    G.spaces[space].naval[c] ?? emptyNaval();

export const ensureLand = (G: VQGame, space: string, c: Controller): LandStack => {
    const s = G.spaces[space];
    if (s.land[c] === undefined) {
        s.land[c] = emptyLand();
    }
    return s.land[c] as LandStack;
};

export const ensureNaval = (G: VQGame, space: string, c: Controller): NavalStack => {
    const s = G.spaces[space];
    if (s.naval[c] === undefined) {
        s.naval[c] = emptyNaval();
    }
    return s.naval[c] as NavalStack;
};

export const cleanupLand = (G: VQGame, space: string, c: Controller): void => {
    const s = G.spaces[space];
    if (s.land[c] !== undefined && landCount(s.land[c] as LandStack) <= 0) {
        delete s.land[c];
    }
};

export const cleanupNaval = (G: VQGame, space: string, c: Controller): void => {
    const s = G.spaces[space];
    if (s.naval[c] !== undefined && navalCount(s.naval[c] as NavalStack) <= 0) {
        delete s.naval[c];
    }
};

export const addLand = (G: VQGame, space: string, c: Controller, kind: keyof LandStack, n: number): void => {
    ensureLand(G, space, c)[kind] += n;
};

export const addNaval = (G: VQGame, space: string, c: Controller, kind: keyof NavalStack, n: number): void => {
    ensureNaval(G, space, c)[kind] += n;
};

export const ownersWithLand = (G: VQGame, space: string): Controller[] =>
    Object.keys(G.spaces[space].land) as Controller[];

export const ownersWithNaval = (G: VQGame, space: string): Controller[] =>
    Object.keys(G.spaces[space].naval) as Controller[];

export const totalLand = (G: VQGame, space: string, owners: Controller[]): number =>
    owners.reduce((n, c) => n + landCount(G.spaces[space].land[c]), 0);

export const totalNaval = (G: VQGame, space: string, owners: Controller[]): number =>
    owners.reduce((n, c) => n + navalCount(G.spaces[space].naval[c]), 0);

export const enemyOwners = (G: VQGame, p: Power, space: string): Controller[] =>
    ownersWithLand(G, space).filter((c) => isPower(c) ? atWar(G, p, c) : c !== "independent");

export const spaceHasEnemyLand = (G: VQGame, p: Power, space: string): boolean =>
    enemyOwners(G, p, space).some((c) => landCount(G.spaces[space].land[c]) > 0);

export const spaceHasEnemyNaval = (G: VQGame, p: Power, space: string): boolean =>
    ownersWithNaval(G, space).some((c) => isPower(c) && atWar(G, p, c) && navalCount(G.spaces[space].naval[c]) > 0);

export const removeLandLosses = (G: VQGame, space: string, owners: Controller[], hitsCount: number): void => {
    let left = hitsCount;
    // Losses are taken from mercenaries first (they are the least reliable),
    // then regulars, then cavalry.
    for (const kind of ["merc", "regular", "cav"] as const) {
        for (const c of owners) {
            const st = G.spaces[space].land[c];
            if (st === undefined) {
                continue;
            }
            while (left > 0 && st[kind] > 0) {
                st[kind] -= 1;
                left -= 1;
            }
            cleanupLand(G, space, c);
            if (left === 0) {
                return;
            }
        }
    }
};

export const removePortNavalLosses = (G: VQGame, port: string, owners: Controller[], hitsCount: number): void => {
    let left = hitsCount;
    for (const kind of ["galleon", "racebuilt", "corsair", "galley"] as const) {
        for (const c of owners) {
            const st = G.spaces[port].naval[c];
            if (st === undefined) {
                continue;
            }
            while (left > 0 && st[kind] > 0) {
                st[kind] -= 1;
                left -= 1;
            }
            cleanupNaval(G, port, c);
            if (left === 0) {
                return;
            }
        }
    }
};

export const removeSeaNavalLosses = (G: VQGame, zone: SeaZoneID, owners: Controller[], hitsCount: number): void => {
    let left = hitsCount;
    for (const kind of ["galleon", "racebuilt", "corsair", "galley"] as const) {
        for (const c of owners) {
            const st = G.seaZones[zone].naval[c];
            if (st === undefined) {
                continue;
            }
            while (left > 0 && st[kind] > 0) {
                st[kind] -= 1;
                left -= 1;
            }
            if (st.galley + st.galleon + st.racebuilt + st.corsair === 0) {
                delete G.seaZones[zone].naval[c];
            }
            if (left === 0) {
                return;
            }
        }
    }
};

export const leadersAt = (G: VQGame, loc: string): string[] => {
    if (G.spaces[loc] !== undefined) {
        return G.spaces[loc].leaders;
    }
    const sea = G.seaZones[loc as SeaZoneID];
    return sea !== undefined ? sea.leaders : [];
};

export const leaderDef = (id: string): LeaderDef => LEADER_BY_ID[id];

export const bestBattle = (G: VQGame, loc: string, owners: Controller[], kind: "army" | "naval" = "army"): number => {
    let best = 0;
    for (const id of leadersAt(G, loc)) {
        const def = LEADER_BY_ID[id];
        if (def === undefined || def.kind !== kind) {
            continue;
        }
        if (owners.includes(def.power)) {
            best = Math.max(best, def.battle);
        }
    }
    return best;
};

export const bestPiracy = (G: VQGame, loc: string, owners: Controller[]): number => {
    let best = 0;
    for (const id of leadersAt(G, loc)) {
        const def = LEADER_BY_ID[id];
        if (def !== undefined && def.power !== undefined && owners.includes(def.power)) {
            best = Math.max(best, def.piracy ?? 0);
        }
    }
    return best;
};

export const moveLeaders = (G: VQGame, from: string, to: string, ids: string[]): void => {
    for (const id of ids) {
        const def = LEADER_BY_ID[id];
        if (def === undefined) {
            continue;
        }
        if (G.spaces[from] !== undefined) {
            G.spaces[from].leaders = G.spaces[from].leaders.filter((x) => x !== id);
        } else if (G.seaZones[from as SeaZoneID] !== undefined) {
            G.seaZones[from as SeaZoneID].leaders = G.seaZones[from as SeaZoneID].leaders.filter((x) => x !== id);
        }
        if (G.spaces[to] !== undefined) {
            G.spaces[to].leaders.push(id);
        } else if (G.seaZones[to as SeaZoneID] !== undefined) {
            G.seaZones[to as SeaZoneID].leaders.push(id);
        }
        G.leaders[id].location = to;
    }
};

export const captureLeaders = (G: VQGame, loc: string, owners: Controller[], captor: Power): number => {
    let n = 0;
    for (const id of [...leadersAt(G, loc)]) {
        const def = LEADER_BY_ID[id];
        if (def === undefined || !owners.includes(def.power)) {
            continue;
        }
        if (G.spaces[loc] !== undefined) {
            G.spaces[loc].leaders = G.spaces[loc].leaders.filter((x) => x !== id);
        } else if (G.seaZones[loc as SeaZoneID] !== undefined) {
            G.seaZones[loc as SeaZoneID].leaders = G.seaZones[loc as SeaZoneID].leaders.filter((x) => x !== id);
        }
        G.leaders[id] = {id, location: "captured", capturedBy: captor};
        n += 1;
    }
    if (n > 0) {
        pushLog(G, `${n} leader(s) captured by ${powerLabel(captor)}.`);
    }
    return n;
};

// --------------------------------------------------------------------------
// Geography
// --------------------------------------------------------------------------

export const isLandSpace = (id: string): boolean => SPACE_BY_ID[id] !== undefined;
export const isSeaZone = (id: string): boolean => SEA_ZONE_BY_ID[id] !== undefined;

export const landNeighbors = (id: string): { id: string; pass: boolean }[] =>
    LAND_NEIGHBORS[id] ?? [];

export const landAdjacent = (a: string, b: string): boolean =>
    landNeighbors(a).some((n) => n.id === b);

export const passBetween = (a: string, b: string): boolean =>
    landNeighbors(a).some((n) => n.id === b && n.pass);

export const seaAdjacent = (a: SeaZoneID, b: SeaZoneID): boolean =>
    SEA_ZONE_BY_ID[a].adjacent.includes(b);

export const portZones = (space: string): SeaZoneID[] => SPACE_BY_ID[space]?.ports ?? [];

export const isPort = (space: string): boolean => portZones(space).length > 0;

export const zonePorts = (zone: SeaZoneID): string[] => SEA_PORTS[zone] ?? [];

export const navalAdjacent = (a: string, b: string): boolean => {
    const aZone = isSeaZone(a);
    const bZone = isSeaZone(b);
    if (aZone && bZone) {
        return seaAdjacent(a as SeaZoneID, b as SeaZoneID);
    }
    if (!aZone && bZone) {
        return portZones(a).includes(b as SeaZoneID);
    }
    if (aZone && !bZone) {
        return portZones(b).includes(a as SeaZoneID);
    }
    return false;
};

export const isFortifiedSpace = (G: VQGame, id: string): boolean => {
    const def = SPACE_BY_ID[id];
    if (def === undefined) {
        return false;
    }
    return def.kind !== "open" || G.spaces[id].fortress;
};

export const capitalOf = (G: VQGame, p: Power): string | undefined => {
    const controlledCap = CAPITAL_SPACES[p].find((id) => {
        const c = G.spaces[id].control;
        return c === p || (isPower(c) && allied(G, p, c));
    });
    if (controlledCap !== undefined) {
        return controlledCap;
    }
    return KEY_SPACES.find((id) => G.spaces[id].control === p);
};

/** Bring leaders waiting in the pool onto the map (Spring Deployment, 10.4). */
export const arriveLeaders = (G: VQGame): void => {
    for (const p of POWERS) {
        const cap = capitalOf(G, p);
        if (cap === undefined || G.spaces[cap] === undefined) {
            continue;
        }
        for (const id of Object.keys(G.leaders)) {
            const def = LEADER_BY_ID[id];
            const st = G.leaders[id];
            if (def === undefined || def.power !== p || st.location !== "pool") {
                continue;
            }
            if (!friendlyControlled(G, p, cap) || G.spaces[cap].unrest) {
                continue;
            }
            G.spaces[cap].leaders.push(id);
            G.leaders[id] = {id, location: cap};
            pushLog(G, `${def.name} arrives in ${SPACE_BY_ID[cap].name}.`);
        }
    }
};

export const isHomeSpace = (id: string, p: Power): boolean =>
    SPACE_BY_ID[id]?.home === p;

export const nearestFriendlyFortified = (G: VQGame, p: Power, from: string): string | undefined => {
    const queue = [from];
    const seen = new Set([from]);
    while (queue.length > 0) {
        const cur = queue.shift() as string;
        if (cur !== from && friendlyControlled(G, p, cur) && isFortifiedSpace(G, cur) && !G.spaces[cur].unrest && !spaceHasEnemyLand(G, p, cur)) {
            return cur;
        }
        for (const n of landNeighbors(cur)) {
            if (seen.has(n.id)) {
                continue;
            }
            const ns = G.spaces[n.id];
            if (!friendlyControlled(G, p, n.id) || ns.unrest || spaceHasEnemyLand(G, p, n.id)) {
                continue;
            }
            seen.add(n.id);
            queue.push(n.id);
        }
    }
    return undefined;
};

export const nearestFriendlyPort = (G: VQGame, p: Power, fromZone: SeaZoneID): string | undefined => {
    for (const port of zonePorts(fromZone)) {
        if (friendlyControlled(G, p, port) && !G.spaces[port].unrest) {
            return port;
        }
    }
    return undefined;
};

/**
 * Line of communication (rules 12.1), simplified to land paths plus one sea
 * hop through a sea zone containing friendly naval units.
 */
export const hasLOC = (G: VQGame, p: Power, target: string): boolean => {
    if (SPACE_BY_ID[target] === undefined) {
        return false;
    }
    const starts: string[] = [];
    for (const def of SPACES) {
        if (friendlyControlled(G, p, def.id) && isFortifiedSpace(G, def.id) && !G.spaces[def.id].unrest) {
            starts.push(def.id);
        }
    }
    const passable = (id: string): boolean =>
        friendlyControlled(G, p, id) && !G.spaces[id].unrest && !spaceHasEnemyLand(G, p, id);
    const queue = starts.slice();
    const seen = new Set<string>(starts);
    while (queue.length > 0) {
        const cur = queue.shift() as string;
        if (cur === target) {
            return true;
        }
        for (const n of landNeighbors(cur)) {
            if (seen.has(n.id)) {
                continue;
            }
            if (n.id === target) {
                return true;
            }
            if (passable(n.id)) {
                seen.add(n.id);
                queue.push(n.id);
            }
        }
    }
    // A single sea hop from a friendly port to the target port.
    const zones = portZones(target);
    for (const z of zones) {
        const friendlyShips = ownersWithNavalInZone(G, z).some((c) => isPower(c) && friendly(G, p, c) && navalCount(G.seaZones[z].naval[c]) > 0);
        if (!friendlyShips) {
            continue;
        }
        for (const port of zonePorts(z)) {
            if (port !== target && passable(port)) {
                return true;
            }
        }
    }
    return false;
};

export const ownersWithNavalInZone = (G: VQGame, zone: SeaZoneID): Controller[] =>
    Object.keys(G.seaZones[zone].naval) as Controller[];

export const canControlSpace = (G: VQGame, p: Power, space: string): { ok: boolean; reason?: string } => {
    const s = G.spaces[space];
    const def = SPACE_BY_ID[space];
    if (s === undefined || def === undefined) {
        return {ok: false, reason: "unknown space"};
    }
    if (isFortifiedSpace(G, space)) {
        return {ok: false, reason: "fortified spaces need a siege"};
    }
    if (s.control === p) {
        return {ok: false, reason: "already controlled"};
    }
    if (spaceHasEnemyLand(G, p, space)) {
        return {ok: false, reason: "enemy units present"};
    }
    if (!hasLOC(G, p, space)) {
        return {ok: false, reason: "no line of communication"};
    }
    const friendlyPresent = ownersWithLand(G, space).some((c) => isPower(c) && friendly(G, p, c) && landCount(G.spaces[space].land[c]) > 0);
    if (friendlyPresent) {
        return {ok: true};
    }
    const adjacentFriendly = landNeighbors(space).some((n) => !n.pass && ownersWithLand(G, n.id).some((c) => isPower(c) && friendly(G, p, c) && landCount(G.spaces[n.id].land[c]) > 0));
    if (!adjacentFriendly) {
        return {ok: false, reason: "no friendly units in or adjacent to the space"};
    }
    const enemyAdjacent = landNeighbors(space).some((n) => !n.pass && spaceHasEnemyLand(G, p, n.id));
    if (enemyAdjacent) {
        return {ok: false, reason: "enemy units adjacent"};
    }
    return {ok: true};
};

// --------------------------------------------------------------------------
// Religion
// --------------------------------------------------------------------------

const PROTESTANT_POWERS: Controller[] = ["england", "protestant", "scotland"];
const CATHOLIC_POWERS: Controller[] = ["spain", "france", "papacy", "portugal", "venice", "ireland"];

export const unitReligion = (c: Controller): Religion | "unaligned" => {
    if (PROTESTANT_POWERS.includes(c)) {
        return "protestant";
    }
    if (CATHOLIC_POWERS.includes(c)) {
        return "catholic";
    }
    return "unaligned";
};

const spaceHasReligionUnits = (G: VQGame, space: string, religion: Religion): boolean => {
    const s = G.spaces[space];
    for (const c of Object.keys(s.land) as Controller[]) {
        if (unitReligion(c) === religion && landCount(s.land[c]) > 0) {
            return true;
        }
    }
    for (const c of Object.keys(s.naval) as Controller[]) {
        if (unitReligion(c) === religion && navalCount(s.naval[c]) > 0) {
            return true;
        }
    }
    return false;
};

export const religionCandidates = (G: VQGame, side: Religion, area: ReligionArea): string[] => {
    const other: Religion = side === "protestant" ? "catholic" : "protestant";
    const inArea = SPACES.filter((s) => s.area === area);
    const remainingOther = inArea.filter((s) => G.spaces[s.id].religion === other).length;
    if (remainingOther <= 1) {
        return [];
    }
    return inArea.filter((s) => {
        const st = G.spaces[s.id];
        if (st.religion !== other || st.unrest) {
            return false;
        }
        // Adjacent (or port-connected) space already of the target religion.
        const adjacent = landNeighbors(s.id).some((n) => G.spaces[n.id].religion === side && !G.spaces[n.id].unrest)
            || (s.ports ?? []).some((z) => zonePorts(z).some((port) => port !== s.id && G.spaces[port].religion === side && !G.spaces[port].unrest));
        if (!adjacent) {
            return false;
        }
        return true;
    }).map((s) => s.id);
};

const pickCandidate = (G: VQGame, ctx: Ctx, side: Religion, area: ReligionArea, allowUnits: boolean): string | undefined => {
    let candidates = religionCandidates(G, side, area);
    if (!allowUnits) {
        candidates = candidates.filter((id) => !spaceHasReligionUnits(G, id, side === "protestant" ? "catholic" : "protestant"));
    }
    if (candidates.length === 0) {
        return undefined;
    }
    // Prefer keys, then randomly among the best.
    const keys = candidates.filter((id) => SPACE_BY_ID[id].kind === "key");
    const pool = keys.length > 0 ? keys : candidates;
    const shuffled = shuffle(ctx, pool.slice());
    return shuffled[0];
};

/**
 * Resolve a batch of conversion attempts (rules 18.5), auto-allocating the
 * dice. Returns a short report for the log.
 */
export const resolveConversions = (
    G: VQGame,
    ctx: Ctx,
    p: Power,
    side: Religion,
    area: ReligionArea,
    attempts: number,
    autoSix = false,
    extraUnrest = 0,
): string => {
    const dice: number[] = [];
    for (let i = 0; i < attempts; i++) {
        dice.push(i === 0 && autoSix ? 6 : die(ctx, 6));
    }
    const ones = dice.filter((d) => d === 1).length;
    const minor = dice.filter((d) => d === 4 || d === 5).length;
    const major = dice.filter((d) => d === 6).length;
    const converted: string[] = [];
    for (let i = 0; i < major; i++) {
        const target = pickCandidate(G, ctx, side, area, true);
        if (target === undefined) {
            break;
        }
        G.spaces[target].religion = side;
        converted.push(target);
    }
    for (let i = 0; i < minor; i++) {
        const target = pickCandidate(G, ctx, side, area, false);
        if (target === undefined) {
            break;
        }
        G.spaces[target].religion = side;
        converted.push(target);
    }
    const unrestTokens = Math.min(ones + extraUnrest, converted.length > 0 ? converted.length : 0);
    for (let i = 0; i < unrestTokens; i++) {
        const target = converted[i % converted.length];
        if (target !== undefined) {
            G.spaces[target].unrest = true;
        }
    }
    G.lastRolls = `${side} conversions in ${AREA_NAMES[area].en}: [${dice.join(", ")}]`;
    pushLog(G, `${powerLabel(p)}: ${G.lastRolls}`);
    if (converted.length > 0) {
        pushLog(G, `Converted: ${converted.map((id) => SPACE_BY_ID[id].name).join(", ")}${unrestTokens > 0 ? `; unrest in ${unrestTokens} space(s)` : ""}.`);
    } else {
        pushLog(G, "No conversions possible.");
    }
    return G.lastRolls;
};

// --------------------------------------------------------------------------
// Battles and sieges
// --------------------------------------------------------------------------

const retreatDestination = (G: VQGame, p: Power, from: string, avoid: string[]): string | undefined => {
    const options = landNeighbors(from)
        .map((n) => n.id)
        .filter((id) => !avoid.includes(id))
        .filter((id) => !G.spaces[id].unrest)
        .filter((id) => !spaceHasEnemyLand(G, p, id))
        .filter((id) => friendlyControlled(G, p, id) || G.spaces[id].control === "independent");
    if (options.length === 0) {
        return undefined;
    }
    // Prefer fortified friendly spaces.
    options.sort((a, b) => Number(isFortifiedSpace(G, b)) - Number(isFortifiedSpace(G, a)));
    return options[0];
};

export const retreatLand = (G: VQGame, p: Power, from: string, owners: Controller[], leaders: string[], captor: Power, avoid: string[] = []): boolean => {
    const dest = retreatDestination(G, p, from, avoid);
    if (dest === undefined) {
        for (const c of owners) {
            delete G.spaces[from].land[c];
        }
        captureLeaders(G, from, owners, captor);
        pushLog(G, `${powerLabel(p)} has no retreat; its force is destroyed.`);
        return false;
    }
    for (const c of owners) {
        const st = G.spaces[from].land[c];
        if (st === undefined) {
            continue;
        }
        const tgt = ensureLand(G, dest, c);
        tgt.regular += st.regular;
        tgt.merc += st.merc;
        tgt.cav += st.cav;
        delete G.spaces[from].land[c];
    }
    moveLeaders(G, from, dest, leaders);
    pushLog(G, `${powerLabel(p)} retreats to ${SPACE_BY_ID[dest].name}.`);
    return true;
};

export interface BattleResult {
    attackerHits: number;
    defenderHits: number;
    attackerDice: number;
    defenderDice: number;
    winner: "attacker" | "defender";
}

export const fieldBattle = (
    G: VQGame,
    ctx: Ctx,
    space: string,
    attacker: Power,
    defenderOwners: Controller[],
    from: string,
): BattleResult => {
    const attackerUnits = totalLand(G, space, [attacker]);
    const defenderUnits = totalLand(G, space, defenderOwners);
    const aDice = attackerUnits + bestBattle(G, space, [attacker], "army");
    const dDice = defenderUnits + bestBattle(G, space, defenderOwners, "army") + 1;
    const aRolls = roll(ctx, aDice);
    const dRolls = roll(ctx, dDice);
    const aHits = hits(aRolls);
    const dHits = hits(dRolls);
    G.lastRolls = `Field battle: ${powerLabel(attacker)} ${aHits} hits (${aDice} dice) vs ${defenderUnits} defenders ${dHits} hits (${dDice} dice)`;
    pushLog(G, G.lastRolls);
    removeLandLosses(G, space, defenderOwners, aHits);
    removeLandLosses(G, space, [attacker], dHits);
    const winner: "attacker" | "defender" = aHits > dHits ? "attacker" : "defender";
    const defenderLeaders = leadersAt(G, space).filter((id) => {
        const def = LEADER_BY_ID[id];
        return def !== undefined && defenderOwners.includes(def.power);
    });
    const attackerLeaders = leadersAt(G, space).filter((id) => LEADER_BY_ID[id]?.power === attacker);

    if (winner === "attacker") {
        const defendersLeft = totalLand(G, space, defenderOwners);
        const attackerLeft = totalLand(G, space, [attacker]);
        if (defendersLeft === 0) {
            captureLeaders(G, space, defenderOwners, attacker);
        } else if (isFortifiedSpace(G, space)) {
            const inside = Math.min(4, defendersLeft);
            pushLog(G, `${inside} defender(s) withdraw into the fortifications.`);
        } else {
            const defenderMajor = defenderOwners.find((c) => isPower(c)) as Power | undefined;
            if (defenderMajor !== undefined) {
                retreatLand(G, defenderMajor, space, defenderOwners, defenderLeaders, attacker, [from]);
            } else {
                // Independent / minor units do not retreat.
                for (const c of defenderOwners) {
                    delete G.spaces[space].land[c];
                }
                pushLog(G, "The independent garrison is destroyed.");
            }
        }
        const defendersAfter = totalLand(G, space, defenderOwners);
        if (isFortifiedSpace(G, space) && attackerLeft > defendersAfter) {
            G.spaces[space].siege = {by: attacker, sinceImpulse: G.impulse};
            pushLog(G, `${SPACE_BY_ID[space].name} is under siege.`);
        } else if (isFortifiedSpace(G, space) && attackerLeft > 0 && defendersAfter > 0 && G.spaces[from] !== undefined) {
            // Not enough troops to besiege: the formation withdraws.
            const st = G.spaces[space].land[attacker];
            if (st !== undefined) {
                const tgt = ensureLand(G, from, attacker);
                tgt.regular += st.regular;
                tgt.merc += st.merc;
                tgt.cav += st.cav;
                delete G.spaces[space].land[attacker];
            }
            moveLeaders(G, space, from, attackerLeaders);
            pushLog(G, `${powerLabel(attacker)} cannot besiege ${SPACE_BY_ID[space].name} and withdraws.`);
        }
    } else {
        // Attacker loses. Survivors return to the space they came from.
        const attackerLeft = totalLand(G, space, [attacker]);
        if (attackerLeft === 0) {
            captureLeaders(G, space, [attacker], defenderOwners.find((c) => isPower(c)) as Power ?? attacker);
        } else if (G.spaces[from] !== undefined) {
            const st = G.spaces[space].land[attacker];
            if (st !== undefined) {
                const tgt = ensureLand(G, from, attacker);
                tgt.regular += st.regular;
                tgt.merc += st.merc;
                tgt.cav += st.cav;
                delete G.spaces[space].land[attacker];
            }
            moveLeaders(G, space, from, attackerLeaders);
            pushLog(G, `${powerLabel(attacker)} retreats to ${SPACE_BY_ID[from].name}.`);
        }
    }
    return {attackerHits: aHits, defenderHits: dHits, attackerDice: aDice, defenderDice: dDice, winner};
};

export const assaultSpace = (G: VQGame, ctx: Ctx, p: Power, space: string): boolean => {
    const s = G.spaces[space];
    const siege = s.siege;
    if (siege === undefined || siege.by !== p) {
        return false;
    }
    const defenders = ownersWithLand(G, space).filter((c) => c !== p && (isPower(c) ? atWar(G, p, c) : true));
    const defendersUnits = totalLand(G, space, defenders);
    const attackerUnits = totalLand(G, space, [p]);
    const aDice = (defendersUnits > 0 ? Math.ceil(attackerUnits / 2) : attackerUnits) + bestBattle(G, space, [p], "army");
    const dDice = defendersUnits + bestBattle(G, space, defenders, "army") + 1;
    const aHits = hits(roll(ctx, aDice));
    const dHits = hits(roll(ctx, dDice));
    G.lastRolls = `Assault on ${SPACE_BY_ID[space].name}: ${aHits} hits (${aDice} dice) vs ${dHits} hits (${dDice} dice)`;
    pushLog(G, G.lastRolls);
    removeLandLosses(G, space, defenders, aHits);
    removeLandLosses(G, space, [p], dHits);
    const defendersLeft = totalLand(G, space, defenders);
    const attackerLeft = totalLand(G, space, [p]);
    if (defendersLeft === 0 && aHits > 0 && attackerLeft > 0) {
        s.control = p;
        delete s.siege;
        // Naval units sheltering in a captured port are eliminated.
        for (const c of ownersWithNaval(G, space)) {
            if (c !== p) {
                delete s.naval[c];
            }
        }
        captureLeaders(G, space, defenders, p);
        pushLog(G, `${powerLabel(p)} captures ${SPACE_BY_ID[space].name}!`);
        return true;
    }
    if (attackerLeft <= defendersLeft) {
        delete s.siege;
        const leaders = leadersAt(G, space).filter((id) => LEADER_BY_ID[id].power === p);
        retreatLand(G, p, space, [p], leaders, isPower(s.control) ? s.control : p);
        pushLog(G, "The siege is broken.");
    } else {
        s.siege = {by: p, sinceImpulse: G.impulse};
    }
    return false;
};

// --------------------------------------------------------------------------
// Rebellion
// --------------------------------------------------------------------------

export const rebellionTargets = (G: VQGame): string[] =>
    SPACES.filter((def) => {
        if (def.area !== "france" && def.area !== "netherlands") {
            return false;
        }
        const s = G.spaces[def.id];
        if (s.religion !== "protestant" || s.siege !== undefined) {
            return false;
        }
        return def.area === "france" ? s.control === "france" : s.control === "spain";
    }).map((d) => d.id);

export const resolveRebellion = (G: VQGame, ctx: Ctx, p: Power, space: string, cp: number): boolean => {
    if (p !== "protestant" || cp < 2 || cp > 5) {
        return false;
    }
    const def = SPACE_BY_ID[space];
    if (def === undefined || (def.area !== "france" && def.area !== "netherlands")) {
        return false;
    }
    const s = G.spaces[space];
    const enemyPower: Power = def.area === "france" ? "france" : "spain";
    if (s.control !== enemyPower || s.religion !== "protestant") {
        return false;
    }
    if (def.area === "france" && allied(G, p, "france")) {
        return false;
    }
    const catholicOwners = ownersWithLand(G, space).filter((c) => unitReligion(c) === "catholic");
    let successful = true;
    if (catholicOwners.length > 0) {
        const diceN = cp + (def.home === "protestant" ? 1 : 0);
        const r = roll(ctx, diceN);
        const hitN = hits(r);
        G.lastRolls = `Rebellion dice: [${r.join(", ")}] = ${hitN} hit(s)`;
        pushLog(G, G.lastRolls);
        let remaining = hitN;
        for (const c of catholicOwners) {
            const st = s.land[c];
            if (st === undefined) {
                continue;
            }
            while (remaining > 0 && st.regular > 0) {
                st.regular -= 1;
                remaining -= 1;
            }
            cleanupLand(G, space, c);
        }
        if (ownersWithLand(G, space).some((c) => unitReligion(c) === "catholic" && landCount(s.land[c]) > 0)) {
            successful = false;
        }
    }
    if (!successful) {
        pushLog(G, "The rebellion fails.");
        return false;
    }
    // Displace non-Catholic units and leaders.
    for (const c of ownersWithLand(G, space)) {
        if (c !== "protestant" && unitReligion(c) !== "catholic") {
            const dest = nearestFriendlyFortified(G, isPower(c) ? c : "spain", space);
            if (dest !== undefined) {
                const st = s.land[c];
                if (st !== undefined) {
                    const tgt = ensureLand(G, dest, c);
                    tgt.regular += st.regular;
                    tgt.merc += st.merc;
                    tgt.cav += st.cav;
                    delete s.land[c];
                }
            }
        }
    }
    s.control = "protestant";
    pushLog(G, `The Protestant seizes ${def.name}.`);
    // Adjacent spaces with Protestant influence.
    let flips = cp;
    for (const n of landNeighbors(space)) {
        if (flips <= 0) {
            break;
        }
        const ns = G.spaces[n.id];
        if (SPACE_BY_ID[n.id].area === def.area && ns.religion === "protestant" && !spaceHasReligionUnits(G, n.id, "catholic")) {
            ns.control = "protestant";
            flips -= 1;
        }
    }
    addLand(G, space, "protestant", "regular", Math.floor(cp / 2));
    if (enemyPower === "france") {
        setWar(G, "protestant", "france");
    } else {
        setWar(G, "protestant", "spain");
    }
    return true;
};

// --------------------------------------------------------------------------
// Winter, marriages, victory
// --------------------------------------------------------------------------

export const resolveMarriages = (G: VQGame, ctx: Ctx): void => {
    for (const b of G.betrothals) {
        const male = G.royals.find((r) => r.id === b.male);
        const female = G.royals.find((r) => r.id === b.female);
        if (male === undefined || female === undefined || !male.alive || !female.alive || male.married || female.married) {
            continue;
        }
        const d1 = die(ctx, 6);
        const d2 = die(ctx, 6);
        const total = d1 + d2;
        G.lastRolls = `Marriage roll: ${d1}+${d2}=${total}`;
        pushLog(G, `${male.name} & ${female.name}: ${G.lastRolls}`);
        if (total <= 4) {
            pushLog(G, "The marriage negotiations fail.");
        } else if (total <= 10) {
            const vp = total >= 9 ? 2 : 1;
            addVp(G, male.power, vp);
            addVp(G, female.power, vp);
            male.married = true;
            female.married = true;
            G.marriages += 1;
            pushLog(G, `A marriage is celebrated (+${vp} VP each).`);
        } else if (total === 11) {
            female.alive = false;
            pushLog(G, `Tragedy: ${female.name} dies in childbirth.`);
        } else {
            male.alive = false;
            pushLog(G, `Tragedy: ${male.name} is murdered.`);
        }
    }
    G.betrothals = [];
};

export const winter = (G: VQGame, ctx: Ctx): void => {
    resolveMarriages(G, ctx);
    for (const p of POWERS) {
        // Land units outside friendly fortified quarters return home.
        for (const def of SPACES) {
            const s = G.spaces[def.id];
            const stack = s.land[p];
            if (stack === undefined || landCount(stack) === 0) {
                continue;
            }
            const friendlyHere = s.control === p || (isPower(s.control) && allied(G, p, s.control));
            if (isFortifiedSpace(G, def.id) && friendlyHere && !s.unrest) {
                continue;
            }
            const dest = nearestFriendlyFortified(G, p, def.id);
            if (dest === undefined || dest === def.id) {
                pushLog(G, `${powerLabel(p)} loses ${landCount(stack)} unit(s) to winter attrition in ${def.name}.`);
                delete s.land[p];
                continue;
            }
            const tgt = ensureLand(G, dest, p);
            tgt.regular += stack.regular;
            tgt.merc += stack.merc;
            tgt.cav += stack.cav;
            delete s.land[p];
            const armyLeaders = s.leaders.filter((id) => LEADER_BY_ID[id]?.power === p && LEADER_BY_ID[id]?.kind === "army");
            moveLeaders(G, def.id, dest, armyLeaders);
            pushLog(G, `${powerLabel(p)} withdraws ${landCount(stack)} unit(s) from ${def.name} to ${SPACE_BY_ID[dest].name}.`);
        }
        // Replacements at each controlled capital.
        for (const cap of CAPITAL_SPACES[p]) {
            const s = G.spaces[cap];
            if ((s.control === p || (isPower(s.control) && allied(G, p, s.control))) && !s.unrest && s.siege === undefined) {
                addLand(G, cap, p, "regular", 1);
            }
        }
        G.powers[p].allies = [];
        G.powers[p].treasures = [];
        G.powers[p].cp = 0;
        G.powers[p].cardPlayed = false;
        G.powers[p].passed = false;
        G.powers[p].influence = {};
    }
    // Sieges with no besieging force left are lifted.
    for (const def of SPACES) {
        const s = G.spaces[def.id];
        if (s.siege === undefined) {
            continue;
        }
        const besiegers = totalLand(G, def.id, [s.siege.by]);
        const defenders = totalLand(G, def.id, ownersWithLand(G, def.id).filter((c) => c !== s.siege?.by) as Controller[]);
        if (besiegers === 0 || besiegers <= defenders) {
            delete s.siege;
        }
    }
    // The Virgin Queen bonus: +1 VP to England for each year Elizabeth is unmarried.
    const elizabeth = G.royals.find((r) => r.id === "elizabeth");
    if (elizabeth !== undefined && elizabeth.alive && !elizabeth.married) {
        addVp(G, "england", 1);
        pushLog(G, "Elizabeth I remains unmarried: England gains 1 Virgin Queen VP.");
    }
    for (const r of G.royals) {
        if (r.alive) {
            r.age += 1;
        }
    }
    G.vpHistory[String(G.year)] = Object.fromEntries(POWERS.map((p) => [p, powerVp(G, p)]));
    G.year += 1;
    G.checkVictory = true;
    G.impulse = 0;
    pushLog(G, `Winter ends. Turn ${G.year} begins.`);
};

export const checkImmediateVictory = (G: VQGame): { winner: Power; reason: string } | undefined => {
    const n = protestantSpaceCount(G);
    if (n >= 18) {
        return {winner: "protestant", reason: "protestantReligious"};
    }
    if (n <= 3) {
        const franceAndScotland = protestantSpacesInArea(G, "france") + protestantSpacesInArea(G, "scotland");
        return {winner: franceAndScotland <= 2 ? "france" : "spain", reason: "catholicReligious"};
    }
    for (const p of POWERS) {
        const keys = p === "protestant" ? protestantKeysOutsideNetherlands(G).length : controlledKeys(G, p).length;
        if (keys >= POWER_INFO[p].autoWinKeys) {
            return {winner: p, reason: "military"};
        }
    }
    return undefined;
};

export const checkVictory = (G: VQGame): { winner: Power; reason: string } | undefined => {
    const immediate = checkImmediateVictory(G);
    if (immediate !== undefined) {
        return immediate;
    }
    const standings = victoryStandings(G);
    const top = standings[0];
    const second = standings[1];
    const tiedWinner = (): Power => {
        const tied = standings.filter((s) => s.vp === top.vp);
        if (tied.length === 1) {
            return top.power;
        }
        for (let year = G.year - 1; year >= 1; year--) {
            const hist = G.vpHistory[String(year)];
            if (hist === undefined) {
                continue;
            }
            const best = Math.max(...tied.map((t) => hist[t.power] ?? 0));
            const leaders = tied.filter((t) => (hist[t.power] ?? 0) === best);
            if (leaders.length === 1) {
                return leaders[0].power;
            }
        }
        return top.power;
    };
    if (G.year > 7) {
        return {winner: tiedWinner(), reason: "timeLimit"};
    }
    if (!G.checkVictory) {
        return undefined;
    }
    if (top.vp >= 25) {
        return {winner: tiedWinner(), reason: "standard"};
    }
    if (G.year >= 4 && top.vp - second.vp >= 5) {
        return {winner: top.power, reason: "domination"};
    }
    return undefined;
};

// --------------------------------------------------------------------------
// Events
// --------------------------------------------------------------------------

export const resolveEvent = (G: VQGame, ctx: Ctx, p: Power, effect: CardDef["effect"]): void => {
    if (effect === undefined) {
        return;
    }
    const effects = Array.isArray(effect) ? effect : [effect];
    for (const e of effects) {
        resolveOneEvent(G, ctx, p, e);
    }
};

const resolveOneEvent = (G: VQGame, ctx: Ctx, p: Power, e: EventEffect): void => {
    switch (e.kind) {
        case "conversion":
            resolveConversions(G, ctx, p, e.side, e.area, e.dice, e.autoSix, e.unrest ?? 0);
            break;
        case "unrestSpanish": {
            const candidates = SPACES.filter((s) => s.home === "spain" && !G.spaces[s.id].unrest);
            const picked = shuffle(ctx, candidates.map((s) => s.id)).slice(0, e.count);
            for (const id of picked) {
                G.spaces[id].unrest = true;
                pushLog(G, `Unrest in ${SPACE_BY_ID[id].name}.`);
            }
            break;
        }
        case "unrestArea": {
            const candidates = SPACES.filter((s) => s.area === e.area && !G.spaces[s.id].unrest);
            const picked = shuffle(ctx, candidates.map((s) => s.id)).slice(0, e.count);
            for (const id of picked) {
                G.spaces[id].unrest = true;
                pushLog(G, `Unrest in ${SPACE_BY_ID[id].name}.`);
            }
            break;
        }
        case "draw": {
            const drawn = drawCards(G, ctx, p, e.count);
            pushLog(G, `${powerLabel(p)} draws ${drawn.length} card(s).`);
            break;
        }
        case "treasure":
            addTreasure(G, ctx, p, e.count);
            pushLog(G, `${powerLabel(p)} gains ${e.count} treasure(s).`);
            break;
        case "vp": {
            const target = e.power ?? p;
            if (e.condition === "unmarriedElizabeth") {
                const elizabeth = G.royals.find((r) => r.id === "elizabeth");
                if (elizabeth === undefined || !elizabeth.alive || elizabeth.married) {
                    break;
                }
            }
            if (e.condition === "atWarEngland" && target === "spain" && !atWar(G, "spain", "england")) {
                break;
            }
            if (e.condition === "controlsDutchKeys" && target === "spain") {
                if (!DUTCH_KEYS.every((id) => G.spaces[id].control === "spain")) {
                    break;
                }
            }
            addVp(G, target, e.amount);
            pushLog(G, `${powerLabel(target)} gains ${e.amount} VP.`);
            break;
        }
        case "mercs": {
            const cap = capitalOf(G, p);
            if (cap !== undefined && friendlyControlled(G, p, cap) && !G.spaces[cap].unrest) {
                addLand(G, cap, p, "merc", e.count);
                pushLog(G, `${powerLabel(p)} raises ${e.count} mercenary unit(s) in ${SPACE_BY_ID[cap].name}.`);
            }
            break;
        }
        case "dowCost":
            G.doWCostEnglandSpain = Math.max(1, G.doWCostEnglandSpain + e.amount);
            pushLog(G, `England-Spain war cost is now ${G.doWCostEnglandSpain} CP.`);
            break;
        case "suez": {
            if (G.suezDone) {
                break;
            }
            const r = die(ctx, 6);
            const total = r + G.suezAttempts;
            G.lastRolls = `Suez Canal attempt: ${r} + ${G.suezAttempts} = ${total}`;
            pushLog(G, G.lastRolls);
            if (total >= 6) {
                G.suezDone = true;
                addVp(G, "ottoman", 2);
                G.powers.ottoman.cardModifier += 1;
                pushLog(G, "The Suez Canal is completed! Ottoman gains 2 VP and +1 card.");
            } else {
                G.suezAttempts += 1;
            }
            break;
        }
        case "armada": {
            const port = ["seville", "corunna"].find((id) => G.spaces[id].control === "spain") ?? "seville";
            addNaval(G, port, "spain", "galleon", 2);
            addVp(G, "spain", 1);
            pushLog(G, `The Armada is reinforced with 2 galleons in ${SPACE_BY_ID[port].name} (+1 VP).`);
            break;
        }
        case "discard": {
            const hand = G.powers[p].cards.filter((id) => cardById(id).kind !== "home");
            const picked = shuffle(ctx, hand).slice(0, e.count);
            for (const id of picked) {
                removeCardFromHand(G, p, id);
                discardCard(G, p, id, false);
            }
            pushLog(G, `${powerLabel(p)} discards ${picked.length} card(s).`);
            break;
        }
        case "influence": {
            const minor = MINOR_POWERS.find((m) => (G.powers[p].influence[m] ?? 0) < 9) ?? "papacy";
            G.powers[p].influence[minor] = (G.powers[p].influence[minor] ?? 0) + e.count;
            pushLog(G, `${powerLabel(p)} gains ${e.count} influence with ${minor}.`);
            break;
        }
        default:
            break;
    }
};

export const patronTaken = (G: VQGame, id: string): boolean =>
    POWERS.some((p) => G.powers[p].patrons.includes(id));
