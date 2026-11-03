import {POWER_NAMES, POWERS, Power, ScenarioID} from "./constant/general";

export const SCENARIO_OPTIONS: {id: ScenarioID; label: string; players: number[]}[] = [
    {id: "campaign", label: "Campaign · 拉罗谢尔之围", players: [2, 3, 4, 5, 6]},
    {id: "tournament", label: "Tournament · 荷兰起义开始", players: [2, 5, 6]},
    {id: "tutorial", label: "教学 · 勒班陀海战", players: [2]},
];

export const seatLabels = (scenario: ScenarioID, numPlayers: number): string[] =>
    numPlayers === 6 ? POWERS.map((power) => POWER_NAMES[power].zh)
        : numPlayers === 5 ? POWERS.filter((power) => power !== "hre").map((power) => POWER_NAMES[power].zh)
            : numPlayers === 4 ? ["spain", "england", "france", "protestant"].map((power) => POWER_NAMES[power as Power].zh)
                : numPlayers === 3 ? ["西班牙", "英格兰 / 新教联盟", "法国"]
                : scenario === "tutorial"
                    ? ["奥斯曼帝国", "西班牙"] : ["西班牙 / 法国", "英格兰 / 新教联盟"];

export const validateSetupData = (setupData: unknown, numPlayers: number): string | undefined => {
    if (setupData !== undefined && (typeof setupData !== "object" || setupData === null || Array.isArray(setupData))) {
        return "场景配置必须是对象。";
    }
    const configuredScenario = (setupData as {scenario?: unknown} | undefined)?.scenario;
    const scenario = configuredScenario === undefined ? "campaign" : configuredScenario;
    const option = SCENARIO_OPTIONS.find((entry) => entry.id === scenario);
    if (!option) return "非法剧本：请选择 campaign、tournament 或 tutorial。";
    if (!option.players.includes(numPlayers)) return scenario === "tutorial"
        ? "勒班陀海战教学剧本仅支持 2 人。" : `正式剧本仅支持 ${option.players.join("、")} 人。`;
    return undefined;
};
