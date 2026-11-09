import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {Controller, NavalStack, Power, POWERS, VQGame, isPower, navalCount, spaceHomes} from "./constant/general";
import {LEADER_BY_ID} from "./constant/leaders";
import {cardById} from "./constant/cards";
import i18n from "../constant/i18n";
import {LAND_NEIGHBORS, SEA_ZONE_BY_ID, SPACE_BY_ID, SPACES, mapName} from "./mapData";
import {actingPower, isActivatedMajor, ownerOf, participatingPowers} from "./ownership";
import {assassinationResult, catholicRebellionResult} from "./data/espionage";
import {EspionageState, PendingEspionage} from "./espionageTypes";
import {addLand, addVp, allied, atWar, capitalOf, discardCard, drawCards, ensureLand, ensureNaval,
    ensureDefaultLeader, hits, isFortifiedSpace, pushLog, removeCardFromHand, removeCardFromGame,
    removePragueCulturalCenterOnRudolfDeath, roll, setWar, shuffle, unitReligion, zonePorts} from "./util";

export const espionageState = (G: VQGame): EspionageState => G.espionage ??= {
    jesuits: [], jesuitsOnCard: G.scenario === "tournament" ? 1 : 0, douai: false,
    mary: G.scenario === "tournament" ? "captured" : "scotland", cipherKeys: {}, nextDraw: {}, inspections: [],
};
export const espionageAvailable = (G: VQGame): boolean => G.scenario !== "tutorial" && G.year >= 3;
export const activeInformant = (G: VQGame, owner: Power, target: Power): boolean => G.informants.some((i) =>
    i.owner === owner && i.target === target && !i.neutralized && i.plantedImpulse < G.impulse);
const crypto = (G: VQGame, p: Power, target: Power): number =>
    G.powers[p].scienceBonuses.includes("cryptography") || G.espionage?.cipherKeys[p] === target ? 1 : 0;
const maryAlive = (G: VQGame): boolean => G.espionage?.mary !== "dead" &&
    G.royals.find((r) => r.id === "maryScots")?.alive !== false;

/**
 * Canonical assassination target for Rudolf.  The Scenario Book pool uses
 * `rudolfII`; the initial pool uses `rudolf`.  Assassination and Prague
 * cleanup must treat the two spellings as the same person.
 */
export const rudolfRoyal = (G: VQGame): {id: string} | undefined =>
    G.royals.find((r) => r.id === "rudolf" && r.alive) ?? G.royals.find((r) => r.id === "rudolfII" && r.alive);

export const assassinationTargets = (G: VQGame, p: Power): string[] => [
    ...(p !== "england" && G.royals.some((r) => r.id === "elizabeth" && r.alive) ? ["elizabeth"] : []),
    // #35 FAQ: Rudolf's death (like Elizabeth's) has ruler effects, so he
    // is an assassination-eligible royal; he can only die that way (and
    // through the marriage table), never as an army leader.
    ...(p !== "hre" && rudolfRoyal(G) !== undefined ? [rudolfRoyal(G)!.id] : []),
    ...Object.keys(G.leaders).filter((id) => {
        const def = LEADER_BY_ID[id];
        const loc = G.leaders[id].location;
        // 19.3: default army leaders are not eligible targets.
        return def?.kind === "army" && !id.startsWith("default-") && def.power !== p &&
            !isActivatedMajor(G, def.power) && !!G.spaces[loc] && G.spaces[loc].leaders.includes(id);
    }),
];

const isRudolfTarget = (target: string | undefined): boolean => target === "rudolf" || target === "rudolfII";

export const espionageDice = (G: VQGame, pending: PendingEspionage): {attack: number; defense: number} => {
    const {power: p, targetPower: target, kind} = pending;
    const informant = activeInformant(G, p, target) ? 2 : 0;
    let attack = (kind === "intelligence" ? 2 : pending.cp) + informant + crypto(G, p, target) + (pending.attackBonus ?? 0);
    if (kind === "intelligence") return {attack, defense: 0};
    let defense = (kind === "rebellion" ? 5 : 1) + crypto(G, target, p);
    if (kind === "assassination") {
        if (pending.target === "elizabeth") {
            attack += maryAlive(G) ? 1 : 0;
            defense += 3;
        } else if (isRudolfTarget(pending.target)) {
            // Rudolf is a royal, not an army leader: defend him like a
            // ruler (base defense + a home-capital bonus, no battle rating).
            if (SPACE_BY_ID["prague"]?.home === target && G.spaces["prague"].control === target) defense++;
        } else {
            const def = LEADER_BY_ID[pending.target!];
            defense += def?.battle ?? 0;
            const loc = G.leaders[pending.target!]?.location;
            if (loc !== undefined && SPACE_BY_ID[loc]?.home === target && G.spaces[loc].control === target) defense++;
        }
    } else {
        attack += G.espionage?.jesuits.length ?? 0;
        if (maryAlive(G) || G.espionage?.maryBonusTurn === G.year) attack += 3;
        if (SPACES.some((s) => (spaceHomes(s).includes("ireland") || s.area === "scotland") && (G.spaces[s.id].land.spain?.regular ?? 0) > 0)) attack += 2;
        if (SPACES.some((s) => s.area === "england" && (G.spaces[s.id].land.spain?.regular ?? 0) > 0)) attack += 4;
    }
    return {attack, defense};
};

const inspect = (G: VQGame, viewer: Power, target: Power): void => {
    const state = espionageState(G);
    state.inspections = state.inspections.filter((i) => i.viewer !== viewer || i.target !== target);
    state.inspections.push({viewer, target, cards: [...G.powers[target].cards]});
    pushLog(G, `${viewer} secretly inspects ${target}'s hand.`);
};

/** Random losses use the larger pool; treasures win ties (6.3). Home cards cannot be lost. */
const randomDiscard = (G: VQGame, ctx: Ctx, p: Power, allowTreasure: boolean): void => {
    const cards = G.powers[p].cards.filter((id) => cardById(id).kind !== "home");
    const treasures = G.powers[p].treasures;
    const kind = allowTreasure && treasures.length > 0 && treasures.length >= G.powers[p].cards.length ? "treasure" : "card";
    if (kind === "treasure") {
        const index = shuffle(ctx, treasures.map((_, i) => i))[0];
        treasures.splice(index, 1);
        pushLog(G, `${p} discards a random treasure.`);
    } else if (cards.length) {
        const id = shuffle(ctx, cards)[0];
        removeCardFromHand(G, p, id);
        discardCard(G, p, id, false);
        pushLog(G, `${p} discards ${cardById(id).name}.`);
    }
};

const spend = (G: VQGame, p: Power, cp: number): void => {
    G.powers[p].cp -= cp;
    G.powers[p].passed = false;
    G.consecutivePasses = 0;
};
const stage = (G: VQGame, ctx: Ctx, responding: Power): void => {
    G.pendingEspionage!.responding = responding;
    ctx.events?.setActivePlayers({value: {[ownerOf(G, responding)!]: "espionageChoice"}});
};
const finish = (G: VQGame, ctx: Ctx): void => {
    const p = G.pendingEspionage!;
    // #81 was played as a nested response; restore the interrupted action and
    // finish the neutralization it was responding to before ending the stage.
    if (p.walsinghamReturn !== undefined) {
        const outer = p.walsinghamReturn;
        const choice = outer.walsinghamChoice!;
        const step = outer.walsinghamStep!;
        delete p.walsinghamReturn;
        delete outer.walsinghamChoice;
        delete outer.walsinghamStep;
        resumeWalsinghamOuter(G, ctx, outer, choice, step);
        return;
    }
    const deferred = p.deferredEvent;
    delete G.pendingEspionage;
    // A card event which launched this Espionage action (for example #80 The
    // Black Queen) resolves its remaining printed effect only now, so a nested
    // #81 response cannot lose or duplicate it.
    if (deferred !== undefined) {
        if (deferred.draw !== undefined) drawCards(G, ctx, deferred.power, deferred.draw);
        if (deferred.log !== undefined) pushLog(G, deferred.log);
    }
    ctx.events?.endStage();
};
const neutralizeInformant = (G: VQGame, owner: Power, target: Power): void => {
    const i = G.informants.find((i) => i.owner === owner && i.target === target && !i.neutralized);
    if (i) i.neutralized = true;
};
/** Localized display name for a unit kind used inside option labels. */
const unitName = (kind: string): string => {
    switch (kind) {
        case "regular": return i18n.chain.vq.engine.unitRegular;
        case "merc": return i18n.chain.vq.engine.unitMerc;
        case "cav": return i18n.chain.vq.engine.unitCav;
        case "galley": return i18n.chain.vq.engine.unitGalley;
        case "galleon": return i18n.chain.vq.engine.unitGalleon;
        case "racebuilt": return i18n.chain.vq.engine.unitRacebuilt;
        case "corsair": return i18n.chain.vq.engine.unitCorsair;
        default: return kind;
    }
};

const operativeOptions = (G: VQGame, p: PendingEspionage, extra = false): {id: string; label: string}[] => p.event === "richardTopcliffe" ?
    (G.espionage?.jesuits ?? []).filter((id) => !p.neutralizedOperatives?.includes(`jesuit:${id}`)).map((id) => ({id: `jesuit:${id}`, label: i18n.chain.vq.engine.neutralizeJesuit.replace("{space}", mapName(id))})) : [
    ...G.informants.filter((i) => i.target === p.power && !i.neutralized && (extra || p.kind === "walsingham" || i.owner === p.targetPower))
        .map((i) => ({id: `informant:${i.owner}`, label: i18n.chain.vq.engine.neutralizeSpy.replace("{owner}", i.owner)})),
    ...(p.power === "england" && (p.kind === "walsingham" || p.targetPower === "spain") ? (G.espionage?.jesuits ?? []).filter((id) => !p.neutralizedOperatives?.includes(`jesuit:${id}`))
        .map((id) => ({id: `jesuit:${id}`, label: i18n.chain.vq.engine.neutralizeJesuit.replace("{space}", mapName(id))})) : []),
];

const responseOptions = (G: VQGame, p: PendingEspionage): {id: string; label: string}[] => {
    const cards = G.powers[p.responding].cards;
    return [
        {id: "continue", label: i18n.chain.vq.engine.continueRoll},
        ...(cards.includes("vq-081") && !G.espionage?.walsingham ? [
            {id: "walsingham:offensive", label: i18n.chain.vq.engine.walsinghamOffensive},
            {id: "walsingham:defensive", label: i18n.chain.vq.engine.walsinghamDefensive},
        ] : []),
        ...(p.kind === "assassination" && cards.includes("vq-088") && !p.used.includes("pistols") ?
            [{id: "pistols", label: i18n.chain.vq.engine.pistols}] : []),
        ...((p.kind === "rebellion" || p.kind === "assassination" && p.target === "elizabeth") &&
        cards.includes("vq-089") && maryAlive(G) && !p.used.includes("maryCard") ?
            [{id: "maryCard", label: i18n.chain.vq.engine.maryQueenOfScots}] : []),
    ];
};

const finishOrMary = (G: VQGame, ctx: Ctx): void => {
    const p = G.pendingEspionage!;
    if ((p.kind === "rebellion" || p.target === "elizabeth") && espionageState(G).mary === "captured") {
        p.step = "mary";
        stage(G, ctx, "england");
    } else finish(G, ctx);
};
const executeMary = (G: VQGame): void => {
    const state = espionageState(G);
    state.mary = "dead";
    const royal = G.royals.find((r) => r.id === "maryScots");
    if (royal) {royal.alive = false; royal.status = "dead";}
    addVp(G, "england", -1);
    G.doWCostEnglandSpain = Math.max(1, G.doWCostEnglandSpain - 3);
    pushLog(G, "England executes Mary Queen of Scots (−1 VP).");
};

const attackHits = (G: VQGame, p: PendingEspionage, dice: number[]): number => dice.filter((d) =>
    d >= (p.targetPower === "england" && G.espionage?.walsingham === "defensive" ? 6 :
        p.power === "england" && G.espionage?.walsingham === "offensive" ? 4 : 5)).length;

const startConversions = (G: VQGame, ctx: Ctx, rebellion: boolean, side: "catholic" | "protestant" = "catholic", attempts = 6): void => {
    const p = G.pendingEspionage!;
    p.step = "conversions";
    p.rebellionAfterConversions = rebellion;
    p.conversionSide = side;
    p.conversionDice = roll(ctx, attempts);
    p.unrest = p.conversionDice.includes(1);
    p.conversionDice = p.conversionDice.filter((d) => d >= 4).sort((a, b) => b - a);
    p.converted = [];
    p.conversionBase = SPACES.filter((s) => G.spaces[s.id].religion === side && !G.spaces[s.id].unrest).map((s) => s.id);
    stage(G, ctx, p.power);
};

const resolveRoll = (G: VQGame, ctx: Ctx): void => {
    const p = G.pendingEspionage!;
    const count = espionageDice(G, p);
    p.attack = roll(ctx, count.attack);
    p.defense = roll(ctx, count.defense);
    const a = attackHits(G, p, p.attack), d = hits(p.defense), diff = a - d;
    G.lastRolls = `${p.kind === "intelligence" ? "Gain Intelligence" : p.kind}: ${count.attack} dice [${p.attack.join(", ")}] = ${a} hits; defense ${count.defense} [${p.defense.join(", ")}] = ${d} hits`;
    pushLog(G, G.lastRolls);
    if (p.kind === "intelligence") {
        p.step = "offense"; p.remaining = a;
        if (a) stage(G, ctx, p.power); else finish(G, ctx);
        return;
    }
    if (p.kind === "assassination") {
        const battleRating = p.target === "elizabeth" ? 2 : isRudolfTarget(p.target) ? 0 : LEADER_BY_ID[p.target!]?.battle ?? 0;
        const result = assassinationResult(diff, battleRating);
        if (result.reroll) {
            // A new response window also avoids an unbounded synchronous reroll loop.
            p.step = "responses"; p.responseQueue = [p.power]; stage(G, ctx, p.power);
            return;
        }
        if (result.discard) randomDiscard(G, ctx, p.targetPower, true);
        if (result.killed) {
            if (p.target === "elizabeth") {
                const royal = G.royals.find((r) => r.id === "elizabeth")!;
                royal.alive = false; royal.status = "dead";
                G.powers.england.ruler = "elizabethDead";
                G.removed.push(...["vq-036", "vq-home-virgin-queen"].filter((id) => !G.removed.includes(id)));
                G.powers.england.cards = G.powers.england.cards.filter((id) => !G.removed.includes(id));
                if (espionageState(G).mary === "captured") {executeMary(G); espionageState(G).maryBonusTurn = G.year;}
            } else if (isRudolfTarget(p.target)) {
                // #35 FAQ: Rudolf's death removes the +2 Prague Cultural
                // Center marker.  (He is not an army leader, so a direct
                // assassination uses the royal-kill branch rather than the
                // leader branch below.)  Match either spelling so the
                // Scenario Book pool (`rudolfII`) and the initial pool
                // (`rudolf`) both die.
                const royal = G.royals.find((r) => r.id === "rudolf" || r.id === "rudolfII");
                if (royal !== undefined) {royal.alive = false; royal.status = "dead"; royal.id = p.target === "rudolfII" && royal.id === "rudolf" ? "rudolf" : royal.id;}
                removePragueCulturalCenterOnRudolfDeath(G);
                pushLog(G, "Rudolf II is assassinated; the Holy Roman Empire drops to 1 Admin and 0 card bonus.");
            } else {
                const loc = G.leaders[p.target!].location;
                G.spaces[loc].leaders = G.spaces[loc].leaders.filter((id) => id !== p.target);
                G.leaders[p.target!].location = "offMap";
                // Off-map assassinated leaders never return in Spring.
                G.leaders[p.target!].returnTurn = 99;
                if (p.target === "dragut") removeCardFromGame(G, "vq-011");
                const deadDef = LEADER_BY_ID[p.target!];
                if (deadDef?.kind === "army") ensureDefaultLeader(G, deadDef.power);
                // Rule 21.4: an assassinated Henry III cancels any betrothal.
                if (p.target === "henryIII") {
                    const royal = G.royals.find((r) => r.id === "henryIII");
                    if (royal !== undefined) { royal.alive = false; royal.status = "dead"; }
                    G.betrothals = G.betrothals.filter((b) => b.male !== "henryIII" && b.female !== "henryIII");
                }
            }
            addVp(G, p.power, 1);
            pushLog(G, `${p.target} killed; ${p.power} gains 1 VP.`);
            finish(G, ctx);
        } else if (result.defensiveActions) {
            p.step = "defense"; p.remaining = result.defensiveActions; stage(G, ctx, p.targetPower);
        } else {
            if (result.neutralize && activeInformant(G, p.power, p.targetPower)) neutralizeInformant(G, p.power, p.targetPower);
            finishOrMary(G, ctx);
        }
        return;
    }
    const result = catholicRebellionResult(diff);
    pushLog(G, `English Catholic Rebellion: ${result}.`);
    if (result === "victory") {espionageState(G).catholicRebellionVictory = true; finish(G, ctx);}
    else if (result === "conversions" || result === "conversionsAndRebellion") startConversions(G, ctx, result === "conversionsAndRebellion");
    else {
        if (result === "inspectEngland") inspect(G, "spain", "england");
        else {
            for (const i of G.informants.filter((i) => i.target === "england")) i.neutralized = true;
            espionageState(G).jesuits = [];
            if (result === "inspectSpain") inspect(G, "england", "spain");
            if (result === "minusCard") espionageState(G).nextDraw.spain = (espionageState(G).nextDraw.spain ?? 0) - 1;
        }
        finishOrMary(G, ctx);
    }
};

const beginResponses = (G: VQGame, ctx: Ctx): void => {
    const p = G.pendingEspionage!;
    p.responseQueue = participatingPowers(G).filter((power) => {
        const test = {...p, responding: power};
        return responseOptions(G, test).length > 1;
    });
    if (p.responseQueue.length) {p.step = "responses"; stage(G, ctx, p.responseQueue[0]);}
    else resolveRoll(G, ctx);
};

export const startEspionage = (G: VQGame, ctx: Ctx, kind: "intelligence" | "assassination" | "rebellion", args: {target?: string; cp?: number; event?: string; deferredEvent?: PendingEspionage["deferredEvent"]}): void | typeof INVALID_MOVE => {
    const power = actingPower(G, ctx.currentPlayer);
    const cp = kind === "intelligence" ? 2 : args.cp!;
    const isRudolf = kind === "assassination" && isRudolfTarget(args.target);
    const targetPower = kind === "intelligence" ? args.target as Power : kind === "rebellion" || args.target === "elizabeth" ? "england" :
        isRudolf ? "hre" : LEADER_BY_ID[args.target!]?.power;
    if (ctx.phase !== "action" || !espionageAvailable(G) || isActivatedMajor(G, power) || !isPower(targetPower) || targetPower === power ||
        !ownerOf(G, targetPower) || isActivatedMajor(G, targetPower) || G.pendingEspionage ||
        !Number.isInteger(cp) || cp < (kind === "rebellion" ? 3 : 2) || cp > (kind === "rebellion" ? 5 : kind === "assassination" ? 4 : 2) ||
        G.powers[power].cp < cp || kind !== "intelligence" && G.assassinationUsed.includes(power) ||
        kind === "rebellion" && (power !== "spain" || (allied(G, "england", "spain") || allied(G, "spain", "england"))) ||
        kind === "assassination" && !assassinationTargets(G, power).includes(args.target!)) return INVALID_MOVE;
    espionageState(G);
    spend(G, power, cp);
    if (kind !== "intelligence") G.assassinationUsed.push(power);
    G.pendingEspionage = {kind, power, targetPower, target: args.target, cp, responding: power, step: "responses", remaining: 0, used: [],
        ...(args.event !== undefined ? {event: args.event} : {}),
        ...(args.deferredEvent !== undefined ? {deferredEvent: args.deferredEvent} : {})};
    beginResponses(G, ctx);
};

export const plantOperative = (G: VQGame, ctx: Ctx, args: {target?: Power; space?: string; fromTarget?: Power}): void | typeof INVALID_MOVE => {
    const power = actingPower(G, ctx.currentPlayer);
    if (ctx.phase !== "action" || !espionageAvailable(G) || isActivatedMajor(G, power) || G.powers[power].cp < 2 || G.pendingEspionage) return INVALID_MOVE;
    if (args.space !== undefined) {
        if (args.target !== undefined || power !== "spain" || SPACE_BY_ID[args.space]?.area !== "england" ||
            (G.espionage?.jesuitsOnCard ?? 0) < 1 || G.espionage?.jesuits.includes(args.space)) return INVALID_MOVE;
        spend(G, power, 2);
        espionageState(G).jesuitsOnCard--;
        espionageState(G).jesuits.push(args.space);
        pushLog(G, `Spain plants a Jesuit in ${SPACE_BY_ID[args.space].name}.`);
        return;
    }
    const target = args.target;
    if ((target === undefined || !isPower(target)) || target === power || !ownerOf(G, target) || isActivatedMajor(G, target) ||
        G.informants.some((i) => i.owner === power && i.target === target)) return INVALID_MOVE;
    const own = G.informants.filter((i) => i.owner === power);
    const moving = own.find((i) => i.target === args.fromTarget && !i.neutralized);
    if (args.fromTarget !== undefined && !moving || own.length >= 2 && !moving) return INVALID_MOVE;
    spend(G, power, 2);
    if (moving) {moving.target = target; moving.plantedImpulse = G.impulse;}
    else G.informants.push({owner: power, target, plantedImpulse: G.impulse, neutralized: false});
    pushLog(G, `${power} plants an informant on ${target}.`);
};

export const englishRebellionTargets = (G: VQGame): string[] => SPACES.filter((s) => s.area === "england" &&
    G.spaces[s.id].control === "england" && G.spaces[s.id].religion === "catholic" &&
    !G.spaces[s.id].siege && !G.spaces[s.id].unrest).map((s) => s.id);

const protestantUnits = (G: VQGame, id: string, englishOnly = false): {id: string; label: string}[] => {
    const s = G.spaces[id];
    const controllers = Object.keys({...s.land, ...s.naval}) as Controller[];
    return controllers.filter((c) => unitReligion(c) === "protestant" && (!englishOnly || c === "england" || !isPower(c) && G.powers.england.alliedMinors.includes(c as any))).flatMap((c) => [
        ...((s.land[c]?.regular ?? 0) > 0 ? [{id: `regular:${c}`, label: i18n.chain.vq.engine.removeUnits.replace("{owner}", c).replace("{unit}", i18n.chain.vq.engine.unitRegular)}] : []),
        ...Object.entries(s.naval[c] ?? {}).filter(([, n]) => n > 0).map(([kind]) => ({id: `${kind}:${c}`, label: i18n.chain.vq.engine.removeUnits.replace("{owner}", c).replace("{unit}", unitName(kind))})),
    ]);
};

const adjacentConversions = (G: VQGame, id: string, base: string[]): boolean =>
    LAND_NEIGHBORS[id].some((n) => base.includes(n.id)) || (SPACE_BY_ID[id].ports ?? []).some((z) => zonePorts(z).some((port) => port !== id && base.includes(port)));
const conversionOptions = (G: VQGame, p: PendingEspionage): {id: string; label: string}[] => {
    const dice = p.conversionDice ?? [];
    const opts = [{id: "conversionsDone", label: i18n.chain.vq.engine.finishConversions}];
    const side = p.conversionSide ?? "catholic";
    if (SPACES.filter((s) => s.area === "england" && G.spaces[s.id].religion !== side).length <= 1) return opts;
    for (const d of [...new Set(dice)]) {
        for (const s of SPACES.filter((s) => s.area === "england")) {
            const side = p.conversionSide ?? "catholic";
            const opposing = side === "catholic" ? protestantUnits(G, s.id).length > 0 :
                G.espionage?.jesuits.includes(s.id) || Object.keys({...G.spaces[s.id].land, ...G.spaces[s.id].naval}).some((c) =>
                    unitReligion(c as Controller) === "catholic" && ((G.spaces[s.id].land[c as Controller]?.regular ?? 0) > 0 || navalCount(G.spaces[s.id].naval[c as Controller]) > 0));
            if (G.spaces[s.id].religion === side || !adjacentConversions(G, s.id, p.conversionBase ?? []) ||
                d !== 6 && opposing) continue;
            opts.push({id: `convert:${d}:${s.id}`, label: i18n.chain.vq.engine.conversionPoints.replace("{points}", String(d)).replace("{space}", mapName(s.id))});
            // Expanding the base is legal only without opposing units; it consumes this major.
            if (d === 6 && !p.used.includes("remainingConversions") && !opposing) opts.push({id: `expand:${s.id}`, label: (side === "catholic" ? i18n.chain.vq.engine.expandCatholicBase : i18n.chain.vq.engine.expandProtestantBase).replace("{space}", mapName(s.id))});
        }
    }
    if (p.unrest && dice.includes(6)) opts.push({id: "cancelUnrest", label: i18n.chain.vq.engine.cancelUnrest});
    return opts.some((o) => o.id.startsWith("convert:") || o.id.startsWith("expand:")) ? opts.filter((o) => o.id !== "conversionsDone") : opts;
};

const displacementOwner = (G: VQGame, controller: Controller): Power | undefined => isPower(controller) ? controller :
    POWERS.find((p) => G.powers[p].alliedMinors.includes(controller as any));

/** 12.5: distance ignores intervening control; sea zones count as spaces. */
const displacementDestinations = (G: VQGame, item: NonNullable<PendingEspionage["displacements"]>[number]): string[] => {
    const {owner, from, kind} = item;
    const queue = [{id: from, distance: 0}], seen = new Set([from]);
    let nearest = Infinity;
    const destinations: string[] = [];
    while (queue.length) {
        const {id, distance} = queue.shift()!;
        if (distance > nearest) break;
        if (id !== from && G.spaces[id]?.control === owner && (kind === "land" ? isFortifiedSpace(G, id) : (SPACE_BY_ID[id]?.ports?.length ?? 0) > 0)) {
            nearest = distance; destinations.push(id); continue;
        }
        const zone = SEA_ZONE_BY_ID[id];
        const neighbors = zone ? [...zone.adjacent, ...zonePorts(zone.id)] : [
            ...(kind === "land" ? LAND_NEIGHBORS[id].filter((n) => {
                const port = [id, n.id].includes("brielle") && [id, n.id].includes("rotterdam") ? "brielle" :
                    [id, n.id].includes("flushing") && [id, n.id].includes("antwerp") ? "flushing" : undefined;
                return !port || G.spaces[port].control === owner || isPower(G.spaces[port].control) && allied(G, owner, G.spaces[port].control as Power);
            }).map((n) => n.id) : []),
            ...(SPACE_BY_ID[id]?.ports ?? []),
        ];
        for (const next of neighbors) if (!seen.has(next)) {seen.add(next); queue.push({id: next, distance: distance + 1});}
    }
    const capital = capitalOf(G, owner);
    if (kind === "land" && capital && capital !== from && G.spaces[capital].control === owner && !destinations.includes(capital)) destinations.push(capital);
    return destinations;
};
const queueDisplacements = (G: VQGame, id: string, primary = false): void => {
    const p = G.pendingEspionage!, s = G.spaces[id];
    p.displacements ??= [];
    const controllers = new Set<Controller>([...Object.keys(s.land), ...Object.keys(s.naval),
        ...s.leaders.map((l) => LEADER_BY_ID[l]?.power).filter(Boolean)] as Controller[]);
    for (const controller of controllers) {
        if (controller === "spain" && !primary) continue;
        const owner = displacementOwner(G, controller);
        if (!owner) {delete s.land[controller]; delete s.naval[controller]; continue;}
        const leaders = s.leaders.filter((id) => LEADER_BY_ID[id]?.power === controller);
        const land = s.land[controller];
        if (land && land.regular + land.merc + land.cav > 0 || leaders.some((id) => LEADER_BY_ID[id].kind === "army")) p.displacements.push({owner, controller, from: id, kind: "land"});
        else delete s.land[controller];
        if (navalCount(s.naval[controller]) > 0 || leaders.some((id) => LEADER_BY_ID[id].kind === "naval")) p.displacements.push({owner, controller, from: id, kind: "naval"});
        else delete s.naval[controller];
    }
};
const continueRebellion = (G: VQGame, ctx: Ctx): void => {
    const p = G.pendingEspionage!;
    if (p.displacements?.length) {p.step = "displace"; stage(G, ctx, p.displacements[0].owner);}
    else {
        if (p.rebellionRegularsPending) {
            addLand(G, p.rebellionRegularsPending, "spain", "regular", 2);
            delete p.rebellionRegularsPending;
        }
        if (p.remaining > 0) {p.step = "rebelSpaces"; stage(G, ctx, "spain");}
        else finish(G, ctx);
    }
};
const seize = (G: VQGame, id: string, primary = false): void => {
    G.spaces[id].control = "spain";
    queueDisplacements(G, id, primary);
    pushLog(G, `English Catholic Rebellion: Spain controls ${SPACE_BY_ID[id].name}.`);
};
const successfulRebellion = (G: VQGame, ctx: Ctx): void => {
    const p = G.pendingEspionage!;
    p.rebellionRegularsPending = p.target;
    seize(G, p.target!, true); setWar(G, "spain", "england");
    p.remaining = 3; continueRebellion(G, ctx);
};

export const espionageOptions = (G: VQGame): {id: string; label: string}[] => {
    const p = G.pendingEspionage;
    if (!p) return [];
    if (p.step === "displace") {
        const dest = displacementDestinations(G, p.displacements![0]);
        const label = p.displacements![0].kind === "land" ? i18n.chain.vq.engine.displaceLand : i18n.chain.vq.engine.displaceNaval;
        return dest.length ? dest.map((id) => ({id: `displace:${id}`, label: label.replace("{space}", mapName(id))})) :
            [{id: "displace:pool", label: i18n.chain.vq.engine.displaceToPool}];
    }
    if (p.step === "responses") return responseOptions(G, p);
    if (p.step === "walsinghamResponse") return [
        {id: "walsingham", label: i18n.chain.vq.engine.playWalsingham},
        {id: "continue", label: i18n.chain.vq.engine.allowNeutralize},
    ];
    if (p.step === "mary") return [{id: "spareMary", label: i18n.chain.vq.engine.spareMary}, {id: "executeMary", label: i18n.chain.vq.engine.executeMary}];
    if (p.step === "priestHoles") return [{id: "allowNeutralize", label: i18n.chain.vq.engine.allowJesuitNeutralize},
        ...(G.powers[p.responding].cards.includes("vq-090") ? [{id: "priestHoles", label: i18n.chain.vq.engine.priestHoles}] : [])];
    if (p.step === "offense") {
        const result = [
        ...(!p.used.includes("neutralize") && operativeOptions(G, p).length ? [{id: "neutralize", label: i18n.chain.vq.engine.neutralizeEnemyOperative}] : []),
        ...(!p.used.includes("inspect") ? [{id: "inspect", label: i18n.chain.vq.engine.inspectTargetHand}] : []),
        ...(!p.used.includes("discard") && (G.handCounts?.[p.targetPower] ?? G.powers[p.targetPower].cards.length) >= 3 && p.attack?.includes(6) ?
            [{id: "discard", label: i18n.chain.vq.engine.forceDiscard}] : []),
        ];
        return result.length ? result : [{id: "done", label: i18n.chain.vq.engine.finishIntelligence}];
    }
    if (p.step === "neutralize" || p.step === "extraNeutralize") return [
        ...operativeOptions(G, p, p.step === "extraNeutralize"),
        ...(p.step === "extraNeutralize" ? [{id: "skipNeutralize", label: i18n.chain.vq.engine.skipExtraNeutralize}] : []),
        ...(p.event === "richardTopcliffe" ? [{id: "topcliffeDone", label: i18n.chain.vq.engine.topcliffeDone}] : []),
    ];
    if (p.step === "defense") return [
        ...(!p.used.includes("neutralize") && activeInformant(G, p.power, p.targetPower) ? [{id: "neutralize", label: i18n.chain.vq.engine.neutralizeAssassinationSpy}] : []),
        ...(!p.used.includes("inspect") ? [{id: "inspect", label: i18n.chain.vq.engine.inspectAssassinHand}] : []),
        ...(!p.used.includes("minusCard") ? [{id: "minusCard", label: i18n.chain.vq.engine.assassinMinusCard}] : []),
    ];
    if (p.step === "conversions") return conversionOptions(G, p);
    if (p.step === "unrest") return p.converted!.map((id) => ({id: `unrest:${id}`, label: i18n.chain.vq.engine.placeUnrest.replace("{space}", mapName(id))}));
    if (p.step === "rebelTarget") {
        const targets = englishRebellionTargets(G);
        return targets.length ? targets.map((id) => ({id: `rebel:${id}`, label: i18n.chain.vq.engine.rebellionTarget.replace("{space}", mapName(id))})) :
            [{id: "done", label: i18n.chain.vq.engine.noRebellionTarget}];
    }
    if (p.step === "rebelLosses") return protestantUnits(G, p.target!, true);
    if (p.step === "rebelSpaces") return [{id: "done", label: i18n.chain.vq.engine.finishRebellion},
        ...LAND_NEIGHBORS[p.target!].filter((n) => englishRebellionTargets(G).includes(n.id) && !protestantUnits(G, n.id).length)
            .map((n) => ({id: `seize:${n.id}`, label: i18n.chain.vq.engine.expandControl.replace("{space}", mapName(n.id))}))];
    if (p.step === "jesuitPlace" || p.step === "jesuitDestination") {
        const places = [
        ...SPACES.filter((s) => s.area === "england" && !G.espionage?.jesuits.includes(s.id) &&
            (p.step === "jesuitDestination" || !Object.values(G.spaces[s.id].land).some((u) => u && (u.regular + u.merc + u.cav) > 0) &&
            !Object.values(G.spaces[s.id].naval).some((u) => navalCount(u) > 0) && G.spaces[s.id].leaders.length === 0))
            .map((s) => ({id: `place:${s.id}`, label: i18n.chain.vq.engine.placeJesuit.replace("{space}", mapName(s.id))})),
        ];
        return places.length && p.step === "jesuitPlace" ? places : [...places, {id: "done", label: i18n.chain.vq.engine.finishJesuitEvent}];
    }
    if (p.step === "northernConvert") {
        const targets = northernConversionTargets(G, p.conversionBase ?? []);
        return targets.length ? targets.map((id) => ({id: `nconvert:${id}`, label: i18n.chain.vq.engine.northernConvert.replace("{space}", mapName(id))})) :
            [{id: "nconvertDone", label: i18n.chain.vq.engine.noOtherRegionContinue}];
    }
    if (p.step === "massacreConvert") {
        const targets = massacreConversionTargets(G);
        return [{id: "massacreConvertDone", label: i18n.chain.vq.engine.endConversions},
            ...targets.map((id) => ({id: `mconvert:${id}`, label: i18n.chain.vq.engine.massacreConvert.replace("{space}", mapName(id))}))];
    }
    if (p.step === "massacreAssassinate") return [
        {id: "massacreAssassinate", label: i18n.chain.vq.engine.freeAssassinateColigny.replace("{cp}", String(p.cp))},
        {id: "massacreSkip", label: i18n.chain.vq.engine.skipAssassination},
    ];
    if (p.step === "northernUnrest") {
        const targets = northernUnrestTargets(G);
        return targets.length ? targets.map((id) => ({id: `nunrest:${id}`, label: i18n.chain.vq.engine.northernUnrest.replace("{space}", mapName(id))})) :
            [{id: "done", label: i18n.chain.vq.engine.noOtherRegionDone}];
    }
    if (p.step === "jesuitMove") return [{id: "done", label: i18n.chain.vq.engine.finishJesuitEvent}, ...(G.espionage?.jesuits ?? []).filter((id) => p.used.includes(id)).map((id) =>
        ({id: `move:${id}`, label: i18n.chain.vq.engine.moveJesuit.replace("{space}", mapName(id))}))];
    return [];
};

const afterConversions = (G: VQGame, ctx: Ctx): void => {
    const p = G.pendingEspionage!;
    if (p.unrest && p.converted?.length) {p.step = "unrest"; return;}
    if (p.rebellionAfterConversions) {p.step = "rebelTarget"; p.remaining = 0;}
    else finish(G, ctx);
};

const afterNeutralize = (G: VQGame, ctx: Ctx): void => {
    const p = G.pendingEspionage!;
    if (p.neutralizeReturn === "walsingham") {p.neutralizedOperatives = []; p.kind = "intelligence"; p.attackBonus = 2; p.step = "responses"; beginResponses(G, ctx);}
    else if (p.neutralizeReturn === "extraNeutralize") {p.step = "offense"; stage(G, ctx, p.power); if (p.remaining <= 0) finish(G, ctx);}
    else if (p.neutralizeReturn === "topcliffe") {
        p.remaining--;
        if (p.remaining > 0 && espionageState(G).jesuits.length) {p.step = "neutralize"; stage(G, ctx, p.power);}
        else startConversions(G, ctx, false, "protestant", 5);
    } else {
        const extra = roll(ctx, 1)[0];
        if (extra >= 4 && operativeOptions(G, p, true).length) {p.step = "extraNeutralize"; stage(G, ctx, p.power);}
        else if (p.remaining > 0) {p.step = "offense"; stage(G, ctx, p.power);}
        else finish(G, ctx);
    }
};
const neutralizeJesuit = (G: VQGame, ctx: Ctx, id: string): void => {
    const p = G.pendingEspionage!;
    p.protectedJesuit = id;
    p.priestQueue = participatingPowers(G).filter((power) => G.powers[power].cards.includes("vq-090"));
    if (p.priestQueue.length) {p.step = "priestHoles"; stage(G, ctx, p.priestQueue[0]);}
    else {espionageState(G).jesuits = espionageState(G).jesuits.filter((s) => s !== id); afterNeutralize(G, ctx);}
};

/**
 * #81 can answer a neutralization that would remove an English informant.  The
 * card is a Response card and must be played before the neutralization effect.
 * `defense` covers the defender of an English action choosing to neutralize
 * the English informant; the other steps cover a foreign intelligence action
 * neutralizing one.
 */
const canRespondWithWalsingham = (G: VQGame, p: PendingEspionage, choice: string,
    step: "neutralize" | "extraNeutralize" | "defense"): boolean => {
    if (!G.powers.england.cards.includes("vq-081") || G.espionage?.walsingham !== undefined) return false;
    if (step === "defense") {
        return p.power === "england" && p.targetPower !== "england" && activeInformant(G, p.power, p.targetPower);
    }
    if (p.power === "england") return false;
    const [type, owner] = choice.split(":");
    return type === "informant" && owner === "england";
};

/** Start Walsingham's remove-person + bonus intelligence sequence as a nested action. */
const beginWalsinghamResponse = (G: VQGame, ctx: Ctx, outer: PendingEspionage): void => {
    const target = outer.power === "england" ? outer.targetPower : outer.power;
    const inner: PendingEspionage = {
        kind: "walsingham", power: "england", targetPower: target, responding: "england",
        step: "neutralize", cp: 0, remaining: 0, used: [], event: "walsingham",
        neutralizeReturn: "walsingham", walsinghamReturn: outer,
    };
    removeCardFromHand(G, "england", "vq-081");
    discardCard(G, "england", "vq-081", true);
    pushLog(G, `England responds with Walsingham before the English informant is neutralized.`);
    G.pendingEspionage = inner;
    if (!operativeOptions(G, inner).length) {
        // No enemy operative is on England's card; only the bonus intelligence remains.
        inner.kind = "intelligence";
        inner.attackBonus = 2;
        inner.step = "responses";
        beginResponses(G, ctx);
        return;
    }
    stage(G, ctx, "england");
};

/** Resume the interrupted action after Walsingham's nested sequence finishes. */
const resumeWalsinghamOuter = (G: VQGame, ctx: Ctx, outer: PendingEspionage,
    choice: string, step: NonNullable<PendingEspionage["walsinghamStep"]>): void => {
    G.pendingEspionage = outer;
    if (step === "event") {
        // #92 Double Agent and #59 John Hawkins remove an English informant as
        // part of their event; finish the interrupted event after Walsingham.
        resolveInterruptedEvent(G, ctx, outer);
        return;
    }
    outer.responding = step === "defense" ? outer.targetPower : outer.power;
    if (step === "defense") {
        outer.used.push(choice);
        outer.remaining--;
        if (choice === "neutralize") neutralizeInformant(G, outer.power, outer.targetPower);
        if (outer.remaining <= 0 || !espionageOptions(G).some((o) => o.id !== "done")) finishOrMary(G, ctx);
        else stage(G, ctx, outer.responding);
        return;
    }
    if (step === "extraNeutralize") outer.neutralizeReturn = "extraNeutralize";
    (outer.neutralizedOperatives ??= []).push(choice);
    const [type, target] = choice.split(":");
    if (type === "jesuit") {neutralizeJesuit(G, ctx, target); return;}
    if (type === "informant") neutralizeInformant(G, target as Power, outer.power);
    afterNeutralize(G, ctx);
};

export const chooseEspionage = (G: VQGame, ctx: Ctx, args: {choice: string}): void | typeof INVALID_MOVE => {
    const p = G.pendingEspionage;
    if (!p || ctx.playerID !== ownerOf(G, p.responding) || !espionageOptions(G).some((o) => o.id === args.choice)) return INVALID_MOVE;
    const choice = args.choice;
    if (p.step === "responses") {
        if (choice !== "continue") {
            const id = choice.startsWith("walsingham:") ? "vq-081" : choice === "pistols" ? "vq-088" : "vq-089";
            removeCardFromHand(G, p.responding, id); discardCard(G, p.responding, id, true);
            if (choice.startsWith("walsingham:")) espionageState(G).walsingham = choice.endsWith("offensive") ? "offensive" : "defensive";
            else {p.used.push(choice); p.attackBonus = (p.attackBonus ?? 0) + (choice === "pistols" ? 2 : 3);}
            return;
        }
        p.responseQueue!.shift();
        if (p.responseQueue!.length) stage(G, ctx, p.responseQueue![0]); else resolveRoll(G, ctx);
        return;
    }
    if (p.step === "walsinghamResponse") {
        if (choice === "walsingham") {
            beginWalsinghamResponse(G, ctx, p);
            return;
        }
        const step = p.walsinghamStep!;
        const pendingChoice = p.walsinghamChoice!;
        delete p.walsinghamStep;
        delete p.walsinghamChoice;
        if (step === "event") {
            // England declined #81; the event's removal resolves unchanged.
            resolveInterruptedEvent(G, ctx, p);
            return;
        }
        p.step = step;
        resumeWalsinghamOuter(G, ctx, p, pendingChoice, step);
        return;
    }
    if (p.step === "mary") {if (choice === "executeMary") executeMary(G); finish(G, ctx); return;}
    if (p.step === "priestHoles") {
        if (choice === "priestHoles") {
            removeCardFromHand(G, p.responding, "vq-090"); discardCard(G, p.responding, "vq-090", true);
            pushLog(G, "Priest Holes prevents Jesuit neutralization.");
            afterNeutralize(G, ctx);
        } else {
            p.priestQueue!.shift();
            if (p.priestQueue!.length) stage(G, ctx, p.priestQueue![0]);
            else {espionageState(G).jesuits = espionageState(G).jesuits.filter((s) => s !== p.protectedJesuit); afterNeutralize(G, ctx);}
        }
        return;
    }
    if (choice === "topcliffeDone") {startConversions(G, ctx, false, "protestant", 5); return;}
    if (p.step === "massacreConvert") {
        if (choice !== "massacreConvertDone") {
            const id = choice.slice(9);
            G.spaces[id].religion = "catholic"; p.remaining--;
            pushLog(G, `St. Bartholomew's Day Massacre: ${SPACE_BY_ID[id].name} becomes Catholic.`);
        }
        if (choice === "massacreConvertDone" || p.remaining <= 0 || !massacreConversionTargets(G).length) afterMassacreConversions(G, ctx);
        return;
    }
    if (p.step === "massacreAssassinate") {
        if (choice === "massacreSkip") {finish(G, ctx); return;}
        G.assassinationUsed.push("france");
        p.kind = "assassination"; p.power = "france"; p.targetPower = "protestant"; p.target = "coligny"; p.used = [];
        pushLog(G, `France attempts a free ${p.cp} CP assassination of Coligny.`);
        beginResponses(G, ctx);
        return;
    }
    if (p.step === "northernConvert") {
        if (choice !== "nconvertDone") {
            const id = choice.slice(9);
            G.spaces[id].religion = "catholic"; p.converted!.push(id); p.remaining--;
            pushLog(G, `Northern Rising: ${SPACE_BY_ID[id].name} becomes Catholic.`);
        }
        if (choice === "nconvertDone" || p.remaining <= 0 || !northernConversionTargets(G, p.conversionBase ?? []).length) afterNorthernConversions(G, ctx);
        return;
    }
    if (p.step === "northernUnrest" && choice !== "done") {
        const id = choice.slice(8);
        G.spaces[id].unrest = true; p.remaining--;
        pushLog(G, `Northern Rising: unrest in ${SPACE_BY_ID[id].name}.`);
        if (p.remaining <= 0 || !northernUnrestTargets(G).length) finish(G, ctx);
        return;
    }
    if (choice === "done") {
        if (p.event === "godsSecretAgents" && p.step === "jesuitPlace") {p.step = "jesuitMove"; return;}
        finish(G, ctx); return;
    }
    if (p.step === "offense") {
        p.used.push(choice); p.remaining--;
        if (choice === "neutralize") {p.step = "neutralize"; p.neutralizeReturn = "offense"; return;}
        if (choice === "inspect") inspect(G, p.power, p.targetPower);
        if (choice === "discard") randomDiscard(G, ctx, p.targetPower, true);
        if (p.remaining <= 0) finish(G, ctx);
        return;
    }
    if (p.step === "neutralize" || p.step === "extraNeutralize") {
        if (p.step === "extraNeutralize") p.neutralizeReturn = "extraNeutralize";
        if (canRespondWithWalsingham(G, p, choice, p.step)) {
            p.walsinghamChoice = choice;
            p.walsinghamStep = p.step;
            p.step = "walsinghamResponse";
            p.responding = "england";
            stage(G, ctx, "england");
            return;
        }
        const [type, target] = choice.split(":");
        if (type === "jesuit" || type === "informant") (p.neutralizedOperatives ??= []).push(choice);
        if (type === "jesuit") {neutralizeJesuit(G, ctx, target); return;}
        if (type === "informant") neutralizeInformant(G, target as Power, p.power);
        afterNeutralize(G, ctx);
        return;
    }
    if (p.step === "defense") {
        if (choice === "neutralize" && canRespondWithWalsingham(G, p, choice, "defense")) {
            p.walsinghamChoice = choice;
            p.walsinghamStep = "defense";
            p.step = "walsinghamResponse";
            p.responding = "england";
            stage(G, ctx, "england");
            return;
        }
        p.used.push(choice); p.remaining--;
        if (choice === "neutralize") neutralizeInformant(G, p.power, p.targetPower);
        if (choice === "inspect") inspect(G, p.targetPower, p.power);
        if (choice === "minusCard") espionageState(G).nextDraw[p.power] = (espionageState(G).nextDraw[p.power] ?? 0) - 1;
        if (p.remaining <= 0 || !espionageOptions(G).some((o) => o.id !== "done")) finishOrMary(G, ctx);
        return;
    }
    if (p.step === "conversions") {
        if (choice === "cancelUnrest") {p.conversionDice![p.conversionDice!.indexOf(6)] = 5; p.unrest = false; return;}
        if (choice === "conversionsDone") {afterConversions(G, ctx); return;}
        const [type, value, idValue] = choice.split(":");
        const id = type === "expand" ? value : idValue;
        const die = type === "expand" ? 6 : Number(value);
        if (type === "convert" && !p.used.includes("remainingConversions")) p.used.push("remainingConversions");
        p.conversionDice!.splice(p.conversionDice!.indexOf(die), 1);
        G.spaces[id].religion = p.conversionSide ?? "catholic"; p.converted!.push(id);
        if (type === "expand") p.conversionBase!.push(id);
        pushLog(G, `${p.conversionSide ?? "catholic"} conversion in ${SPACE_BY_ID[id].name}.`);
        if (!p.conversionDice!.length) afterConversions(G, ctx);
        return;
    }
    if (p.step === "unrest") {G.spaces[choice.slice(7)].unrest = true; p.unrest = false; afterConversions(G, ctx); return;}
    if (p.step === "rebelTarget") {
        p.target = choice.slice(6);
        const units = protestantUnits(G, p.target, true);
        p.remaining = units.length ? hits(roll(ctx, 5)) : 0;
        if (!units.length) successfulRebellion(G, ctx);
        else if (p.remaining) {p.step = "rebelLosses"; stage(G, ctx, "england");}
        else finish(G, ctx);
        return;
    }
    if (p.step === "rebelLosses") {
        const [kind, owner] = choice.split(":") as [string, Controller];
        const s = G.spaces[p.target!];
        if (kind === "regular") s.land[owner]!.regular--;
        else s.naval[owner]![kind as keyof NavalStack]--;
        p.remaining--;
        if (!protestantUnits(G, p.target!, true).length) successfulRebellion(G, ctx);
        else if (!p.remaining) finish(G, ctx);
        return;
    }
    if (p.step === "rebelSpaces") {seize(G, choice.slice(6)); p.remaining--; continueRebellion(G, ctx); return;}
    if (p.step === "displace") {
        const item = p.displacements!.shift()!, dest = choice.slice(9), source = G.spaces[item.from];
        if (item.kind === "land") {
            const units = source.land[item.controller];
            if (units && dest !== "pool") {
                const target = ensureLand(G, dest, item.controller);
                target.regular += units.regular; target.merc += units.merc; target.cav += units.cav;
            }
            delete source.land[item.controller];
        } else {
            const units = source.naval[item.controller];
            if (units && dest !== "pool") {
                const target = ensureNaval(G, dest, item.controller);
                for (const key of Object.keys(target) as (keyof NavalStack)[]) target[key] += units[key];
            }
            delete source.naval[item.controller];
        }
        for (const id of [...source.leaders]) if (LEADER_BY_ID[id]?.power === item.controller &&
            LEADER_BY_ID[id].kind === (item.kind === "land" ? "army" : "naval")) {
            source.leaders = source.leaders.filter((l) => l !== id);
            G.leaders[id].location = dest;
            if (dest !== "pool") G.spaces[dest].leaders.push(id);
        }
        continueRebellion(G, ctx); return;
    }
    if (p.step === "jesuitMove") {p.movingJesuit = choice.slice(5); p.step = "jesuitDestination"; return;}
    if (p.step === "jesuitPlace" || p.step === "jesuitDestination") {
        const state = espionageState(G), id = choice.slice(6);
        if (p.step === "jesuitDestination") state.jesuits = state.jesuits.filter((s) => s !== p.movingJesuit);
        else if (p.event === "godsSecretAgents") state.jesuitsOnCard--;
        state.jesuits.push(id);
        if (G.spaces[id].religion === "catholic" || SPACES.filter((s) => s.area === "england" && G.spaces[s.id].religion === "protestant").length > 1) G.spaces[id].religion = "catholic";
        if (p.step === "jesuitDestination" || p.event === "englishCollegeAtDouai") finish(G, ctx);
        else if (state.jesuitsOnCard <= 0) p.step = "jesuitMove";
        return;
    }
};

// --------------------------------------------------------------------------
// #78 Northern Rising (Rising of the North)
// --------------------------------------------------------------------------

/** Same adjacency as conversions (18.5): land connections and ports on a shared sea zone. */
const conversionNeighbors = (id: string): string[] => [
    ...LAND_NEIGHBORS[id].map((n) => n.id),
    ...(SPACE_BY_ID[id].ports ?? []).flatMap((z) => zonePorts(z).filter((port) => port !== id)),
];
const withinTwo = (id: string, base: string[]): boolean => {
    const near = new Set([id, ...conversionNeighbors(id)]);
    for (const n of [...near]) for (const m of conversionNeighbors(n)) near.add(m);
    return [...near].some((x) => base.includes(x));
};

/**
 * English spaces Spain may flip: not Catholic, free of Protestant units, and within 2 spaces of a space
 * that was Catholic when the event began. The last Protestant English space is kept (core presence).
 */
export const northernConversionTargets = (G: VQGame, base: string[]): string[] => {
    const england = SPACES.filter((s) => s.area === "england");
    if (england.filter((s) => G.spaces[s.id].religion !== "catholic").length <= 1) return [];
    return england.filter((s) => G.spaces[s.id].religion !== "catholic" && !protestantUnits(G, s.id).length &&
        withinTwo(s.id, base)).map((s) => s.id);
};

/** Unrest goes on English spaces that are unoccupied or under Catholic influence. */
export const northernUnrestTargets = (G: VQGame): string[] => SPACES.filter((s) => {
    const st = G.spaces[s.id];
    const occupied = Object.values(st.land).some((u) => u && u.regular + u.merc + u.cav > 0) ||
        Object.values(st.naval).some((u) => navalCount(u) > 0) || st.leaders.length > 0;
    return s.area === "england" && !st.unrest && (!occupied || st.religion === "catholic");
}).map((s) => s.id);

export const canPlayNorthernRising = (G: VQGame): boolean =>
    G.scenario !== "tutorial" && !G.pendingEspionage && espionageState(G).mary === "captured" && ownerOf(G, "spain") !== undefined;

const afterNorthernConversions = (G: VQGame, ctx: Ctx): void => {
    const p = G.pendingEspionage!;
    if (atWar(G, "spain", "england")) {
        // Scenario book: follow 19.4 from Step 2; this does not use Spain's once-per-turn rebellion marker.
        p.step = "rebelTarget"; p.remaining = 0; stage(G, ctx, "spain");
    } else {
        p.step = "northernUnrest"; p.remaining = 4; stage(G, ctx, "spain");
        if (!northernUnrestTargets(G).length) finish(G, ctx);
    }
};

/** Any power may play the event; Spain makes every choice. */
export const beginNorthernRising = (G: VQGame, ctx: Ctx, power: Power): void => {
    const base = SPACES.filter((s) => G.spaces[s.id].religion === "catholic").map((s) => s.id);
    G.pendingEspionage = {kind: "northernRising", power: "spain", targetPower: "england", responding: "spain",
        step: "northernConvert", cp: 4, remaining: 3, used: [], converted: [], conversionBase: base, event: "northernRising"};
    pushLog(G, `${power} plays Northern Rising; Spain resolves it.`);
    if (!northernConversionTargets(G, base).length) {afterNorthernConversions(G, ctx); return;}
    stage(G, ctx, "spain");
};

// --------------------------------------------------------------------------
// #97 St. Bartholomew's Day Massacre
// --------------------------------------------------------------------------

const inFrance = (id: string): boolean => SPACE_BY_ID[id]?.area === "france" || spaceHomes(SPACE_BY_ID[id]!).includes("france");

/** Navarre is betrothed to a French royal this turn (betrothals resolve in Winter). */
export const navarreBetrothedToFrance = (G: VQGame): boolean => G.betrothals.some((b) =>
    [b.male, b.female].includes("henryIV") && [b.male, b.female].some((id) => G.royals.find((r) => r.id === id)?.power === "france"));

/** Protestant spaces in France under French political control; the last Protestant space in the area is kept (18.1). */
export const massacreConversionTargets = (G: VQGame): string[] => {
    const area = SPACES.filter((s) => s.area === "france");
    if (area.filter((s) => G.spaces[s.id].religion === "protestant").length <= 1) return [];
    return SPACES.filter((s) => inFrance(s.id) && G.spaces[s.id].religion === "protestant" && G.spaces[s.id].control === "france").map((s) => s.id);
};

/** Scenario FAQ: no attempt if France already used its assassination this turn. */
const massacreAssassinationAllowed = (G: VQGame): boolean => ownerOf(G, "france") !== undefined && !isActivatedMajor(G, "france") &&
    !isActivatedMajor(G, "protestant") && !G.assassinationUsed.includes("france") && assassinationTargets(G, "france").includes("coligny");

const afterMassacreConversions = (G: VQGame, ctx: Ctx): void => {
    const p = G.pendingEspionage!;
    if (massacreAssassinationAllowed(G)) {p.step = "massacreAssassinate"; stage(G, ctx, "france");}
    else finish(G, ctx);
};

export const canPlayMassacre = (G: VQGame): boolean => G.scenario !== "tutorial" && !G.pendingEspionage;

export const beginMassacre = (G: VQGame, ctx: Ctx, power: Power): void => {
    const navarre = navarreBetrothedToFrance(G);
    let mercs = 0;
    for (const s of SPACES.filter((s) => inFrance(s.id))) {
        const units = G.spaces[s.id].land.protestant;
        if (units?.merc) {mercs += units.merc; units.merc = 0;}
    }
    const state = espionageState(G);
    state.nextDraw.protestant = (state.nextDraw.protestant ?? 0) + 1;
    pushLog(G, `St. Bartholomew's Day Massacre: ${mercs} Protestant mercenaries in France removed; the Protestant gains a +1 Card marker.`);
    G.pendingEspionage = {kind: "massacre", power, targetPower: "protestant", responding: power, step: "massacreConvert",
        cp: navarre ? 4 : 2, remaining: navarre ? 8 : 5, used: [], event: "stBartholomewsDayMassacre"};
    if (!massacreConversionTargets(G).length) {afterMassacreConversions(G, ctx); return;}
    stage(G, ctx, power);
};

export const refreshJesuits = (G: VQGame): void => {
    if (!espionageAvailable(G)) return;
    const state = espionageState(G);
    state.jesuitsOnCard = Math.max(state.jesuitsOnCard, Math.min(state.douai ? 2 : 1, 5 - state.jesuits.length));
};

/**
 * Double Agent targets: "enemy" or "enemy>from". The enemy informant (neutralized or not) must be
 * on the player's power card; "from" names one of the player's non-neutralized informants to move.
 */
export const doubleAgentTargets = (G: VQGame, power: Power): string[] => {
    const own = G.informants.filter((i) => i.owner === power);
    const movable = own.filter((i) => !i.neutralized).map((i) => i.target);
    return G.informants.filter((i) => i.target === power && i.owner !== power && !isActivatedMajor(G, i.owner))
        .flatMap((i) => own.length < 2 || own.some((o) => o.target === i.owner) ? [i.owner] :
            movable.map((from) => `${i.owner}>${from}`));
};

const resolveDoubleAgent = (G: VQGame, power: Power, target: string): void => {
    const [enemy, from] = target.split(">") as [Power, Power | undefined];
    G.informants = G.informants.filter((i) => !(i.owner === enemy && i.target === power));
    pushLog(G, `Double Agent: ${enemy}'s informant on ${power} returns to its force pool.`);
    if (G.informants.some((i) => i.owner === power && i.target === enemy)) {
        pushLog(G, `${power} already has an informant on ${enemy}; no informant is added.`);
        return;
    }
    const moving = from !== undefined ? G.informants.find((i) => i.owner === power && i.target === from && !i.neutralized) : undefined;
    if (moving) {moving.target = enemy; moving.plantedImpulse = G.impulse;}
    else G.informants.push({owner: power, target: enemy, plantedImpulse: G.impulse, neutralized: false});
    pushLog(G, `${power} adds an informant on ${enemy}.`);
};

/** An English informant sits on `power`'s card, neutralized or not. */
const englishInformantOnCard = (G: VQGame, power: Power): boolean =>
    G.informants.some((i) => i.owner === "england" && i.target === power);
const walsinghamEventAvailable = (G: VQGame): boolean =>
    G.powers.england.cards.includes("vq-081") && espionageState(G).walsingham === undefined;

/**
 * Open the #81 response window before an Event removes an English informant.
 * Returns true when the event is suspended in `pendingEspionage`; the caller
 * must then leave the removal to `resolveInterruptedEvent`.  Every
 * event-driven English-informant removal goes through this one window.
 */
const beginWalsinghamEventResponse = (G: VQGame, ctx: Ctx, power: Power,
    event: "doubleAgent" | "johnHawkins", target: string): boolean => {
    if (!englishInformantOnCard(G, power) || !walsinghamEventAvailable(G)) return false;
    G.pendingEspionage = {
        kind: event, power, targetPower: "england", responding: "england",
        step: "walsinghamResponse", cp: 0, remaining: 0, used: [],
        event, target, walsinghamStep: "event", walsinghamChoice: target,
    };
    pushLog(G, `${event === "doubleAgent" ? "Double Agent" : "John Hawkins"} would remove England's informant; England may respond with Walsingham.`);
    stage(G, ctx, "england");
    return true;
};

/** Apply the Event removal that #81 interrupted, then close its pending action. */
const resolveInterruptedEvent = (G: VQGame, ctx: Ctx, outer: PendingEspionage): void => {
    if (outer.event === "doubleAgent") resolveDoubleAgent(G, outer.power, outer.target!);
    else if (outer.event === "johnHawkins") resolveInformantCut(G, outer.power, outer.target!);
    finish(G, ctx);
};

/**
 * #59 John Hawkins' second option: England or Spain cuts one enemy informant
 * on its own card, then plants an informant on that power.  Targets use
 * "cut:enemy" or "cut:enemy>from" where `from` names one of the player's
 * non-neutralized informants to move instead of taking one from the pool.
 */
export const informantCutTargets = (G: VQGame, power: Power): string[] => {
    if (power !== "england" && power !== "spain") return [];
    const own = G.informants.filter((i) => i.owner === power);
    const movable = own.filter((i) => !i.neutralized).map((i) => i.target);
    return G.informants.filter((i) => i.target === power && i.owner !== power && !isActivatedMajor(G, i.owner))
        .flatMap((i) => own.length < 2 || own.some((o) => o.target === i.owner) ? [`cut:${i.owner}`] :
            movable.map((from) => `cut:${i.owner}>${from}`));
};

export const canPlayInformantCut = (G: VQGame, power: Power, target: string | undefined): boolean =>
    target !== undefined && informantCutTargets(G, power).includes(target);

const resolveInformantCut = (G: VQGame, power: Power, target: string): void => {
    const [enemy, from] = target.slice(4).split(">") as [Power, Power | undefined];
    G.informants = G.informants.filter((i) => !(i.owner === enemy && i.target === power));
    pushLog(G, `John Hawkins: ${enemy}'s informant on ${power} is cut.`);
    if (G.informants.some((i) => i.owner === power && i.target === enemy)) {
        pushLog(G, `${power} already has an informant on ${enemy}; no informant is added.`);
        return;
    }
    const moving = from !== undefined ? G.informants.find((i) => i.owner === power && i.target === from && !i.neutralized) : undefined;
    if (moving) {moving.target = enemy; moving.plantedImpulse = G.impulse;}
    else G.informants.push({owner: power, target: enemy, plantedImpulse: G.impulse, neutralized: false});
    pushLog(G, `${power} plants an informant on ${enemy}.`);
};

/** Resolve #59's cut option, first letting #81 answer if an English informant is cut. */
export const beginInformantCut = (G: VQGame, ctx: Ctx, power: Power, target: string): boolean => {
    if (!canPlayInformantCut(G, power, target)) return false;
    if (beginWalsinghamEventResponse(G, ctx, power, "johnHawkins", target)) return true;
    resolveInformantCut(G, power, target);
    return false;
};

/** Core related Event cards; unsupported choices remain outside this dispatcher. */
export const isEspionageEvent = (handler: string): boolean => ["walsingham", "cipherKey", "englishCollegeAtDouai", "godsSecretAgents", "richardTopcliffe", "doubleAgent"].includes(handler);
export const canPlayEspionageEvent = (G: VQGame, power: Power, handler: string, target?: string): boolean => {
    if (!espionageAvailable(G)) return false;
    if (handler === "doubleAgent") return !isActivatedMajor(G, power) && target !== undefined && doubleAgentTargets(G, power).includes(target);
    if (handler === "walsingham") return power === "england" && (target === "offensive" || target === "defensive" ||
        target !== undefined && isPower(target) && target !== power && !!ownerOf(G, target) && !isActivatedMajor(G, target));
    if (handler === "cipherKey") return target === "remove" || target !== undefined && isPower(target) && target !== power && !!ownerOf(G, target) && !isActivatedMajor(G, target);
    if (handler === "englishCollegeAtDouai") return ["lille", "dunkirk"].some((id) => G.spaces[id]?.religion === "catholic") &&
        !G.espionage?.douai;
    return handler === "godsSecretAgents" || handler === "richardTopcliffe";
};
export const beginEspionageEvent = (G: VQGame, ctx: Ctx, power: Power, handler: string, target?: string): void => {
    const state = espionageState(G);
    if (handler === "doubleAgent") {
        // #81 may respond before #92 removes the English informant.  The
        // event waits in `pendingEspionage` while Walsingham resolves.
        if (beginWalsinghamEventResponse(G, ctx, power, "doubleAgent", target!)) return;
        resolveDoubleAgent(G, power, target!);
        return;
    }
    if (handler === "cipherKey") {
        if (target === "remove") for (const p of POWERS) {if (state.cipherKeys[p] === power) delete state.cipherKeys[p];}
        else state.cipherKeys[power] = target as Power;
        return;
    }
    if (handler === "walsingham" && (target === "offensive" || target === "defensive")) {state.walsingham = target; return;}
    const p: PendingEspionage = {kind: handler === "walsingham" ? "walsingham" : "jesuitEvent", power: handler === "walsingham" ? "england" : "spain",
        targetPower: handler === "walsingham" ? target as Power : "england", responding: handler === "walsingham" ? "england" : "spain",
        step: "jesuitPlace", cp: 0, remaining: 0, used: [], event: handler};
    G.pendingEspionage = p;
    if (handler === "richardTopcliffe") {
        p.power = power; p.responding = power; p.remaining = 2; p.step = "neutralize"; p.neutralizeReturn = "topcliffe";
        state.nextDraw.spain = (state.nextDraw.spain ?? 0) + 1;
        if (!state.jesuits.length) {startConversions(G, ctx, false, "protestant", 5); return;}
    }
    if (handler === "godsSecretAgents") p.used = [...state.jesuits];
    if (handler === "englishCollegeAtDouai") {
        state.douai = true;
        if (state.jesuits.length + state.jesuitsOnCard >= 5) {finish(G, ctx); return;}
    }
    if (handler === "walsingham") {
        p.neutralizeReturn = "walsingham";
        p.step = "neutralize";
        // This option removes an operative before the bonus intelligence action.
        if (!operativeOptions(G, p).length) {p.kind = "intelligence"; p.attackBonus = 2; beginResponses(G, ctx); return;}
    } else if (handler === "godsSecretAgents" && !state.jesuitsOnCard) p.step = "jesuitMove";
    stage(G, ctx, p.responding);
};
