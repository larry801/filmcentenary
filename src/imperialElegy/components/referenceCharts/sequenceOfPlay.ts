/**
 * Chart 1 — Sequence of Play, the action list and the alliance-resolution step.
 *
 * The inline `referenceTables` section prints the sequence *of the live game*
 * from `phaseSteps`; this file is the printed player aid's own copy, including
 * the manuscript notes ("no hard passing", the stacking limits, the alliance
 * step's reroll) that the live stepper has no place for.
 */
import {bullets, prose, same, sub, sublist, t, table, type ChartText} from "./types";

export const SEQUENCE_OF_PLAY: ChartText = {
  id: "sequence-of-play",
  title: t("Sequence of Play", "游戏流程"),
  sections: [
    {
      title: t("Sequence of Play", "游戏流程"),
      blocks: [
        bullets(
          t(
            "1. Prep Phase: (1) Add new cards to the deck, (2) reshuffle deck, (3) deal cards. (4) Optional: discard a random card to gain 1 stability. Cannot discard home card or mandatory events",
            "1. 准备阶段：(1) 将新牌加入牌堆，(2) 洗牌，(3) 发牌。(4) 可选：随机弃 1 张牌以换取 1 点稳定。不能弃本土牌或强制事件牌",
          ),
          t(
            "2. Diplomacy Phase: (1) make deals, (2) announce deals in turn order, (3) select home card.",
            "2. 外交阶段：(1) 达成协议，(2) 按回合顺序宣布协议，(3) 选择本土牌。",
          ),
          t(
            "3. Action Phase: Players perform impulses by playing cards to conduct actions and events.",
            "3. 行动阶段：玩家通过打出卡牌来执行行动与事件，轮流进行行动轮。",
          ),
          t(
            "4. End Phase: (1) militarism: gain one army step or prevent a fort from degrading, (2) degrade forts, (3) minor power build step, (4) all naval units go to port, (5) set manpower, (6) industrialize, (7) progress truces, (8) progress Wols, (9) alliance resolution step, (10) decrease the WTT by 1, (11) on turns 1, 3, and 5 players draw three NGs keeping one, (12) advance the turn marker",
            "4. 结束阶段：(1) 军国主义：获得 1 级军团或阻止 1 座要塞降级，(2) 要塞降级，(3) 小国建造步骤，(4) 所有海军单位回港，(5) 设定人力，(6) 工业化，(7) 推进停战，(8) 推进独立战争标记，(9) 同盟结算步骤，(10) 世界紧张 -1，(11) 在第 1、3、5 回合，玩家抽 3 张国家目标保留 1 张，(12) 推进回合标记",
          ),
        ),
        sub("Turn Order and Hand Size", "回合顺序与手牌上限"),
        table(
          [t("Turn order", "回合顺序"), t("Hand size", "手牌上限")],
          [
            [t("1. Germany", "1. 德国"), t("Industry level", "工业等级")],
            [t("2. United Kingdom", "2. 英国"), t("Flashpoints", "闪点")],
            [t("3. France", "3. 法国"), t("+/- card markers", "± 抽牌标记")],
            [t("4. Austria", "4. 奥匈"), t("Stability level", "稳定等级")],
            [t("5. Russia", "5. 俄国"), t("National Characteristics", "国家特性")],
            [t("6. Ottomans", "6. 奥斯曼"), t("Minimum card draw: 3 cards", "最低抽牌数：3 张")],
          ],
        ),
      ],
    },
    {
      title: t("Action Phase Breakdown", "行动阶段细则"),
      rule: "12.0",
      blocks: [
        prose(
          "In turn order players either play an action card or pass.",
          "按回合顺序，玩家要么打出一张行动牌，要么停牌。",
        ),
        bullets(
          t("Play an action card", "打出一张行动牌"),
          t("(1) for its event", "(1) 使用其事件"),
          t("(2) for its CP to conduct actions", "(2) 使用其 CP 执行行动"),
        ),
        prose(
          "Exception: mandatory events are played for both their event and their CP value; the event always triggers first",
          "例外：强制事件会同时按其事件与其 CP 值打出；事件总是先结算",
        ),
        bullets(
          t(
            "Pass: players can pass if they have only one card remaining and they've played their home card",
            "停牌：玩家在手牌仅剩 1 张、且已打出本土牌时可以停牌",
          ),
          t(
            "Players cannot pass if they have a mandatory event in their hand",
            "手中仍有强制事件牌的玩家不能停牌",
          ),
        ),
        prose(
          "There is no “hard passing,” meaning players can still play their one remaining card on a future impulse",
          "不存在“硬性停牌”：玩家仍可在之后的行动轮打出手中最后一张牌",
        ),
        prose(
          "Ending the action phase: the action phase ends when either (1) all players consecutively pass or (2) when all players have no remaining cards.",
          "结束行动阶段：当 (1) 所有玩家连续停牌，或 (2) 所有玩家都没有剩余手牌时，行动阶段结束。",
        ),
      ],
    },
    {
      title: t("Actions", "行动"),
      rule: "12.1",
      blocks: [
        bullets(t("Recruitment: 1–4 CP", "征募：1–4 CP")),
        sublist(
          t("Standing/Reserve Army - 1 CP per step", "常备军／预备军 - 每级 1 CP"),
          t("Elite Corps - 2 CP", "精英军 - 2 CP"),
        ),
        bullets(t("Naval Movement: 1 CP - move all fleets and 1 land unit", "海上移动：1 CP - 移动所有舰队和 1 个陆军单位")),
        bullets(t("Construct Fleet: 1–3 CP", "建造舰队：1–3 CP")),
        sublist(
          t("Ready Squadron - 2 CP", "整备分舰队 - 2 CP"),
          t("Spent Squadron - 1 CP", "已消耗分舰队 - 1 CP"),
          t("Ready Dreadnought - 3 CP", "整备无畏舰 - 3 CP"),
          t("Spent Dreadnought - 2 CP", "已消耗无畏舰 - 2 CP"),
          t("Refit - 1 CP (only in a friendly port)", "整补 - 1 CP（仅在友好港口）"),
        ),
        bullets(
          t("Place Influence or Diplomacy: 1 CP. Once per impulse", "放置影响或外交：1 CP。每行动轮一次"),
          t(
            "Remove Influence or Diplomacy: 1 CP. Once per impulse (cannot remove influence in Africa after the Berlin Conference).",
            "移除影响或外交：1 CP。每行动轮一次（柏林会议之后不能移除非洲的影响）。",
          ),
          t(
            "Minor Power Alliance: 3 CP - gain an alliance with a minor power, must have diplomacy.",
            "小国同盟：3 CP - 与一个小国结盟，须有外交标记。",
          ),
          t(
            "Remove Minor Power Alliance: 4 CP - flip a player's ally marker to its diplomacy side. Costs 3 CP with naval supremacy [12.9].",
            "解除小国同盟：4 CP - 将某玩家的同盟标记翻到外交面。拥有海上霸权时花费 3 CP【12.9】。",
          ),
          t(
            "Major Power Influence Track: 1–4 CP - add influence to the Major Power Influence Track equal to CP spent.",
            "大国影响力轨道：1–4 CP - 按花费的 CP 在大国影响力轨道上增加同等影响力。",
          ),
          t(
            "Redeployment: 1 CP - move all land units an unlimited distance by land. Elite Colonial EFs and ECs may move an unlimited distance by sea during redeployment actions if they end their move stacked with an army.",
            "重新部署：1 CP - 所有陆军单位在陆上移动任意距离。重新部署行动中，精锐殖民远征军与精英军可在海上移动任意距离，但移动结束时须与军团堆叠。",
          ),
          t(
            "Declare War: 1–4 CP (see wartime actions Page 3; cannot declare war if WTT is ≥3)",
            "宣战：1–4 CP（见第 3 页战时行动；世界紧张 ≥3 时不能宣战）",
          ),
          t("Land Battle: 1 CP - launch an attack (*rebels*)", "陆战：1 CP - 发动进攻（*叛军*）"),
          t(
            "Expeditionary Force: 1–2 CP (no LoC required); 2 CP to build a new EF, 1 CP to move an EF an unlimited distance. Must have influence or control",
            "远征军：1–2 CP（不要求补给线）；2 CP 建造新的远征军，1 CP 使远征军移动任意距离。须有影响力或控制权",
          ),
        ),
        bullets(t("Pacification: 1 CP (GE 2 CP if not unified) / AU always 2 CP. Roll two dice, ≥10 is a success", "绥靖：1 CP（德国未统一时 2 CP）／奥匈始终 2 CP。掷两个骰子，≥10 即成功")),
        sublist(
          t(
            "Add Pac marker value to roll and +1 DRM if you have a naval unit in an adjacent naval box",
            "掷骰时加上绥靖标记的数值；若在邻接的海军区有海军单位，+1 DRM",
          ),
          t("Increase Pac marker by 1 if attempt failed", "尝试失败时绥靖标记 +1"),
          t("Limit once per space, per impulse", "每个空间每行动轮限一次"),
        ),
        bullets(t("Construct Fort: 1–2 CP", "建造要塞：1–2 CP")),
        sublist(
          t(
            "Fort level = CP spent, max 3 forts per player, a fort can be upgraded for 1 CP (not to level 3)",
            "要塞等级 = 花费的 CP；每名玩家最多 3 座要塞；可用 1 CP 升级要塞（不能升到 3 级）",
          ),
        ),
        bullets(
          t("CP Chain: 1 Card - play a card into CP Chain [12.15].", "CP 链：1 张牌 - 将一张牌放入 CP 链【12.15】。"),
          t(
            "Industrialize: 1 Card - Once per turn, CP spent adds DRM to industrialization roll. Cannot use CP Chain to industrialize",
            "工业化：1 张牌 - 每回合一次，花费的 CP 为工业化掷骰提供 DRM。不能用 CP 链进行工业化",
          ),
        ),
      ],
    },
    {
      title: t("Stacking", "堆叠"),
      rule: "5.5",
      blocks: [
        table(
          [t("Where", "地点"), t("Limit", "上限")],
          [
            [t("Europe", "欧洲"), t("3 armies", "3 个军团")],
            [t("Africa/Asia", "非洲／亚洲"), t("2 armies", "2 个军团")],
            [t("Naval box", "海军区"), t("unlimited", "不限")],
            [t("Port", "港口"), t("4 naval units", "4 个海军单位")],
          ],
        ),
      ],
    },
    {
      title: t("Alliance Resolution Step", "同盟结算步骤"),
      rule: "8.6",
      blocks: [
        prose("(check for FR Second Republic)", "（法兰西第二共和国时须检查）"),
        bullets(
          t("The track that has the most influence is resolved first.", "影响力最多的轨道先结算。"),
          t(
            "If two factions have the same amount of influence, resolve them in turn order.",
            "若两个阵营影响力相同，按回合顺序结算。",
          ),
          t(
            "A die is rolled for every marker on the power's influence track that is ≥ 1. Influence is added as a DRM. If the result is a tie, the resolving player breaks the tie.",
            "对势力影响力轨道上每个 ≥1 的标记各掷 1 个骰子，影响力作为 DRM 加入。若结果相同，由结算玩家打破平局。",
          ),
          t(
            "When an alliance is resolved, place its current position on “1” space of the MPIT",
            "同盟结算后，将其当前位置放到 MPIT 的“1”格。",
          ),
        ),
        prose(
          "Only roll for MPIT markers that are ≥ 1. If the differential is ≥ 10 the alliance chit is shifted twice.",
          "只为 ≥1 的 MPIT 标记掷骰。若差值 ≥10，同盟标记移动两格。",
        ),
      ],
    },
  ],
};
