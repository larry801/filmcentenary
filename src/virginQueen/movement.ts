import {Controller, LandStack, MinorPower, Power, VQGame, isPower, landCount, navalCount, spaceHomes} from "./constant/general";
import {LEADER_BY_ID} from "./constant/leaders";
import {SEA_ZONE_BY_ID, SPACE_BY_ID, inlandPortLink, isInlandPort} from "./mapData";
import {moveError} from "./movePolicy";
import {atWar, atWarWithMinor, canMoveLandTo, formationCapacity, friendlyController, friendlyControlled, inFrenchReligiousArea, isPort, isSeaZone, passBetween, portZones, spaceHasEnemyNaval, springTargetsFrom, warCost} from "./util";

export type MovementIssue = "illegalTarget" | "invalidFormation" | "formationCapacity" | "transportCapacity" | "movementCp" | "transportRoute";
export interface FormationOrder {
    from: string;
    to: string;
    units: Partial<LandStack>;
    leaders: string[];
}

/** Used by the move guards and the board, so rejected selections remain editable. */
export const formationIssue = (G: VQGame, owner: Controller, order: FormationOrder, transport = false): MovementIssue | undefined => {
    const source = G.spaces[order.from];
    const available = source?.land[owner];
    const units = {regular: order.units.regular ?? 0, merc: order.units.merc ?? 0, cav: order.units.cav ?? 0};
    if (!available || landCount(units) < 1 || Object.entries(units).some(([kind, count]) =>
        !Number.isInteger(count) || count < 0 || count > available[kind as keyof LandStack])) return "invalidFormation";
    if (new Set(order.leaders).size !== order.leaders.length || order.leaders.some((id) =>
        !source.leaders.includes(id) || LEADER_BY_ID[id]?.power !== owner || LEADER_BY_ID[id]?.kind !== "army")) return "invalidFormation";
    if ((transport || G.scenario === "tutorial") && order.leaders.length > 2) return "invalidFormation";
    if (transport && landCount(units) > 5) return "transportCapacity";
    if (landCount(units) > formationCapacity(order.leaders)) return "formationCapacity";
    if (order.leaders.includes("guise") && !inFrenchReligiousArea(order.to)) return "illegalTarget";
    return undefined;
};

/** Stage a legal-sized formation, including when the unit owner is an ally. */
export const defaultFormation = (G: VQGame, from: string, owner: Controller, transport = false) => {
    const leaders = (G.spaces[from]?.leaders ?? [])
        .filter((id) => LEADER_BY_ID[id]?.power === owner && LEADER_BY_ID[id]?.kind === "army").slice(0, 2);
    const available = G.spaces[from]?.land[owner];
    let remaining = Math.min(formationCapacity(leaders), transport ? 5 : Infinity);
    const units: LandStack = {regular: 0, merc: 0, cav: 0};
    for (const kind of ["regular", "merc", "cav"] as const) {
        units[kind] = Math.min(available?.[kind] ?? 0, remaining);
        remaining -= units[kind];
    }
    return {units, leaders};
};

export const landMoveIssue = (G: VQGame, power: Power, order: FormationOrder, owner: Controller = power): MovementIssue | undefined => {
    const issue = formationIssue(G, owner, order);
    if (issue) return issue;
    if (G.powers[power].cp < (passBetween(order.from, order.to) ? 2 : 1)) return "movementCp";
    if (!friendlyController(G, power, owner) || moveError(G, "moveLand", order) ||
        !canMoveLandTo(G, power, order.from, order.to, owner)) return "illegalTarget";
    if (G.lostBattleImpulse?.impulse === G.impulse && G.lostBattleImpulse.owners.includes(owner)) return "illegalTarget";
    return undefined;
};

export const springMoveIssue = (G: VQGame, power: Power, order: FormationOrder): MovementIssue | undefined => {
    const issue = formationIssue(G, power, order);
    if (issue) return issue;
    const count = (order.units.regular ?? 0) + (order.units.merc ?? 0) + (order.units.cav ?? 0);
    if (moveError(G, "springDeploy", order) || !springTargetsFrom(G, power, order.from, count).has(order.to)) return "illegalTarget";
    return undefined;
};

export const transportMoveIssue = (G: VQGame, power: Power, order: FormationOrder & {zones: string[]}): MovementIssue | undefined => {
    const issue = formationIssue(G, power, order, true);
    if (issue) return issue;
    const {from, to, zones} = order;
    const source = G.spaces[from];
    const destination = G.spaces[to];
    if (moveError(G, "navalTransport", order) || G.navalTransportImpulse === G.impulse ||
        !source || !destination || (source.siege && source.siege.by !== power) ||
        !isPort(from) || !isPort(to) || from === to) return "illegalTarget";
    if (zones.length === 0 || new Set(zones).size !== zones.length ||
        !portZones(from).includes(zones[0] as keyof VQGame["seaZones"]) ||
        !portZones(to).includes(zones[zones.length - 1] as keyof VQGame["seaZones"]) ||
        zones.some((zone, index) => !isSeaZone(zone) || navalCount(G.seaZones[zone as keyof VQGame["seaZones"]].naval[power]) === 0 ||
            (index > 0 && !SEA_ZONE_BY_ID[zones[index - 1]]?.adjacent.includes(zone as keyof VQGame["seaZones"])))) return "transportRoute";
    const inland = isInlandPort(from) ? from : isInlandPort(to) ? to : undefined;
    if (inland && (zones.length !== 1 || zones[0] !== "northSea" || G.spaces[inlandPortLink(inland)!].control !== power)) return "transportRoute";
    if (G.powers[power].cp < zones.length + 1 - (inland ? 1 : 0)) return "movementCp";
    if (power === "spain" && spaceHomes(SPACE_BY_ID[to]).some((home) => home === "ireland" || home === "scotland") && warCost(G, "spain", "england") > 3) return "illegalTarget";
    // These entries declare the England-Spain war before the destination check.
    const declaresWar = (power === "england" && destination.control === "spain" && SPACE_BY_ID[to]?.area === "netherlands") ||
        (power === "spain" && destination.control === "england" && spaceHomes(SPACE_BY_ID[to]).some((home) => home === "ireland" || home === "scotland"));
    if (spaceHasEnemyNaval(G, power, to) || (!declaresWar && !friendlyControlled(G, power, to) && destination.control !== "independent" &&
        !(isPower(destination.control) ? atWar(G, power, destination.control) : atWarWithMinor(G, power, destination.control as MinorPower)))) return "illegalTarget";
    return undefined;
};
