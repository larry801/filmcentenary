import {Ctx, PlayerID} from "boardgame.io";
import {IG} from "../types/setup";
import {Region, VictoryType, valid_regions} from "../types/core";

interface IPlayerEndSnapshot {
    playerID: PlayerID | string,
    seat: number,
    stillInOrder: boolean,
    industry: number,
    aesthetics: number,
    vp: number,
    finalScore: number,
    allCards: string[],
    cinemaBuilt: boolean,
    studioBuilt: boolean,
}

interface IBuildingSnapshot {
    region: string,
    slotIndex: number,
    building: string | null,
    owner: PlayerID | string,
    activated: boolean,
}

interface IMatchStatsRecord {
    version: number,
    matchID: string,
    finishedAt: string,
    turnCount: number,
    reason: VictoryType,
    winner: PlayerID | string,
    settings: {
        playerCount: number,
        mode: string,
        extensionMode: string,
        hasSchoolExtension: boolean,
        hasSchoolExtensionMuki: boolean,
        hasSchoolExtensionMuki2: boolean,
        hasSchoolExtensionDawn: boolean,
        hasSchoolExtensionTech: boolean,
        hasSchoolExtensionVisual: boolean,
        hasSchoolExtensionQM: boolean,
        hasExtensionChaosMedia: boolean,
        disableUndo: boolean,
        testModeCinema: boolean,
        testModeEnd180: boolean,
        initialOrder: PlayerID | string[],
        finalOrder: PlayerID | string[],
    },
    players: IPlayerEndSnapshot[],
    buildings: IBuildingSnapshot[],
}

let loggedResolvedPath = false;

const isNodeRuntime = (): boolean => {
    return typeof window === "undefined" && !!(globalThis as any)?.process?.versions?.node;
}

const getNodeModule = (moduleName: string): any | null => {
    try {
        const processObj = (globalThis as any).process;
        const mainModule = processObj?.mainModule;
        if (mainModule && typeof mainModule.require === "function") {
            return mainModule.require(moduleName);
        }
    } catch {
    }
    try {
        const moduleObj = (globalThis as any).module;
        if (moduleObj && typeof moduleObj.require === "function") {
            return moduleObj.require(moduleName);
        }
    } catch {
    }
    return null;
}

const resolveStatsPath = (): string | null => {
    if (!isNodeRuntime()) {
        return null;
    }
    try {
        const path = getNodeModule("path");
        const fs = getNodeModule("fs");
        if (!path || !fs) {
            console.error("[match-stats] resolveStatsPath failed: cannot load fs/path module");
            return null;
        }
        const processObj = (globalThis as any).process;
        const configured = processObj?.env?.FILM_MATCH_STATS_PATH;
        if (typeof configured === "string" && configured.trim().length > 0) {
            return configured;
        }
        const cwd = processObj?.cwd?.() ?? ".";
        const cwdDataPath = path.resolve(cwd, "data", "film-match-stats.jsonl");
        const parentDataPath = path.resolve(cwd, "..", "data", "film-match-stats.jsonl");
        if (fs.existsSync(cwdDataPath)) {
            return cwdDataPath;
        }
        if (fs.existsSync(parentDataPath)) {
            return parentDataPath;
        }
        const cwdBaseName = path.basename(path.resolve(cwd));
        if (cwdBaseName.toLowerCase() === "src") {
            return parentDataPath;
        }
        return cwdDataPath;
    } catch (error) {
        console.error('[match-stats] resolveStatsPath failed', error);
        return null;
    }
}

const appendLineToFile = (filePath: string, line: string): void => {
    const fs = getNodeModule("fs");
    const path = getNodeModule("path");
    if (!fs || !path) {
        throw new Error("cannot load fs/path module");
    }
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true});
    }
    fs.appendFileSync(filePath, `${line}\n`, {encoding: "utf8"});
}

const buildPlayersSnapshot = (G: IG): IPlayerEndSnapshot[] => {
    return G.pub.map((p, idx) => {
        const pid = idx.toString();
        const seat = G.initialOrder.indexOf(pid);
        const mergedAllCards = Array.from(new Set<string>([
            ...(p.school === null ? [] : [p.school]),
            ...p.allCards,
            ...p.archive,
        ]));
        return {
            playerID: G.playerNames[pid] || pid,
            seat,
            stillInOrder: G.order.includes(pid),
            industry: p.industry,
            aesthetics: p.aesthetics,
            vp: p.vp,
            finalScore: p.finalScoring.total,
            allCards: mergedAllCards,
            cinemaBuilt: p.building.cinemaBuilt,
            studioBuilt: p.building.studioBuilt,
        };
    });
}

const buildBuildingsSnapshot = (G: IG): IBuildingSnapshot[] => {
    const result: IBuildingSnapshot[] = [];
    valid_regions.forEach((region) => {
        const regionInfo = G.regions[region];
        if (!regionInfo) return;
        regionInfo.buildings.forEach((slot, idx) => {
            result.push({
                region: Region[region],
                slotIndex: idx,
                building: slot.building ?? null,
                owner: G.playerNames[slot.owner] || slot.owner,
                activated: slot.activated,
            });
        });
    });
    return result;
}

const normalizeTurnCount = (turn: number | undefined): number => {
    if (typeof turn !== "number" || turn <= 0) {
        return 0;
    }
    return Math.max(0, (turn - 1) / 4);
}

export const appendServerMatchStats = (G: IG, ctx: Ctx, reason: VictoryType, winner: PlayerID | string): void => {
    try {
        const filePath = resolveStatsPath();
        if (!filePath) {
            console.error('[match-stats] skip save: stats path is null');
            return;
        }
        if (!loggedResolvedPath) {
            loggedResolvedPath = true;
            console.info(`[match-stats] resolved path -> ${filePath}`);
        }
        const winnerName = G.playerNames[winner] || winner;
        const record: IMatchStatsRecord = {
            version: 2,
            matchID: G.matchID,
            finishedAt: new Date().toISOString(),
            turnCount: normalizeTurnCount(ctx.turn),
            reason,
            winner: winnerName,
            settings: {
                playerCount: G.playerCount || ctx.numPlayers,
                mode: G.mode,
                extensionMode: G.extensionMode,
                hasSchoolExtension: G.hasSchoolExtension,
                hasSchoolExtensionMuki: G.hasSchoolExtensionMuki,
                hasSchoolExtensionMuki2: G.hasSchoolExtensionMuki2,
                hasSchoolExtensionDawn: G.hasSchoolExtensionDawn,
                hasSchoolExtensionTech: G.hasSchoolExtensionTech,
                hasSchoolExtensionVisual: G.hasSchoolExtensionVisual,
                hasSchoolExtensionQM: G.hasSchoolExtensionQM,
                hasExtensionChaosMedia: G.hasExtensionChaosMedia,
                disableUndo: G.disableUndo,
                testModeCinema: G.testModeCinema,
                testModeEnd180: G.testModeEnd180,
                initialOrder: [...G.initialOrder].map(pid => G.playerNames[pid] || pid),
                finalOrder: [...G.order].map(pid => G.playerNames[pid] || pid),
            },
            players: buildPlayersSnapshot(G),
            buildings: buildBuildingsSnapshot(G),
        };
        const serialized = JSON.stringify(record);
        appendLineToFile(filePath, serialized);
        console.info(`[match-stats] saved -> ${filePath}`);
        console.info(`[match-stats] data -> ${serialized}`);
    } catch (error) {
        console.error('[match-stats] save failed', error);
    }
}
