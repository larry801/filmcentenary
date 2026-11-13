import {Controller, controllerName, isPower, MinorPower, minorName, Power, powerName, POWERS, spaceHomes, VQGame} from "./constant/general";
import {cardById} from "./constant/cards";
import {MINOR_DIPLOMACY} from "./data/minorDiplomacy";
import {WORLD_SETTLEMENT_BY_ID} from "./data/world";
import {SPACES, SPACE_BY_ID, spaceName} from "./mapData";
import {ownerOf} from "./ownership";
import {patronById, seaCaptainById, seaCaptainName, patronName} from "./scenario";
import {atWar, allied, defenderLandCount, isCityRebelsTarget, isFortifiedSpace, landNeighbors, minorAvailable, ottomanTributeTargets, ownersWithLand, zonePorts} from "./util";
import i18n from "../constant/i18n";

type VQLocale = "en" | "zh_CN";

const locale = (): VQLocale => (i18n.getLocaleName() === "en" ? "en" : "zh_CN");
const text = (zh: string, en: string): string => (locale() === "en" ? en : zh);

export interface EventTargetOption {
    /** Argument forwarded to `playCard`; "" means "use the engine's automatic choice". */
    value: string;
    label: string;
}

const autoOption = (): EventTargetOption => ({value: "", label: i18n.chain.vq.board.eventTargetAuto});
const powerOption = (power: Power): EventTargetOption => ({value: power, label: powerName(power, locale())});
const spaceOption = (id: string, suffix?: string): EventTargetOption => ({
    value: id,
    label: `${SPACE_BY_ID[id] !== undefined ? spaceName(id, locale()) : id}${suffix === undefined ? "" : suffix}`,
});
const areaOption = (area: string): EventTargetOption => ({
    value: area,
    label: ({
        england: text("英格兰", "England"),
        scotland: text("苏格兰", "Scotland"),
        netherlands: text("尼德兰", "Netherlands"),
        france: text("法兰西", "France"),
    } as Record<string, string>)[area] ?? area,
});
const captainOption = (id: string): EventTargetOption => ({value: id, label: seaCaptainName(seaCaptainById(id), locale())});
const patronOption = (G: VQGame, id: string): EventTargetOption => {
    const patron = patronById(G, id);
    return {value: id, label: patronName(patron === undefined ? undefined : {nameEn: patron.name, nameZh: patron.nameZh}, locale())};
};
const colonyOption = (id: string): EventTargetOption => {
    const def = WORLD_SETTLEMENT_BY_ID[id];
    return {value: id, label: def === undefined ? id : (locale() === "en" ? def.nameEn : def.nameZh)};
};

/**
 * Enumerable targets for event cards that do not have an effect-branch entry or
 * a dedicated selector.  The card drawer renders these as a dropdown instead of
 * the old free-text "事件目标（可选）" field, so every legal target is visible.
 *
 * An empty value is only offered when the printed effect allows resolving
 * without a target (the engine then applies its automatic choice).
 */
export const eventTargetOptions = (G: VQGame, cardId: string, power: Power): EventTargetOption[] => {
    switch (cardId) {
        case "vq-002": {
            // Spain, the HRE and Venice; Venice is a minor power with no seat,
            // so its label comes from the minor-power table.  The shared helper
            // also drops Venice once the Ottoman has blocked its track.
            return ottomanTributeTargets(G).map((target) => target !== "venice"
                ? powerOption(target)
                : {value: target, label: minorName("venice", locale())});
        }
        case "vq-018": {
            return SPACES.filter((space) => isCityRebelsTarget(G, space.id)).map((space) => spaceOption(space.id));
        }
        case "vq-019": {
            return POWERS
                .filter((target) => target !== power && ownerOf(G, target) !== undefined &&
                    Object.values(G.powers[target].influence).some((value) => (value ?? 0) > 0))
                .map(powerOption);
        }
        case "vq-020": {
            return (Object.keys(MINOR_DIPLOMACY) as MinorPower[])
                .filter((minor) => MINOR_DIPLOMACY[minor].eligible.includes(power) && minorAvailable(G, minor))
                .map((minor) => ({value: minor, label: minorName(minor, locale())}));
        }
        case "vq-025": {
            return (["ottoman", "hre", "spain"] as Power[]).map(powerOption);
        }
        case "vq-026": {
            return SPACES
                .filter((space) => G.spaces[space.id].siege !== undefined && isFortifiedSpace(G, space.id) &&
                    defenderLandCount(G, space.id) <= 3)
                .map((space) => spaceOption(space.id,
                    ` (${controllerName(G.spaces[space.id].control, locale())})`));
        }
        case "vq-031": {
            return SPACES
                .filter((space) => G.spaces[space.id].siege !== undefined)
                .map((space) => spaceOption(space.id,
                    ` (${controllerName(G.spaces[space.id].siege!.by as Controller, locale())})`));
        }
        case "vq-034": {
            const options: EventTargetOption[] = [];
            for (const ally of POWERS) {
                for (const enemy of POWERS) {
                    if (ally === enemy || !atWar(G, ally, enemy) || allied(G, "hre", enemy)) continue;
                    options.push({value: `${ally}:${enemy}`,
                        label: `${powerName(ally, locale())} + ${powerName(enemy, locale())}`});
                }
            }
            return options;
        }
        case "vq-043":
        case "vq-045": {
            return Object.keys(G.worldCaptains).map(captainOption);
        }
        case "vq-044": {
            const capture = G.lastCapture;
            return capture !== undefined && capture.impulse === G.impulse && capture.attacker === power &&
                G.spaces[capture.space]?.control === power ? [spaceOption(capture.space)] : [];
        }
        case "vq-046": {
            return POWERS.filter((target) => target !== "spain" && ownerOf(G, target) !== undefined).map(powerOption);
        }
        case "vq-048": {
            return G.patronsAvailable.filter((id) => {
                const patron = patronById(G, id);
                return patron?.region === "italy" && patron.rating !== null &&
                    !POWERS.some((candidate) => G.powers[candidate].patrons.includes(id)) &&
                    !G.patronizedThisTurn.includes(`${power}:${patron.kind}`);
            }).map((id) => patronOption(G, id));
        }
        case "vq-051": {
            return Object.entries(G.worldCaptains)
                .filter(([, captain]) => ["spanishMain", "antilles"].includes(captain.location))
                .map(([id]) => captainOption(id));
        }
        case "vq-052": {
            return ["france", "netherlands", "scotland"].map(areaOption);
        }
        case "vq-055": {
            return ["france", "netherlands"].map(areaOption);
        }
        case "vq-062": {
            return Object.entries(G.worldCaptains)
                .filter(([, captain]) => ["northAtlantic", "guineaCoast"].includes(captain.location))
                .map(([id]) => captainOption(id));
        }
        case "vq-064": {
            return [...new Set(G.pendingPatronage
                .filter((entry) => patronById(G, entry.patronId)?.kind === "scientist")
                .map((entry) => entry.patronId))]
                .map((id) => patronOption(G, id));
        }
        case "vq-066": {
            return SPACES
                .filter((space) => space.area === "netherlands" && spaceHomes(space).includes("protestant") &&
                    space.ports?.includes("northSea") && G.spaces[space.id].control !== "protestant" &&
                    ownersWithLand(G, space.id).length === 0)
                .map((space) => spaceOption(space.id));
        }
        case "vq-068": {
            return [autoOption(), ...POWERS.filter((target) => target !== power && ownerOf(G, target) !== undefined).map(powerOption)];
        }
        case "vq-070": {
            return ["england", "scotland", "netherlands", "france"].map(areaOption);
        }
        case "vq-071": {
            return POWERS
                .filter((target) => target !== power && G.powers[target].cards.some((id) => cardById(id).kind !== "home"))
                .flatMap((target) => [
                    {value: target, label: `${powerName(target, locale())} · ${text("随机抽取一张", "Take a random card")}`},
                    {value: `${target}:discard`, label: `${powerName(target, locale())} · ${text("弃置一张", "Discard a card")}`},
                ]);
        }
        case "vq-075": {
            return Object.keys(G.worldColonies)
                .filter((id) => ["atlanticCoast", "northAmerica"].includes(WORLD_SETTLEMENT_BY_ID[id]?.region ?? ""))
                .map(colonyOption);
        }
        case "vq-077": {
            return Object.entries(G.worldColonies)
                .filter(([id, owner]) => owner !== "spain" &&
                    ["southAtlantic", "indianOcean", "southPacific"].includes(WORLD_SETTLEMENT_BY_ID[id]?.seaZone ?? ""))
                .map(([id]) => colonyOption(id));
        }
        case "vq-101": {
            return POWERS.filter((target) => ownerOf(G, target) !== undefined).map(powerOption);
        }
        case "vq-107": {
            return SPACES
                .filter((space) => space.area === "england" && ownersWithLand(G, space.id).length === 0 && !G.spaces[space.id].unrest)
                .map((space) => spaceOption(space.id));
        }
        case "vq-108": {
            return ["england", "scotland"].map(areaOption);
        }
        case "vq-109": {
            return [autoOption(), ...[4, 3, 2, 1, 0].map((guards) => ({
                value: `guards:${guards}`,
                label: text(`至多 ${guards} 支瓦隆卫队`, `Up to ${guards} Walloon guard(s)`),
            }))];
        }
        case "vq-110": {
            return [autoOption(), ...zonePorts("northSea")
                .filter((id) => ["england", "protestant"].includes(String(G.spaces[id].control)) && !G.spaces[id].unrest)
                .map((id) => spaceOption(id))];
        }
        case "vq-111": {
            const region = ["paris", ...landNeighbors("paris").map((neighbor) => neighbor.id)];
            return [autoOption(), ...region.filter((id) => G.spaces[id] !== undefined).map((id) => spaceOption(id))];
        }
        default:
            return [];
    }
};

/** Resolves a stored target against the current legal options. */
export const eventTargetValue = (options: EventTargetOption[], selected: string | undefined): string | undefined => {
    const value = options.some((option) => option.value === selected) ? selected ?? "" : options[0]?.value ?? "";
    return value === "" ? undefined : value;
};
