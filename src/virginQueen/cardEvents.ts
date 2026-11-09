import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {CardDef, Power, VQGame, landCount, spaceHomes} from "./constant/general";
import {LEADER_BY_ID} from "./constant/leaders";
import {SPACE_BY_ID, SPACES, mapName} from "./mapData";
import i18n from "../constant/i18n";
import {ownerOf} from "./ownership";
import {tutorialSpaceAllowed} from "./tutorial";
import {addLand, addNaval, ensureDefaultLeader, pushLog, removeCardFromGame, resolveEvent, spaceHasEnemyLand, spaceHasEnemyNaval} from "./util";

export interface CardEventOption {id: string; label: string}

export const isGrandVizier = (card: CardDef): boolean => card.officialNumber === 1 || card.id === "vq-home-grand-vizier";
export const grandVizierInHand = (G: VQGame): string | undefined => G.powers.ottoman.cards.find((id) =>
    id === "vq-001" || id === "vq-home-grand-vizier");

export const recruitmentOptions = (G: VQGame): CardEventOption[] => {
    const options: CardEventOption[] = [];
    for (const space of SPACES) {
        const state = G.spaces[space.id];
        if (!spaceHomes(space).includes("ottoman") || state.control !== "ottoman" || state.siege || state.unrest ||
            (G.scenario === "tutorial" && !tutorialSpaceAllowed(space.id)) ||
            spaceHasEnemyLand(G, "ottoman", space.id) || spaceHasEnemyNaval(G, "ottoman", space.id)) continue;
        if (!["algiers", "tripoli"].includes(space.id)) options.push({id: `regular:${space.id}`, label: i18n.chain.vq.engine.addRegularTo.replace("{space}", mapName(space.id))});
        if (space.ports?.includes("aegean")) options.push({id: `galley:${space.id}`, label: i18n.chain.vq.engine.addGalleyTo.replace("{space}", mapName(space.id))});
    }
    const war = G.foreignWars.ottoman;
    if (G.scenario !== "tutorial" && war?.status === "active" && landCount(war.units) < 8) {
        options.push({id: "regular:foreignWar", label: i18n.chain.vq.engine.addRegularPersia});
    }
    return options;
};

const effectOptions = (G: VQGame, numPlayers: number): CardEventOption[] => [
    ...(recruitmentOptions(G).length ? [{id: "recruit", label: i18n.chain.vq.engine.recruitFour}] : []),
    ...(G.scenario !== "tutorial" && [5, 6].includes(numPlayers) && !G.suezDone
        ? [{id: "suez", label: i18n.chain.vq.engine.attemptSuez}] : []),
];

export const canPlayGrandVizier = (G: VQGame, power: Power, numPlayers: number): boolean =>
    power === "ottoman" && effectOptions(G, numPlayers).length > 0;

// Only ordinary Event cards can be cancelled, even if another card is played
// as an event. Printed list on #42: Foxe's Book of Martyrs (#52), Iconoclastic Fury (#55),
// Jeanne of Navarre (#58), plus Army Mutiny (#17), City State Rebels (#18),
// German Recruitment Curtailed (#23), Sack! (#44) and Treachery! (#31) when
// they target France. Huguenot Lent (#54) is not on the card.
const CATHERINE_CANCELABLE = new Set(["vq-017", "vq-018", "vq-023", "vq-031", "vq-044", "vq-052", "vq-055", "vq-058"]);

export const cancelEventResponder = (G: VQGame, card: CardDef): {power: Power; cardId: string} | undefined => {
    if (!(card.officialKind === "event" || card.id === "vq-033" || card.id === "vq-044" || card.id === "vq-058" || (card.officialKind === undefined && card.kind === "event"))) return undefined;
    const vizier = grandVizierInHand(G);
    if (vizier !== undefined && ownerOf(G, "ottoman") !== undefined) return {power: "ottoman", cardId: vizier};
    if (card.id === "vq-033") {
        const holder = (["ottoman", "spain", "england", "france", "hre", "protestant"] as Power[])
            .find((power) => ownerOf(G, power) !== undefined && G.powers[power].cards.includes("vq-058"));
        return holder === undefined ? undefined : {power: holder, cardId: "vq-058"};
    }
    if (!CATHERINE_CANCELABLE.has(card.id)) return undefined;
    const holder = (["ottoman", "spain", "england", "france", "hre", "protestant"] as Power[])
        .find((power) => ownerOf(G, power) !== undefined && G.powers[power].cards.includes("vq-042"));
    return holder === undefined ? undefined : {power: holder, cardId: "vq-042"};
};

export const canCancelCardEvent = (G: VQGame, card: CardDef): boolean => cancelEventResponder(G, card) !== undefined;

export const cardEventOptions = (G: VQGame, numPlayers: number): CardEventOption[] => {
    const pending = G.pendingCardEvent;
    if (!pending) return [];
    if (pending.kind === "cancelEvent") {
        const responseCard = pending.responseCard ?? (pending.responding === "ottoman" ? grandVizierInHand(G) : undefined);
        return [
            {id: "continue", label: i18n.chain.vq.engine.allowEventResolution},
            ...(responseCard ? [{id: "cancel", label: responseCard === "vq-042" ? i18n.chain.vq.engine.playCatherinePrivateer : responseCard === "vq-058" ? i18n.chain.vq.engine.playJeanneOfNavarre : i18n.chain.vq.engine.playGrandVizierCancel}] : []),
        ];
    }
    return pending.step === "effect" ? effectOptions(G, numPlayers) : recruitmentOptions(G);
};

export const beginGrandVizierEvent = (G: VQGame, ctx: Ctx, cardId: string, choice?: string): void => {
    // The card drawer now asks for the branch before the event starts:
    // "recruit" opens the four-unit placement stage directly and "suez"
    // resolves the canal attempt without an intermediate option panel.
    if (choice === "suez") {
        resolveEvent(G, ctx, "ottoman", {kind: "suez"});
        return;
    }
    const step = choice === "recruit" ? "recruit" : "effect";
    G.pendingCardEvent = {kind: "grandVizier", cardId, responding: "ottoman", step, remaining: 4};
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
