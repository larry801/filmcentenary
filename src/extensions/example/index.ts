/**
 * src/extensions/example/index.ts
 * 
 * 演示扩展 - 入口文件
 * 
 * ## 如何启用此扩展：
 * 
 * 1. 取消下方 registerExtension 调用的注释
 * 2. 在 src/extensions/index.ts 中 import 此文件：
 *    ```
 *    import './example';
 *    ```
 * 3. 重新启动游戏，在创建对局时展开【自定义选项】，
 *    勾选"示例扩展"即可启用。
 * 
 * 无需修改 IG 接口或任何核心文件！
 * 
 * 当前此文件仅作模板参考，registerExtension 已被注释，不会被加载。
 */

import { IExtension } from "../types";
import { exampleCards } from "./cards";
import { exampleEffects } from "./effects";

const exampleExtension: IExtension = {
    id: "example",
    name: "示例扩展（DIY）",
    description: "一个演示如何创建 DIY 扩展的示例，包含 2 张电影卡和 1 张流派卡",
    version: "1.0.0",

    // UI 中 checkbox 的标签（可选，不提供则使用 name）
    label: {
        ch: "示例扩展（DIY）",
        en: "Example Extension (DIY)",
    },

    cards: exampleCards,
    effects: exampleEffects,

    // isEnabled 不提供，使用默认规则：
    //   → 玩家在创建对局时勾选此扩展，G.enabledExtensions 会包含 "example"
    //   → 默认 isEnabled 检查 G.enabledExtensions.includes("example")

    // onSetup 可选：如果扩展需要在游戏开始时做特殊初始化，在此定义
    // onSetup: (G, ctx) => {
    //     console.log("[ExampleExtension] 初始化...");
    // },
};

// ============================================================
// ⚠️ 取消下面这行的注释即可启用此扩展 ⚠️
// ============================================================
// import { registerExtension } from "../registry";
// registerExtension(exampleExtension);

export default exampleExtension;
