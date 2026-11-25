# 帝国挽歌 · 极简界面（One Sheet）截图记录

日期：2026-11-25
界面：`/localIE`（本地热座）、`/localIE/solo`（单人设置）
视口：桌面 1440×900，手机 390×844（DPR 2，触摸）
依据：[`docs/imperial-elegy/MINIMAL_UI.md`](../../imperial-elegy/MINIMAL_UI.md)

## 文件

| 文件 | 内容 |
| --- | --- |
| `01-desktop-zh.png` | 桌面中文，默认状态：一条 44 px 状态行、整幅地图、折叠的手牌条 |
| `02-desktop-orders.png` | 指令抽屉打开（地图上方浮出 348 px） |
| `03-desktop-hand.png` | 手牌条打开（152 px，三张牌各带两个印刷玩法） |
| `04-desktop-en.png` | 英文界面 |
| `05-phone-zh.png` | 手机 390×844，地图优先 |
| `06-phone-dock.png` | 手机底部 dock 打开 |
| `07-solo-setup.png` | 单人设置页 |

## 版面实测（1440×900，中文，默认状态）

| 区域 | 尺寸 |
| --- | --- |
| 状态行 `.ie-track-strip` | 1392 × 44 |
| 地图 `.ie-map-region` | 1392 × 732 |
| 手牌条 `ie-hand-tray`（折叠） | 1392 × 44 |
| 指令抽屉（关闭） | 348 宽，位于视口右侧之外（`translateX(100%)`） |
| 文档高度 | 900 px，不滚动 |

改版前同一视口：地图 880 × 514，玩家板 148 宽，手牌 212 高，指令面板 348 宽常驻。

## 自动审计（本地一次性脚本，未提交）

遍历可见文本节点，按其有效背景计算对比度，并统计渐变与投影：

- 1440×900：低于 3.6:1 的文本 0 处，`background-image` 0 处，面板投影 0 处。
- 390×844：低于 3.6:1 的文本 0 处，渐变 0 处；投影 2 处，均为浮动 dock。
- 控制台错误：0。

`yarn ie:contrast`：87 组全部通过。`yarn ie:tokens:check`：生成文件与 token 源一致。
Jest `src/imperialElegy/components`：61 个套件、1445 条测试全部通过。

## 已知差异

见 `MINIMAL_UI.md` §8：手机 dock 仍为五页；手牌的次要操作放在检视器里；状态行保留世界紧张度与五个同盟框。
