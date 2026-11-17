/**
 * matchStorage.ts — 对局完整数据本地备份模块
 *
 * 通过包装 boardgame.io 的 StorageAPI，在游戏结束时拦截 setState 调用，
 * 将完整对局状态（含 _stateID、log、initialState）写入本地 JSONL 文件。
 *
 * 存储路径：data/film-match/matches-{N}.jsonl
 * 每个文件存储 100 个对局，超过后自动创建新文件。
 */

import { Ctx } from "boardgame.io";
import { IG } from "../types/setup";

/* ==================== 记录格式（与 matches-1.jsonl 一致） ==================== */

interface IMatchDataRecord {
    version: number;
    matchID: string;
    exportedAt: string;
    state: {
        G: any;
        ctx: any;
        plugins: any;
        _undo: any[];
        _redo: any[];
        _stateID: number;
    };
    log: any[];
    metadata: Array<{ id: number; name?: string; isConnected?: boolean }>;
    initialState: any | null;
}

/** 每个 JSONL 文件最多存储的对局数 */
const MAX_MATCHES_PER_FILE = 100;

/** 避免重复打印日志 */
let loggedResolvedDir = false;

/* ==================== Node 运行时检测 ==================== */

const isNodeRuntime = (): boolean => {
    return typeof window === "undefined" && !!(globalThis as any)?.process?.versions?.node;
};

const getNodeModule = (moduleName: string): any | null => {
    try {
        const processObj = (globalThis as any).process;
        const mainModule = processObj?.mainModule;
        if (mainModule && typeof mainModule.require === "function") {
            return mainModule.require(moduleName);
        }
    } catch { /* ignore */ }
    try {
        const moduleObj = (globalThis as any).module;
        if (moduleObj && typeof moduleObj.require === "function") {
            return moduleObj.require(moduleName);
        }
    } catch { /* ignore */ }
    return null;
};

/* ==================== 路径解析 ==================== */

const resolveMatchDataDir = (): string | null => {
    if (!isNodeRuntime()) return null;
    try {
        const path = getNodeModule("path");
        const fs = getNodeModule("fs");
        if (!path || !fs) return null;
        const processObj = (globalThis as any).process;
        const cwd = processObj?.cwd?.() ?? ".";
        const cwdDataDir = path.resolve(cwd, "data", "film-match");
        const parentDataDir = path.resolve(cwd, "..", "data", "film-match");
        if (fs.existsSync(cwdDataDir)) return cwdDataDir;
        if (fs.existsSync(parentDataDir)) return parentDataDir;
        const cwdBaseName = path.basename(path.resolve(cwd));
        if (cwdBaseName.toLowerCase() === "src") return parentDataDir;
        return cwdDataDir;
    } catch {
        return null;
    }
};

/* ==================== 文件轮转 ==================== */

const resolveTargetFile = (dir: string): string => {
    const fs = getNodeModule("fs");
    const path = getNodeModule("path");
    if (!fs || !path) throw new Error("cannot load fs/path module");

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const existingFiles: string[] = [];
    if (fs.existsSync(dir)) {
        for (const entry of fs.readdirSync(dir)) {
            const match = entry.match(/^matches-(\d+)\.jsonl$/);
            if (match) existingFiles.push(entry);
        }
    }

    let maxNum = 0;
    let latestFile = "";
    for (const f of existingFiles) {
        const match = f.match(/^matches-(\d+)\.jsonl$/);
        if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) { maxNum = num; latestFile = f; }
        }
    }

    if (maxNum === 0 || latestFile === "") {
        return path.resolve(dir, "matches-1.jsonl");
    }

    const latestPath = path.resolve(dir, latestFile);
    const content = fs.readFileSync(latestPath, { encoding: "utf8" });
    const lines = content.split("\n").filter((l: string) => l.trim().length > 0);

    if (lines.length >= MAX_MATCHES_PER_FILE) {
        return path.resolve(dir, `matches-${maxNum + 1}.jsonl`);
    }
    return latestPath;
};

const appendLineToFile = (filePath: string, line: string): void => {
    const fs = getNodeModule("fs");
    if (!fs) throw new Error("cannot load fs module");
    fs.appendFileSync(filePath, `${line}\n`, { encoding: "utf8" });
};

/* ==================== 构建元数据 ==================== */

const buildMetadataFromState = (G: any, metadataFromDB?: any): Array<{ id: number; name?: string; isConnected?: boolean }> => {
    const count = G?.playerCount || G?.order?.length || 0;
    const meta: Array<{ id: number; name?: string; isConnected?: boolean }> = [];
    for (let i = 0; i < count; i++) {
        const pid = i.toString();
        // 优先从数据库元数据获取玩家名称
        let name: string | undefined;
        if (metadataFromDB?.players?.[i]?.name) {
            name = metadataFromDB.players[i].name;
        } else if (G?.playerNames?.[pid]) {
            name = G.playerNames[pid];
        }
        meta.push({ id: i, name, isConnected: false });
    }
    return meta;
};

/* ==================== 写入 JSONL ==================== */

/** 已写入的 matchID 集合，防止包装器和兜底函数重复写入 */
const writtenMatchIDs = new Set<string>();

const writeMatchRecord = (
    matchID: string,
    state: any,
    initialState: any,
    log: any[],
    metadataFromDB?: any,
): void => {
    // 防重复
    if (writtenMatchIDs.has(matchID)) {
        console.info(`[match-data] skip duplicate -> ${matchID}`);
        return;
    }
    writtenMatchIDs.add(matchID);

    const dir = resolveMatchDataDir();
    if (!dir) {
        console.error("[match-data] skip save: cannot resolve data directory");
        return;
    }
    if (!loggedResolvedDir) {
        loggedResolvedDir = true;
        console.info(`[match-data] resolved dir -> ${dir}`);
    }

    const filePath = resolveTargetFile(dir);

    // 深拷贝，避免外部后续修改污染
    const safeClone = (v: any) => (v != null ? JSON.parse(JSON.stringify(v)) : null);

    const record: IMatchDataRecord = {
        version: 2,
        matchID: matchID,
        exportedAt: new Date().toISOString(),
        state: {
            G: safeClone(state.G),
            ctx: safeClone(state.ctx),
            plugins: safeClone(state.plugins) || { random: {}, log: { data: {} }, events: { data: {} } },
            _undo: safeClone(state._undo) || [],
            _redo: safeClone(state._redo) || [],
            _stateID: typeof state._stateID === "number" ? state._stateID : 0,
        },
        log: safeClone(log) || [],
        metadata: buildMetadataFromState(state.G, metadataFromDB),
        initialState: safeClone(initialState),
    };

    const serialized = JSON.stringify(record);
    appendLineToFile(filePath, serialized);
    console.info(`[match-data] saved -> ${filePath} (matchID=${matchID})`);
};

/* ==================== 内存存储（无外部 db 时使用） ==================== */

/**
 * 获取 boardgame.io StorageAPI.Type.ASYNC 值。
 * 避免编译时依赖 boardgame.io/internal，运行时动态加载。
 */
const getAsyncTypeValue = (): any => {
    try {
        const internal = getNodeModule("boardgame.io/internal");
        if (internal?.Type?.ASYNC !== undefined) {
            return internal.Type.ASYNC;
        }
    } catch { /* ignore */ }
    // 兜底：返回字符串 'async'（boardgame.io 内部 Type.SYNC 不会是 'async'）
    return 'async';
};

/**
 * 简单的内存存储，实现 boardgame.io StorageAPI 接口。
 * 用于没有 Redis/Postgres 的环境，使 match-data 包装器始终可以拦截到完整 State。
 */
export const createInMemoryStorage = (): any => {
    const states = new Map<string, any>();
    const logs = new Map<string, any[]>();
    const metadatas = new Map<string, any>();
    const initialStates = new Map<string, any>();
    const matchList: string[] = [];
    const asyncType = getAsyncTypeValue();

    return {
        /** boardgame.io 要求：返回 Type.ASYNC 表示异步存储 */
        type() { return asyncType; },

        async connect() { /* noop */ },

        async createMatch(matchID: string, opts: any) {
            initialStates.set(matchID, opts.initialState ?? null);
            states.set(matchID, opts.initialState);
            metadatas.set(matchID, opts.metadata ?? null);
            logs.set(matchID, []);
            matchList.push(matchID);
        },

        async setState(matchID: string, state: any, deltalog?: any[]) {
            states.set(matchID, state);
            if (deltalog && deltalog.length > 0) {
                const existing = logs.get(matchID) || [];
                existing.push(...deltalog);
                logs.set(matchID, existing);
            }
        },

        async setMetadata(matchID: string, metadata: any) {
            metadatas.set(matchID, metadata);
        },

        async fetch(matchID: string, opts: any) {
            return {
                state: opts.state ? states.get(matchID) : undefined,
                log: opts.log ? logs.get(matchID) : undefined,
                metadata: opts.metadata ? metadatas.get(matchID) : undefined,
                initialState: opts.initialState ? initialStates.get(matchID) : undefined,
            };
        },

        async wipe(matchID: string) {
            states.delete(matchID);
            logs.delete(matchID);
            metadatas.delete(matchID);
            initialStates.delete(matchID);
            const idx = matchList.indexOf(matchID);
            if (idx >= 0) matchList.splice(idx, 1);
        },

        async listMatches(_opts?: any) {
            return [...matchList];
        },
    };
};

/* ==================== StorageAPI 包装器 ==================== */

interface IMatchCache {
    initialState: any;
    metadata: any;
    log: any[];
}

/**
 * 创建一个包装后的 StorageAPI 对象。
 * 通过直接替换 createMatch / setState 方法，拦截并缓存 initialState、log，
 * 在游戏结束时自动写入 JSONL 备份。
 *
 * @param delegate - 原始的 StorageAPI 对象（RedisStorage / PostgresStore / 等）
 * @returns 包装后的 StorageAPI 对象（即 delegate 自身，已挂载拦截方法）
 */
export const createMatchDataStorageWrapper = (delegate: any): any => {
    const matchCache = new Map<string, IMatchCache>();

    const getCache = (matchID: string): IMatchCache => {
        let cached = matchCache.get(matchID);
        if (!cached) {
            cached = { initialState: null, metadata: null, log: [] };
            matchCache.set(matchID, cached);
        }
        return cached;
    };

    // 保存原始方法引用
    const _origCreateMatch = delegate.createMatch.bind(delegate);
    const _origSetState = delegate.setState.bind(delegate);

    // 直接替换方法（不用 Proxy，避免 boardgame.io 内部引用丢失）
    delegate.createMatch = async function (matchID: string, opts: any) {
        const cached = getCache(matchID);
        cached.initialState = opts?.initialState ?? null;
        cached.metadata = opts?.metadata ?? null;
        cached.log = [];
        console.info(`[match-data] createMatch intercepted -> ${matchID}, hasInitialState=${cached.initialState != null}`);
        return _origCreateMatch(matchID, opts);
    };

    delegate.setState = async function (matchID: string, state: any, deltalog?: any[]) {
        const cached = getCache(matchID);
        // 累积增量日志
        if (deltalog && deltalog.length > 0) {
            cached.log.push(...deltalog);
        }
        // 检测游戏结束
        if (state?.ctx?.gameover) {
            console.info(`[match-data] gameover detected -> ${matchID}, logEntries=${cached.log.length}, hasInitState=${cached.initialState != null}`);
            try {
                writeMatchRecord(matchID, state, cached.initialState, cached.log, cached.metadata);
            } catch (err) {
                console.error("[match-data] writeMatchRecord failed", err);
            }
            // 清理缓存
            matchCache.delete(matchID);
        }
        return _origSetState(matchID, state, deltalog);
    };

    return delegate;
};

/* ==================== 向后兼容：从 move 中调用的简化版 ==================== */

/**
 * 简化版存储（从 move 中调用，无法获取 _stateID / log / initialState）。
 * 当 StorageAPI 包装器无法生效时（如开发环境无外部 db），作为兜底方案。
 * 如果包装器已写入该 matchID，则跳过（防重复）。
 *
 * 注意：此函数在任何情况下都不能抛出异常，否则会中断游戏结束流程。
 */
export const appendServerMatchData = (G: IG, ctx: Ctx): void => {
    try {
        const matchID = (G as any).matchID;
        if (!matchID) return;

        // 包装器已写入则跳过
        if (writtenMatchIDs.has(matchID)) {
            return;
        }
        writtenMatchIDs.add(matchID);

        const dir = resolveMatchDataDir();
        if (!dir) return;
        if (!loggedResolvedDir) {
            loggedResolvedDir = true;
            console.info(`[match-data] resolved dir -> ${dir}`);
        }

        const filePath = resolveTargetFile(dir);

        const clone = (v: any) => {
            if (v == null) return null;
            try { return JSON.parse(JSON.stringify(v)); }
            catch { return null; }
        };

        const record: IMatchDataRecord = {
            version: 2,
            matchID: matchID,
            exportedAt: new Date().toISOString(),
            state: {
                G: clone(G),
                ctx: clone(ctx),
                plugins: { random: {}, log: { data: {} }, events: { data: {} } },
                _undo: [],
                _redo: [],
                _stateID: 0,
            },
            log: [],
            metadata: buildMetadataFromState(G),
            initialState: null,
        };

        const serialized = JSON.stringify(record);
        appendLineToFile(filePath, serialized);
        console.info(`[match-data] saved (fallback) -> ${filePath}`);
    } catch (err) {
        // 绝对不能因为存储失败而中断游戏
        console.error("[match-data] appendServerMatchData failed (non-fatal)", err);
    }
};


