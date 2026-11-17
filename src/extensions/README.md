# 🧩 扩展系统 (Extensions)

DIY 扩展系统允许你在**不修改任何核心代码**的情况下，为电影百年添加自定义卡牌和结算效果。

## 📁 目录结构

```
src/extensions/
├── index.ts                 # 统一入口（在此 import 你要启用的扩展）
├── types.ts                 # IExtension 接口定义
├── registry.ts              # 注册中心
├── README.md                # 本文件
│
└── ex_Name/                 # 你的扩展目录（按此命名规范）
    ├── index.ts             # 扩展入口，定义 IExtension 并调用 registerExtension()
    ├── cards.ts             # （可选）卡牌数据定义
    └── effects.ts           # （可选）卡牌效果定义
```

## 🚀 快速开始（仅需 3 步！）

### 步骤 1：创建扩展目录和文件

在 `src/extensions/` 下创建你的扩展：

```
src/extensions/ex_MyCards/
├── index.ts       # 扩展入口
├── cards.ts       # 卡牌数据
└── effects.ts     # 卡牌效果
```

### 步骤 2：编写扩展入口 (`index.ts`)

```typescript
import { IExtension } from "../types";
import { registerExtension } from "../registry";
import { myCards } from "./cards";
import { myEffects } from "./effects";

const myExtension: IExtension = {
    id: "my_cards",           // 唯一标识
    name: "我的自定义卡牌",    // 显示在 checkbox 旁边的名称
    version: "1.0.0",

    cards: myCards,           // 卡牌数据
    effects: myEffects,       // 卡牌效果

    // isEnabled 不需要写！默认规则：
    //   玩家在 UI 勾选此扩展 → G.enabledExtensions 包含 "my_cards" → 扩展自动启用
};

registerExtension(myExtension);
export default myExtension;
```

### 步骤 3：激活扩展

在 `src/extensions/index.ts` 中添加一行 import：

```typescript
import './ex_MyCards';  // ← 加这一行
```

**完成！** 重新启动游戏，创建对局时展开「自定义选项」，就能看到你的扩展 checkbox 了。

> ✅ **不需要** 修改 `types/setup.ts`（IG 接口）
> ✅ **不需要** 手动添加 boolean 开关字段
> ✅ **不需要** 写 `isEnabled` 判断函数
> ✅ **不需要** 修改 `setup-game-mode.tsx`（UI 自动生成 checkbox）

---

## 📋 IExtension 接口说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | ✅ | 唯一标识，如 `"my_cards"` |
| `name` | `string` | ✅ | 显示名称（checkbox 标签） |
| `label` | `{ ch: string, en: string }` | ❌ | 中英文标签，不提供则用 `name` |
| `description` | `string` | ❌ | 扩展描述 |
| `version` | `string` | ❌ | 版本号 |
| `cards` | `Record<string, INormalOrLegendCard>` | ❌ | 卡牌数据，key 为完整 ID（如 `"F8001"`） |
| `effects` | `Record<string, ICardEffectDef>` | ❌ | 卡牌效果，key 为数字部分（如 `"8001"`） |
| `events` | `Record<string, IEventCard>` | ❌ | 事件卡数据 |
| `eventEffects` | `Record<string, IEff>` | ❌ | 事件效果 |
| `isEnabled` | `(G: IG) => boolean` | ❌ | 自定义启用判断（默认：检查 `G.enabledExtensions`） |
| `onSetup` | `(G: IG, ctx: Ctx) => void` | ❌ | 游戏初始化钩子（setupGameMode 时调用） |

## ⚠️ 注意事项

1. **卡牌 ID 不要与现有卡牌冲突**。建议使用 7000+ 范围。
2. **效果 key 是卡牌 ID 去掉前缀的数字部分**。例如 `"F8001"` → `"8001"`，`"S8101"` → `"8101"`。
3. **扩展默认不会被加载**。必须在 `src/extensions/index.ts` 中显式 import。
4. **现有扩展（流派扩、Muki扩等）不受影响**。此系统使用独立的 `enabledExtensions` 机制。
5. **效果定义中的 `play`/`archive`/`buy` 使用与 `constant/effects.ts` 相同的 IEff 格式**。
6. **`AllClassicCards` 查找会在扩展效果查找之前执行**。如果卡牌 ID 已存在于 `AllClassicCards` 中，扩展效果不会被使用。
7. **选项自动保存**。玩家勾选的扩展选项会保存到浏览器 localStorage，下次创建对局时自动恢复。

## 🔍 调试

注册和启用扩展时会在控制台输出日志：

```
[ExtensionRegistry] Registered extension: "my_cards" (我的自定义卡牌)
```

可以在浏览器开发者工具的 Console 中查看。

## 📂 示例

完整示例见 `src/extensions/example/` 目录。该示例不会被自动加载，需要手动启用。

