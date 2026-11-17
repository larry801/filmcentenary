import {useCallback, useEffect} from "react";

// 当前页面 bundle 内嵌的构建版本（由 vite.config.mts 的 define 注入）
declare const __APP_VERSION__: string;
const LOCAL_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "";

const POLL_INTERVAL = 60 * 1000; // 60 秒轮询一次
const RELOAD_GUARD_KEY = "__film_version_reload_guard__";
const RELOAD_GUARD_MS = 5 * 60 * 1000; // 同一版本 5 分钟内只自动刷新一次，避免缓存旧页面时死循环

async function fetchServerVersion(): Promise<string> {
    try {
        const res = await fetch(`/version.json?t=${Date.now()}`);
        if (!res.ok) return "";
        const data = await res.json();
        return String(data.version || "");
    } catch {
        return "";
    }
}

type ReloadGuard = {version: string, at: number};

function readReloadGuard(): ReloadGuard | null {
    try {
        const raw = sessionStorage.getItem(RELOAD_GUARD_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (typeof parsed?.version === "string" && typeof parsed?.at === "number") {
            return parsed;
        }
    } catch {
        // sessionStorage 不可用时忽略
    }
    return null;
}

function writeReloadGuard(guard: ReloadGuard) {
    try {
        sessionStorage.setItem(RELOAD_GUARD_KEY, JSON.stringify(guard));
    } catch {
        // sessionStorage 不可用时忽略
    }
}

const VersionChecker = () => {
    const check = useCallback(async () => {
        const serverVersion = await fetchServerVersion();
        if (!serverVersion) return;
        // 没有内嵌版本（开发模式/旧构建）时无法判断，直接跳过
        if (!LOCAL_VERSION) return;
        if (LOCAL_VERSION === serverVersion) return;
        // 当前 bundle 版本与服务器不一致：刷新以加载新前端
        const guard = readReloadGuard();
        if (guard && guard.version === serverVersion && Date.now() - guard.at < RELOAD_GUARD_MS) {
            // 已经为这个服务器版本刷新过，但页面仍是旧版本（通常是浏览器缓存），先等待缓存更新
            return;
        }
        writeReloadGuard({version: serverVersion, at: Date.now()});
        window.location.reload();
    }, []);

    useEffect(() => {
        check();
        const timer = setInterval(check, POLL_INTERVAL);
        // 回到前台/切回标签页时立即检查
        const onVisible = () => {
            if (document.visibilityState === "visible") check();
        };
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("focus", check);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", check);
        };
    }, [check]);

    return null;
};

export default VersionChecker;
