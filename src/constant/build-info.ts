// 构建信息由 vite.config.mts 的 define 注入：构建时间与源码 commit。
// 抽屉底部展示它们，运维看到页面就能确认线上跑的是哪个镜像。
declare const __BUILD_TIME__: string;
declare const __GIT_COMMIT__: string;

/** 构建时间（ISO 字符串）。测试环境没有注入 define，此时为空。 */
export const BUILD_TIME = typeof __BUILD_TIME__ === "string" ? __BUILD_TIME__ : "";

/** 构建所用的 commit（短 hash）。没有 git 上下文时为空。 */
export const BUILD_COMMIT = typeof __GIT_COMMIT__ === "string" ? __GIT_COMMIT__ : "";

/**
 * ISO 时间转成本地 `YYYY-MM-DD HH:mm`。抽屉是给人看的，精确到分钟足够，
 * 也避免了 `toLocaleString` 在不同浏览器里格式不一。无法解析时原样返回。
 */
export const formatBuildTime = (iso: string): string => {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
        `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
