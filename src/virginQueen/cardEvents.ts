import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {CardDef, Power, VQGame, landCount} from "./constant/general";
import {LEADER_BY_ID} from "./constant/leaders";
import {SPACE_BY_ID, SPACES} from "./mapData";
import {ownerOf} from "./ownership";
import {tutorialSpaceAllowed} from "./tutorial";
import {addLand, addNaval, ensureDefaultLeader, pushLog, removeCardFromGame, resolveEvent, spaceHasEnemyLand, spaceHasEnemyNaval} from "./util";

export interface CardEventOption {id: string; label: string}

export const isGrandVizier = (card: CardDef): boolean => card.officialNumber === 1 || card.id === "vq-home-grand-vizier";
export const grandVizierInHand = (G: VQGame): string | undefined => G.powers.ottoman.cards.find((id) =>
    id === "vq-001" || id === "vq-home-grand-vizier");

const recruitmentOptions = (G: VQGame): CardEventOption[] => {
    const options: CardEventOption[] = [];
    for (const space of SPACES) {
        const state = G.spaces[space.id];
        if (space.home !== "ottoman" || state.control !== "ottoman" || state.siege || state.unrest ||
            (G.scenario === "tutorial" && !tutorialSpaceAllowed(space.id)) ||
            spaceHasEnemyLand(G, "ottoman", space.id) || spaceHasEnemyNaval(G, "ottoman", space.id)) continue;
        if (!["algiers", "tripoli"].includes(space.id)) options.push({id: `regular:${space.id}`, label: `增加 1 正规军：${space.name}`});
        if (space.ports?.includes("aegean")) options.push({id: `galley:${space.id}`, label: `增加 1 桨帆船：${space.name}`});
    }
    const war = G.foreignWars.ottoman;
    if (G.scenario !== "tutorial" && war?.status === "active" && landCount(war.units) < 8) {
        options.push({id: "regular:foreignWar", label: "增加 1 正规军：波斯境外战争"});
    }
    return options;
};

const effectOptions = (G: VQGame, numPlayers: number): CardEventOption[] => [
    ...(recruitmentOptions(G).length ? [{id: "recruit", label: "增募 4 个正规军／桨帆船"}] : []),
    ...(G.scenario !== "tutorial" && [5, 6].includes(numPlayers) && !G.suezDone
        ? [{id: "suez", label: "尝试建造苏伊士运河"}] : []),
];

export const canPlayGrandVizier = (G: VQGame, power: Power, numPlayers: number): boolean =>
    power === "ottoman" && effectOptions(G, numPlayers).length > 0;

/** Only ordinary Event cards can be cancelled, even if another card is played as an event. */
export const canCancelCardEvent = (G: VQGame, card: CardDef): boolean =>
    (card.officialKind === "event" || (card.officialKind === undefined && card.kind === "event")) &&
    grandVizierInHand(G) !== undefined && ownerOf(G, "ottoman") !== undefined;

export const cardEventOptions = (G: VQGame, numPlayers: number): CardEventOption[] => {
    const pending = G.pendingCardEvent;
    if (!pending) return [];
    if (pending.kind === "cancelEvent") return [
        {id: "continue", label: "允许事件结算"},
        ...(grandVizierInHand(G) ? [{id: "cancel", label: "打出大维齐尔，取消事件"}] : []),
    ];
    return pending.step === "effect" ? effectOptions(G, numPlayers) : recruitmentOptions(G);
};

export const beginGrandVizierEvent = (G: VQGame, ctx: Ctx, cardId: string): void => {
    G.pendingCardEvent = {kind: "grandVizier", cardId, responding: "ottoman", step: "effect", remaining: 4};
    ctx.events?.setActivePlayers({value: {[ownerOf(G, "ottoman")!]: "cardEvent"}});
};

export const chooseGrandVizierEvent = (G: VQGame, ctx: Ctx, choice: string): void | typeof INVALID_MOVE => {
    const pending = G.pendingCardEvent;
    if (pending?.kind !== "grandVizier" || ctx.playerID !== ownerOf(G, "ottoman") ||
        !cardEventOptions(G, ctx.numPlayers).some((option) => option.id === choice)) return INVALID_MOVE;
    if (pending.step === "effect") {
        if (choice === "recruit") {
            pending.step = "recruit";
            return;
        }
        resolveEvent(G, ctx, "ottoman", {kind: "suez"});
    } else {
        const [kind, target] = choice.split(":");
        if (target === "foreignWar") G.foreignWars.ottoman!.units.regular += 1;
        else if (kind === "regular") addLand(G, target, "ottoman", "regular", 1);
        else addNaval(G, target, "ottoman", "galley", 1);
        pending.remaining -= 1;
        pushLog(G, `Grand Vizier adds 1 ${kind} in ${SPACE_BY_ID[target]?.name ?? "the Persia foreign war"}.`);
        if (pending.remaining > 0 && recruitmentOptions(G).length > 0) return;
    }
    delete G.pendingCardEvent;
    ctx.events?.endStage();
};

/** Leaders printed on #76 Untimely Death. */
export const UNTIMELY_DEATH_LEADERS = ["piyale", "donJohn", "montmorency", "alba", "santaCruz", "leicester", "zrinyi"];

/**
 * Listed leaders that are still in the game: on the map, captured, or waiting to arrive.
 * Leaders excluded by the scenario or already killed are not legal targets.
 */
export const untimelyDeathTargets = (G: VQGame): string[] =>
    UNTIMELY_DEATH_LEADERS.filter((id) => G.leaders[id] !== undefined && G.leaders[id].location !== "offMap");

/** "none" is only legal when no listed leader remains; the Mandatory Event still has to be played. */
export const canPlayUntimelyDeath = (G: VQGame, target?: string): boolean => {
    const targets = untimelyDeathTargets(G);
    return targets.length === 0 ? target === "none" : target !== undefined && targets.includes(target);
};

export const resolveUntimelyDeath = (G: VQGame, target: string): void => {
    if (target === "none") {
        pushLog(G, "Untimely Death: no listed leader remains in play.");
        return;
    }
    const location = G.leaders[target].location;
    if (G.spaces[location] !== undefined) G.spaces[location].leaders = G.spaces[location].leaders.filter((id) => id !== target);
    const zone = G.seaZones[location as keyof VQGame["seaZones"]];
    if (zone !== undefined) zone.leaders = zone.leaders.filter((id) => id !== target);
    for (const war of Object.values(G.foreignWars)) if (war?.leaderId === target) delete war.leaderId;
    delete G.leaders[target];
    if (target === "dragut") removeCardFromGame(G, "vq-011");
    pushLog(G, `Untimely Death: ${LEADER_BY_ID[target]?.name ?? target} is removed from the game.`);
    const power = LEADER_BY_ID[target]?.power;
    const armyLeader = LEADER_BY_ID[target]?.kind === "army";
    if (armyLeader && power !== undefined) ensureDefaultLeader(G, power);
};
