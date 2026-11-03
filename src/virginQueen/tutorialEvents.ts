import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {Controller, MinorPower, MINOR_POWERS, Power, VQGame, isPower, landCount, navalCount} from "./constant/general";
import {cardById} from "./constant/cards";
import {LEADER_BY_ID} from "./constant/leaders";
import {LAND_NEIGHBORS, SPACE_BY_ID, SPACES} from "./mapData";
import {ownerOf} from "./ownership";
import {MINOR_DIPLOMACY} from "./data/minorDiplomacy";
import {TUTORIAL_KEYS, tutorialSpaceAllowed} from "./tutorial";
import {startBattle} from "./combat";
import {
    addLand, addNaval, atWar, capitalOf, captureLeaders, discardCard, drawCards, friendlyControlled,
    friendlyController, hits, isFortifiedSpace, isPort, minorAlly, moveLeaders, ownersWithLand,
    powerVp, pushLog, removeCardFromHand, resolveMajorDiplomacy, resolveMinorDiplomacy,
    roll, setWar, shuffle, totalLand, totalNaval,
} from "./util";

export interface TutorialEventOption {id: string; label: string}
type PendingEvent = NonNullable<VQGame["pendingTutorialEvent"]>;
const option = (id: string, label: string): TutorialEventOption => ({id, label});
const activeSpaces = () => SPACES.filter((space) => tutorialSpaceAllowed(space.id));
const spaceOption = (id: string) => option(`space:${id}`, SPACE_BY_ID[id].name);
const effects = (G: VQGame) => G.tutorialEffects ?? {nextDraw: {}, skip: [], piracyVp: 0};
const drawableCards = (G: VQGame, power: Power): string[] => G.powers[power].cards.filter((id) => cardById(id).kind !== "home");
const neighborsWithin = (from: string, distance: number): string[] => {
    let visited = [from];
    for (let index = 0; index < distance; index++) visited = [...new Set([...visited, ...visited.flatMap((id) => (LAND_NEIGHBORS[id] ?? []).map((neighbor) => neighbor.id))])];
    return visited;
};

const influenceTracks = (G: VQGame, power: Power): string[] => {
    const minors = MINOR_POWERS.filter((minor) => ["papacy", "venice"].includes(minor) &&
        (MINOR_DIPLOMACY[minor].eligible.includes(power) || (minor === "papacy" && power === "ottoman")) && !G.minorDiplomacyResolved.includes(minor));
    return [...minors, ...(G.majorInfluence?.hre?.[power] !== undefined && !G.majorDiplomacyResolved?.includes("hre") ? ["hre"] : [])];
};

const influenceValue = (G: VQGame, track: string, power: Power): number => track === "hre" ?
    G.majorInfluence?.hre?.[power] ?? 0 : G.powers[power].influence[track as MinorPower] ?? 0;

const setInfluence = (G: VQGame, track: string, power: Power, value: number): void => {
    if (track === "hre") G.majorInfluence!.hre![power] = value;
    else G.powers[power].influence[track as MinorPower] = value;
};

const prompt = (G: VQGame, ctx: Ctx): void => {
    const pending = G.pendingTutorialEvent!;
    ctx.events?.setActivePlayers({value: {[ownerOf(G, pending.responding)!]: "tutorialEvent"}});
};

const finish = (G: VQGame, ctx: Ctx): void => {
    delete G.pendingTutorialEvent;
    ctx.events?.endStage();
};

export const tutorialEventOptions = (G: VQGame): TutorialEventOption[] => {
    const pending = G.pendingTutorialEvent;
    if (!pending) return [];
    const power = pending.power;
    const number = cardById(pending.cardId).officialNumber;
    if (pending.step === "cancel") return [option("continue", "允许事件结算"), option("cancel", "打出 Grand Vizier 取消事件")];
    if (pending.step === "tribute") return [option("refuse", "拒绝进贡"), ...(drawableCards(G, "spain").length > 0 ? [option("offer", "提出进贡 1 张随机手牌")] : [])];
    if (pending.step === "acceptTribute") return [option("accept", "接受进贡，取消宣战并抽牌"), option("reject", "拒绝进贡，继续宣战")];
    if (pending.step === "payment") return [option("none", "不支付，失去正规军"), ...G.powers[pending.responding].cards.filter((id) => cardById(id).officialKind !== "mandatory")
        .map((id) => option(`card:${id}`, `支付 ${cardById(id).name}，保留最多 ${cardById(id).cp * 2} 正规军`))];
    if (pending.step === "illness") return [option("discard", "随机弃 1 张手牌"), option("skip", "跳过下次冲动并召回一名将领")].filter((entry) => entry.id !== "discard" || G.powers[pending.responding].cards.some((id) => id !== "vq-006"));
    if (pending.step === "leader") return [option("none", "不移动将领"), ...Object.values(G.leaders).filter((leader) => {
        const def = LEADER_BY_ID[leader.id];
        return def?.power === (pending.targetPower ?? power) && def.kind === "army" && G.spaces[leader.location] &&
            (number !== 3 || !G.spaces[leader.location].siege);
    }).map((leader) => option(`leader:${leader.id}`, LEADER_BY_ID[leader.id].name))];
    if (pending.step === "papalBenefit") return [option("none", "不领取额外奖励"), ...(G.discard.includes("vq-024") ? [option("holyLeague", "取回并立即打出 Holy League")] : [])];
    if (pending.step === "resolve") return influenceTracks(G, power).filter((track) => !pending.tracks.includes(track))
        .map((track) => option(`resolve:${track}`, `决议 ${track} 的外交状态`));
    if (pending.step === "influence") return influenceTracks(G, power).filter((track) => influenceValue(G, track, power) < 9)
        .map((track) => option(`influence:${track}`, `向 ${track} 投入 1 影响力`));
    if (pending.step === "unrest") return activeSpaces().filter((space) => ["ottoman", "spain", "hre"].includes(space.home) &&
        !G.spaces[space.id].unrest && totalLand(G, space.id, ownersWithLand(G, space.id)) === 0 &&
        (number !== 28 || neighborsWithin(effects(G).moriscoSpace ?? "granada", 2).includes(space.id)))
        .map((space) => spaceOption(space.id));
    if (number === 1 || number === 21) {
        const result: TutorialEventOption[] = [];
        for (const space of activeSpaces()) {
            const state = G.spaces[space.id];
            if (state.control !== power || state.siege || state.unrest) continue;
            if (number === 21 || (space.home === "ottoman" && !["algiers", "tripoli"].includes(space.id))) result.push(option(`regular:${space.id}`, `增加 1 正规军：${space.name}`));
            if (number === 1 && space.home === "ottoman" && space.ports?.includes("aegean")) result.push(option(`galley:${space.id}`, `增加 1 桨帆船：${space.name}`));
        }
        return result;
    }
    if (number === 2) return ["hre", "venice", "spain"].filter((target) => target === "spain" ? !atWar(G, "ottoman", "spain") :
        target === "hre" ? !atWar(G, "ottoman", "hre") && !G.majorDiplomacyResolved?.includes("hre") :
            !G.powers.ottoman.warsMinors.includes("venice") && !G.minorDiplomacyResolved.includes("venice"))
        .map((target) => option(`war:${target}`, `向 ${target} 宣战`));
    if (number === 13 && power !== "ottoman") return activeSpaces().filter((space) => friendlyControlled(G, power, space.id)).map((space) => spaceOption(space.id));
    if (number === 13 || number === 23 || number === 17) return activeSpaces().flatMap((space) => Object.entries(G.spaces[space.id].land)
        .filter(([owner, stack]) => stack && (number === 17 ? isPower(owner) && owner !== power && landCount(stack) > 0 : stack.merc > 0))
        .map(([owner]) => option(`army:${space.id}:${owner}`, `${space.name} · ${owner}`)));
    if (number === 18) return activeSpaces().filter((space) => isFortifiedSpace(G, space.id) &&
        G.spaces[space.id].control !== space.home && !friendlyController(G, power, G.spaces[space.id].control))
        .map((space) => spaceOption(space.id));
    if (number === 19) return ["papacy", "venice", "hre"].flatMap((track) => (["ottoman", "spain"] as Power[])
        .filter((target) => target !== power && influenceValue(G, track, target) > 0).map((target) => option(`remove:${track}:${target}`, `移除 ${target} 对 ${track} 的影响力`)));
    if (number === 26) {
        if (!pending.space) return activeSpaces().filter((space) => !!G.spaces[space.id].siege &&
            totalLand(G, space.id, ownersWithLand(G, space.id).filter((owner) => owner !== G.spaces[space.id].siege!.by)) <= 3)
            .map((space) => spaceOption(space.id));
        return activeSpaces().filter((space) => space.id !== pending.space && G.spaces[space.id].control === G.spaces[pending.space!].control &&
            (G.spaces[space.id].land[G.spaces[pending.space!].control]?.regular ?? 0) > 0).map((space) => spaceOption(space.id));
    }
    if (number === 27) return [option("card", "从奥斯曼随机抽取 1 张牌"), option("vp", "奥斯曼海盗 VP 减少 1")]
        .filter((entry) => entry.id === "card" ? drawableCards(G, "ottoman").length > 0 : effects(G).piracyVp > 0);
    if (number === 30) return [option("power:ottoman", "奥斯曼帝国"), option("power:spain", "西班牙")].filter((entry) => entry.id !== `power:${power}`);
    if (number === 31) return activeSpaces().filter((space) => !!G.spaces[space.id].siege).map((space) => spaceOption(space.id));
    return [];
};

export const canPlayTutorialEvent = (G: VQGame, power: Power, cardId: string): boolean => {
    const number = cardById(cardId).officialNumber;
    if (number === undefined || number > 31) return false;
    if ([7, 8, 9, 10, 12, 14, 15].includes(number)) return false;
    if (number === 16) return power === "ottoman";
    if (number === 3) return power === "spain" && G.spaces.milan.control === "spain" && !G.spaces.milan.siege && !G.spaces.milan.unrest;
    if (number === 24) return powerVp(G, "ottoman") >= 13 && influenceTracks(G, power).length >= 2;
    if (number === 27) return power !== "ottoman" && !G.spaces.malta.siege;
    if (number === 28) return atWar(G, "ottoman", "spain") && !effects(G).moriscoSpace;
    if (number === 11) return !!effects(G).dragutWindow || G.spaces.tripoli.control === "spain";
    return true;
};

const resolveTrack = (G: VQGame, ctx: Ctx, track: string): void => {
    if (track === "hre") resolveMajorDiplomacy(G, ctx, "hre");
    else resolveMinorDiplomacy(G, ctx, track as MinorPower);
};

export const beginTutorialEvent = (G: VQGame, ctx: Ctx, power: Power, cardId: string, skipCancel = false): void => {
    const number = cardById(cardId).officialNumber!;
    G.tutorialEffects ??= {nextDraw: {}, skip: [], piracyVp: 0};
    if (!skipCancel && power !== "ottoman" && G.powers.ottoman.cards.includes("vq-001") &&
        cardById(cardId).officialKind === "event") {
        G.pendingTutorialEvent = {cardId, power, responding: "ottoman", step: "cancel", remaining: 1, tracks: []};
        prompt(G, ctx);
        return;
    }
    if (number === 4) {resolveMajorDiplomacy(G, ctx, "hre"); return;}
    if (number === 6) {
        G.powers.ottoman.ruler = "selimII";
        effects(G).cyprusTarget = ["cyprus", "candia", "corfu"].find((space) => G.spaces[space].control !== "ottoman");
        G.discard = G.discard.filter((id) => id !== cardId);
        if (!G.removed.includes(cardId)) G.removed.push(cardId);
        return;
    }
    if (number === 16) {G.powers.ottoman.cp += 5; effects(G).haremImpulse = G.impulse; return;}
    if (number === 22) {drawCards(G, ctx, power, 2); effects(G).nextDraw[power] = (effects(G).nextDraw[power] ?? 0) - 1; return;}
    if (number === 29) {effects(G).nextDraw[power] = (effects(G).nextDraw[power] ?? 0) + 1; return;}
    if (number === 11) {
        const fatal = G.spaces.tripoli.control === "spain" || roll(ctx, 1)[0] >= 4;
        for (const space of Object.values(G.spaces)) space.leaders = space.leaders.filter((id) => id !== "dragut");
        for (const zone of Object.values(G.seaZones)) zone.leaders = zone.leaders.filter((id) => id !== "dragut");
        if (fatal) {
            delete G.leaders.dragut;
            G.leaders.uluchAli = {id: "uluchAli", location: "pool", returnTurn: G.year + 1};
            G.discard = G.discard.filter((id) => id !== cardId);
            G.removed.push(cardId);
            if (G.spaces.tripoli.control === "spain") G.powers.ottoman.bonusVp -= 1;
        } else G.leaders.dragut = {id: "dragut", location: "pool", returnTurn: G.year + 1};
        effects(G).dragutWindow = false;
        return;
    }
    let step = "target";
    let remaining = number === 1 ? 4 : number === 21 || number === 25 ? 3 : number === 13 && power === "ottoman" ? 2 : 1;
    if (number === 20 || number === 24) {step = "influence"; remaining = number === 20 ? 3 : 4;}
    if (number === 25) step = "unrest";
    if (number === 3) {
        addLand(G, "milan", "spain", "regular", 1);
        step = "leader";
    }
    if (number === 5) {
        if (G.minorDiplomacyResolved.includes("papacy")) return;
        resolveMinorDiplomacy(G, ctx, "papacy");
        if (minorAlly(G, "papacy") !== "spain") return;
        power = "spain";
        step = "papalBenefit";
    }
    if (number === 28) {
        captureLeaders(G, "granada", ownersWithLand(G, "granada"), "ottoman");
        G.spaces.granada.land = {};
        G.spaces.granada.unrest = true;
        addLand(G, "granada", "ottoman", "regular", 2);
        effects(G).moriscoSpace = "granada";
        step = "unrest";
        remaining = 2;
    }
    G.pendingTutorialEvent = {cardId, power, responding: power, step, remaining, tracks: []};
    if (!tutorialEventOptions(G).length) {delete G.pendingTutorialEvent; return;}
    prompt(G, ctx);
};

export const chooseTutorialEvent = (G: VQGame, ctx: Ctx, args: {choice: string}): void | typeof INVALID_MOVE => {
    const pending = G.pendingTutorialEvent;
    if (!pending || ctx.playerID !== ownerOf(G, pending.responding) || !tutorialEventOptions(G).some((entry) => entry.id === args.choice)) return INVALID_MOVE;
    const power = pending.power;
    const number = cardById(pending.cardId).officialNumber!;
    const [action, target, other] = args.choice.split(":");
    if (pending.step === "cancel") {
        if (action === "cancel") {removeCardFromHand(G, "ottoman", "vq-001"); discardCard(G, "ottoman", "vq-001", true);}
        finish(G, ctx);
        if (action === "continue") beginTutorialEvent(G, ctx, power, pending.cardId, true);
        return;
    }
    if (pending.step === "payment") {
        const stack = G.spaces[pending.space!].land[pending.targetPower!]!;
        const retained = action === "card" ? cardById(target).cp >= 4 ? stack.regular : Math.min(stack.regular, cardById(target).cp * 2) : 0;
        if (action === "card") {removeCardFromHand(G, pending.responding, target); discardCard(G, pending.responding, target, false);}
        stack.regular = retained;
        G.spaces[pending.space!].unrest = true;
        finish(G, ctx);
        return;
    }
    if (pending.step === "tribute") {
        if (action === "offer") {pending.step = "acceptTribute"; pending.responding = "ottoman"; prompt(G, ctx); return;}
        pending.step = "acceptTribute";
        return chooseTutorialEvent(G, {...ctx, playerID: ownerOf(G, "ottoman")}, {choice: "reject"});
    }
    if (pending.step === "acceptTribute") {
        if (action === "accept") {
            const id = shuffle(ctx, drawableCards(G, "spain"))[0];
            if (id) {removeCardFromHand(G, "spain", id); G.powers.ottoman.cards.push(id);}
            drawCards(G, ctx, "ottoman", 1);
        } else {
            if (pending.space === "venice") {
                G.powers.ottoman.warsMinors.push("venice");
                resolveMinorDiplomacy(G, ctx, "venice", {exclude: ["ottoman"]});
            } else setWar(G, "ottoman", pending.space as Power);
            G.powers.ottoman.cp += 2;
        }
        finish(G, ctx);
        return;
    }
    if (pending.step === "papalBenefit") {
        finish(G, ctx);
        if (action === "holyLeague") {
            G.discard = G.discard.filter((id) => id !== "vq-024");
            G.discard.push("vq-024");
            beginTutorialEvent(G, ctx, "spain", "vq-024");
        }
        return;
    }
    if (pending.step === "influence") {
        setInfluence(G, target, power, influenceValue(G, target, power) + 1);
        pending.remaining -= 1;
        if (pending.remaining === 0) {pending.step = "resolve"; pending.remaining = number === 24 ? 2 : 1;}
    } else if (pending.step === "resolve") {
        resolveTrack(G, ctx, target);
        pending.tracks.push(target);
        pending.remaining -= 1;
    } else if (pending.step === "unrest") {
        G.spaces[target].unrest = true;
        pending.remaining -= 1;
    } else if (pending.step === "leader") {
        if (action === "leader") {
            const leader = G.leaders[target];
            const destination = number === 3 ? "milan" : capitalOf(G, pending.targetPower!)!;
            if (destination) moveLeaders(G, leader.location, destination, [target]);
        }
        pending.remaining = 0;
    } else if (pending.step === "illness") {
        if (action === "discard") {
            const id = shuffle(ctx, G.powers[pending.responding].cards.filter((id) => id !== "vq-006"))[0];
            if (id) {removeCardFromHand(G, pending.responding, id); discardCard(G, pending.responding, id, false);}
            pending.remaining = 0;
        } else {
            effects(G).skip.push(pending.responding);
            pending.targetPower = pending.responding;
            pending.responding = power;
            pending.step = "leader";
        }
    } else if (number === 1 || number === 21) {
        if (action === "regular") addLand(G, target, power, "regular", 1);
        else addNaval(G, target, power, "galley", 1);
        pending.remaining -= 1;
    } else if (number === 2) {
        pending.space = target;
        pending.step = "tribute";
        pending.responding = "spain";
    } else if (number === 13 && power !== "ottoman") {
        const nearHre = neighborsWithin(target, 2).some((id) => SPACE_BY_ID[id]?.home === "hre");
        addLand(G, target, power, "merc", nearHre ? 4 : 2);
        pending.remaining = 0;
    } else if (number === 13 || number === 23) {
        G.spaces[target].land[other as Controller]!.merc = number === 23 ? 0 : Math.max(0, G.spaces[target].land[other as Controller]!.merc - 1);
        pending.remaining -= 1;
    } else if (number === 17) {
        G.spaces[target].land[other as Power]!.merc = 0;
        pending.space = target;
        pending.targetPower = other as Power;
        pending.responding = other as Power;
        pending.step = "payment";
    } else if (number === 18) {
        const state = G.spaces[target];
        const owner = state.control;
        const count = hits(roll(ctx, 5));
        const units = state.land[owner];
        if (units) {
            let remaining = count;
            for (const kind of ["merc", "regular", "cav"] as const) {const lost = Math.min(units[kind], remaining); units[kind] -= lost; remaining -= lost;}
        }
        if (totalLand(G, target, ownersWithLand(G, target)) + totalNaval(G, target, Object.keys(state.naval) as Controller[]) === 0) {
            captureLeaders(G, target, [owner], power);
            state.control = SPACE_BY_ID[target].home;
            addLand(G, target, state.control, "regular", 1);
        }
        pending.remaining = 0;
    } else if (number === 19) {
        setInfluence(G, target, other as Power, Math.max(0, influenceValue(G, target, other as Power) - 5));
        pending.remaining = 0;
    } else if (number === 26) {
        if (!pending.space) pending.space = target;
        else {
            const owner = G.spaces[pending.space].control;
            G.spaces[target].land[owner]!.regular -= 1;
            addLand(G, pending.space, owner, "regular", 1);
            pending.remaining = 0;
        }
    } else if (number === 27) {
        if (action === "card") {const id = shuffle(ctx, drawableCards(G, "ottoman"))[0]; removeCardFromHand(G, "ottoman", id); G.powers[power].cards.push(id);}
        else {effects(G).piracyVp -= 1; G.powers.ottoman.bonusVp -= 1;}
        pending.remaining = 0;
    } else if (number === 30) {
        pending.responding = target as Power;
        pending.step = "illness";
    } else if (number === 31) {
        const attacker = G.spaces[target].siege!.by;
        const defenders = ownersWithLand(G, target).filter((owner) => !friendlyController(G, attacker, owner));
        finish(G, ctx);
        startBattle(G, ctx, "assault", target, attacker, defenders, target);
        G.pendingBattle!.treachery = true;
        return;
    }
    pushLog(G, `${cardById(pending.cardId).name}: ${args.choice}`);
    if (pending.remaining <= 0 || tutorialEventOptions(G).length === 0) finish(G, ctx);
    else prompt(G, ctx);
};
