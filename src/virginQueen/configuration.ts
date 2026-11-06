import {POWER_NAMES, POWERS, Power, ScenarioID, VQLocale} from "./constant/general";
import {SCENARIOS} from "./data/scenarios";

export const SCENARIO_OPTIONS: {id: ScenarioID; label: string; players: number[]}[] = [
    {id: "campaign", label: "Campaign · 拉罗谢尔之围", players: [2, 3, 4, 5, 6]},
    {id: "tournament", label: "Tournament · 荷兰起义开始", players: [2, 3, 4, 5, 6]},
    {id: "tutorial", label: "教学 · 勒班陀海战", players: [2]},
];

const SCENARIO_PREFIX: Record<ScenarioID, {en: string; zh: string}> = {
    campaign: {en: "Campaign", zh: "Campaign"},
    tournament: {en: "Tournament", zh: "Tournament"},
    tutorial: {en: "Tutorial", zh: "教学"},
};

/**
 * Lobby/hotseat label for a scenario.  Resolved at render time so the option
 * list follows the active locale instead of the import-time default.
 */
export const scenarioOptionLabel = (id: ScenarioID, locale: VQLocale = "zh_CN"): string => {
    const lang = locale === "en" ? "en" : "zh";
    const setup = SCENARIOS[id];
    const name = lang === "en" ? (setup.nameEn ?? setup.nameZh) : setup.nameZh;
    return `${SCENARIO_PREFIX[id][lang]} · ${name}`;
};

export const seatLabels = (scenario: ScenarioID, numPlayers: number, locale: VQLocale = "zh_CN"): string[] => {
    const lang = locale === "en" ? "en" : "zh";
    const name = (power: Power): string => POWER_NAMES[power][lang];
    if (numPlayers === 6) return POWERS.map(name);
    if (numPlayers === 5) return POWERS.filter((power) => power !== "hre").map(name);
    if (numPlayers === 4) return (["spain", "england", "france", "protestant"] as Power[]).map(name);
    if (numPlayers === 3) return [name("spain"), `${name("england")} / ${name("protestant")}`, name("france")];
    return scenario === "tutorial"
        ? [name("ottoman"), name("spain")]
        : [`${name("spain")} / ${name("france")}`, `${name("england")} / ${name("protestant")}`];
};

export const validateSetupData = (setupData: unknown, numPlayers: number, locale: VQLocale = "zh_CN"): string | undefined => {
    const english = locale === "en";
    if (setupData !== undefined && (typeof setupData !== "object" || setupData === null || Array.isArray(setupData))) {
        return english ? "The scenario configuration must be an object." : "场景配置必须是对象。";
    }
    const configuredScenario = (setupData as {scenario?: unknown} | undefined)?.scenario;
    const scenario = configuredScenario === undefined ? "campaign" : configuredScenario;
    const option = SCENARIO_OPTIONS.find((entry) => entry.id === scenario);
    if (!option) {
        return english
            ? "Unknown scenario: choose campaign, tournament or tutorial."
            : "非法剧本：请选择 campaign、tournament 或 tutorial。";
    }
    if (!option.players.includes(numPlayers)) return scenario === "tutorial"
        ? (english ? "The Lepanto tutorial supports exactly 2 players." : "勒班陀海战教学剧本仅支持 2 人。")
        : (english
            ? `The full scenarios support ${option.players.join(", ")} players.`
            : `正式剧本仅支持 ${option.players.join("、")} 人。`);
    return undefined;
};
