import {BUILD_COMMIT, BUILD_TIME, formatBuildTime} from "./build-info";

// 测试环境没有注入 `__BUILD_TIME__` / `__GIT_COMMIT__`（那是 vite 的 define），
// 所以断言都按“没有构建信息”的行为来写，格式化逻辑单独测。
describe("formatBuildTime", () => {
    it("formats an ISO timestamp to minute precision in local time", () => {
        const local = new Date(2024, 4, 6, 7, 8, 9);
        expect(formatBuildTime(local.toISOString())).toBe("2024-05-06 07:08");
    });

    it("pads single-digit months, days, hours and minutes", () => {
        const local = new Date(2024, 0, 2, 3, 4);
        expect(formatBuildTime(local.toISOString())).toBe("2024-01-02 03:04");
    });

    it("returns an empty string when there is no timestamp", () => {
        expect(formatBuildTime("")).toBe("");
    });

    it("passes an unparseable value through unchanged", () => {
        expect(formatBuildTime("not-a-date")).toBe("not-a-date");
    });
});

describe("build info constants", () => {
    it("are empty without an injected define", () => {
        // Jest 的 ts-jest 不做 define 替换，两个常量都应是空串，
        // 组件据此判定“没有构建信息”而不渲染那一行。
        expect(BUILD_TIME).toBe("");
        expect(BUILD_COMMIT).toBe("");
    });
});
