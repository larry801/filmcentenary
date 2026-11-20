/**
 * Chart 6 — the Great War panels: national will, the GW sequence of play, the
 * stability tables, the colonial war and the trenches.
 */
import {bullets, prose, same, t, table, type ChartText} from "./types";

export const COLONIAL_GREAT_WARS: ChartText = {
  id: "colonial-great-wars",
  title: t("Colonial & Great Wars", "殖民战争与大战"),
  sections: [
    {
      title: t("GW National Will Step", "大战国家意志步骤"),
      rule: "25.6",
      blocks: [
        prose("Players receive the following based on their total VPs:", "玩家按其总 VP 获得以下奖励："),
        table(
          [t("Total VPs", "总 VP"), t("Reward", "奖励")],
          [
            [t("0–2 VPs", "0–2 VP"), t("no bonus", "无奖励")],
            [t("3–4 VPs", "3–4 VP"), t("1 EC", "1 个精英军")],
            [t("5–6 VPs", "5–6 VP"), t("1 EC and 1 display track boost", "1 个精英军 + 1 次面板轨道提升")],
            [t("7–8 VPs", "7–8 VP"), t("1 EC and 2 display track boosts", "1 个精英军 + 2 次面板轨道提升")],
            [t("9–10+ VPs", "9–10+ VP"), t("1 EC and 3 display track boosts", "1 个精英军 + 3 次面板轨道提升")],
          ],
        ),
      ],
    },
    {
      title: t("GW SoP", "大战游戏流程"),
      blocks: [
        bullets(
          t(
            "Outbreak Step: (1) discard all cards (2) Form alliances, (3) place US in neutral box, (4) reveal and score NGs, (5) national will step, (6) set the GW turn order",
            "爆发步骤：(1) 弃掉所有卡牌，(2) 组建同盟，(3) 将美国放入中立框，(4) 公开并结算国家目标，(5) 国家意志步骤，(6) 确定大战回合顺序",
          ),
          t(
            "1. Planning Step: (1) draw GW card, (2) flip facedown GW combat cards, (3) set War budget (industry + colonial war bonus CPs), (4) give 1 CP to an ally",
            "1. 计划步骤：(1) 抽大战牌，(2) 翻开面朝下的大战战斗牌，(3) 设定战争预算（工业 + 殖民地战争奖励 CP），(4) 给盟友 1 CP",
          ),
          t(
            "2. Maneuver Step: in GW turn order, players conduct a 1 CP action",
            "2. 机动步骤：按大战回合顺序，玩家各执行一个 1 CP 行动",
          ),
          t(
            "3. Winter Step: (1) check for Blockade (US blockade?), (2) the Colonial War, (3) Neutrals may join or give 1 CP to another player, and (4) go back to Planning Step",
            "3. 冬季步骤：(1) 检查封锁（美国封锁？），(2) 殖民地战争，(3) 中立国可以参战，或给另一名玩家 1 CP，(4) 返回计划步骤",
          ),
        ),
      ],
    },
    {
      title: t("GW Stability Table", "大战稳定表"),
      blocks: [
        table(
          [t("Cause", "原因"), t("Stab Loss", "稳定损失")],
          [
            [
              t("Losing a territorial key on the main map or losing a home key in Asia or Africa", "失去主地图上的一个领土关键区，或失去亚洲／非洲的一个本土关键区"),
              same("-1"),
            ],
            [t("Recapturing one of the above keys", "夺回上述关键区之一"), same("+1")],
            [
              t("Decisive defeat, only if the defeated force contained at least 2 units (including supporting units)", "决定性失败，且被击败部队包含至少 2 个单位（含支援单位）"),
              same("-1"),
            ],
            [t("Losing a Dreadnought", "损失一艘无畏舰"), same("-1")],
            [t("Certain Colonial War results for UK and RU", "英国与俄国的特定殖民地战争结果"), same("-1")],
          ],
        ),
      ],
    },
    {
      title: t("(Pre-GW) Stability Loss Table", "（大战前）稳定损失表"),
      blocks: [
        table(
          [t("Cause", "原因"), t("Stab Loss", "稳定损失")],
          [
            [t("A space gains independence through a WoI", "某空间因独立战争而独立"), same("-1")],
            [t("Declaring a war of conquest", "发动征服战争"), t("-X*", "-X*")],
            [t("Major defeat in a war", "战争中大败"), same("-1")],
            [t("Major victory in a war", "战争中大胜"), same("+1")],
            [t("Losing a Dreadnought", "损失一艘无畏舰"), same("-1")],
          ],
        ),
      ],
    },
    {
      title: t("The Colonial War", "殖民地战争"),
      rule: "29.2",
      blocks: [
        prose(
          "Both alliances make an opposed die roll, for each continent, with the following modifiers:",
          "两个同盟在每个大洲各进行一次对抗掷骰，应用以下修正：",
        ),
        bullets(
          t("+1 per EF on the continent*", "该大洲每有 1 个远征军：+1*"),
          t(
            "+1 per elite unit on the continent (elite colonial EFs provide a total of +2)*",
            "该大洲每有 1 个精锐单位：+1（精锐殖民远征军共提供 +2）*",
          ),
          t("+1 per army on the continent*", "该大洲每有 1 个军团：+1*"),
          t("+2 for naval supremacy", "海上霸权：+2"),
        ),
        prose(
          "An alliance has naval supremacy in Africa if the South Atlantic Box and Indian Ocean Box only contain units from their alliance.",
          "若南大西洋区与印度洋区只包含某一同盟的单位，该同盟在非洲拥有海上霸权。",
        ),
        prose(
          "An alliance has naval supremacy in Asia if the Pacific Box and Indian Ocean Box only contain units from their alliance.",
          "若太平洋区与印度洋区只包含某一同盟的单位，该同盟在亚洲拥有海上霸权。",
        ),
        prose(
          "*Only count units on the Africa and Asia submaps.",
          "*只计算非洲与亚洲子地图上的单位。",
        ),
        prose("Apply the following results:", "应用以下结果："),
        bullets(
          t(
            "One alliance's total is greater than their opponents' total: Losing player eliminates one of their units (or one army step), the winning player may then take control of unoccupied one space.",
            "某一同盟的总数高于对手：失败方消灭自己的 1 个单位（或 1 级军团），胜方随后可以占领 1 个无人占领的空间。",
          ),
          t(
            "One alliance's total is greater than their opponents' total by 4 or more: Losing player eliminates two of their units (or two army steps), the winning player may then take control of unoccupied two spaces.",
            "某一同盟的总数比对手高 4 或以上：失败方消灭自己的 2 个单位（或 2 级军团），胜方随后可以占领 2 个无人占领的空间。",
          ),
        ),
        prose("UK stability check: did the UK's alliance win?", "英国稳定检查：英国的同盟获胜了吗？"),
        prose(
          "RU stability check: check Qajar Persia, Central Asia, and Manchuria. If 2/3 are enemy controlled RU loses one stability.",
          "俄国稳定检查：检查卡扎尔波斯、中亚与满洲。若其中 2/3 由敌方控制，俄国失去 1 点稳定。",
        ),
        bullets(
          t("Control of one submap: 1 bonus CP", "控制 1 个子地图：1 点奖励 CP"),
          t("Control of both submaps: 3 bonus CP", "控制两个子地图：3 点奖励 CP"),
        ),
      ],
    },
    {
      title: t("Trenches (GW Only)", "堑壕（仅大战）"),
      rule: "28.1",
      blocks: [
        prose(
          "Beginning with the first year of the GW (GW turn 1; there is a GW turn 0), all keys automatically have trenches. Trenches change combat in the following ways:",
          "从大战的第一年（大战第 1 回合；此前还有一个大战第 0 回合）开始，所有关键区自动拥有堑壕。堑壕按以下方式改变战斗：",
        ),
        bullets(
          t(
            "The attacking player must have a full strength army in the main attack force in order to attack a trench",
            "攻方主攻部队中必须有满编军团，才能进攻堑壕",
          ),
          t(
            "The attacker automatically takes an additional loss when attacking a trench space",
            "进攻堑壕空间时，攻方自动承受 1 点额外损失",
          ),
          t(
            "Causing a retreat in a trench space changes the status of the trench battle",
            "在堑壕空间造成撤退会改变该堑壕战的状态",
          ),
        ),
        prose("Trench battles have three statuses:", "堑壕战有三种状态："),
        bullets(
          t("Trench Battle 2 — Attacker Advantage", "堑壕战 2 —— 攻方优势"),
          t("Trench Battle 2 — Deadlock", "堑壕战 2 —— 僵持"),
          t("Trench Battle 4 — Defender Advantage", "堑壕战 4 —— 守方优势"),
        ),
        prose(
          "Keep track of the original attacker and the original defender in each trench battle as the “attacker” in a given battle is not always the original attacker.",
          "在每场堑壕战中记录最初的主攻方与主守方，因为某次战斗中的“攻方”并不总是最初的主攻方。",
        ),
      ],
    },
    {
      title: t("Card Icons", "卡牌图标"),
      blocks: [
        table(
          [t("Icon", "图标"), t("Meaning", "含义")],
          [
            [t("Power flag (GE, UK, FR, AU, RU, OT)", "势力旗帜（GE、UK、FR、AU、RU、OT）"), t("The card's owner", "该牌所属势力")],
            [same("M"), t("Mandatory", "强制")],
            [same("R"), t("Response", "响应")],
            [same("G"), t("National Goal", "国家目标")],
            [t("Combat (crossed sabres)", "战斗（交叉军刀）"), t("Combat card", "战斗牌")],
            [t("Bot box", "机器人格"), t("Bot Box", "机器人格")],
            [t("Card with an arrow", "带箭头的卡牌"), t("Draw a card", "抽一张牌")],
            [t("Card with a down arrow", "带向下箭头的卡牌"), t("Remove after Play", "打出后移除")],
            [t("1870s", "1870s"), t("Turn entry indicator", "入牌回合指示")],
            [t("3 in a VP box", "VP 框中的 3"), t("VP", "VP")],
            [t("3 in a CP box", "CP 框中的 3"), t("CP Value", "CP 值")],
          ],
        ),
      ],
    },
  ],
};
