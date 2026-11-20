/**
 * Chart 4 — War Aims, wartime actions, the Non-Player Alliance Table, victory
 * types and treaty options.
 *
 * The alliance rows are transcribed from `engine/limitedWar.ts`
 * (`NON_PLAYER_ALLIANCE_TABLE`) where the engine already owns them; the rules
 * text around them is the printed player aid's own wording.
 */
import {bullets, prose, same, sub, t, table, type ChartText} from "./types";

export const WAR_AIMS_MINORS: ChartText = {
  id: "war-aims-minors",
  title: t("War Aims & Minors", "战争目标与小国"),
  sections: [
    {
      title: t("War Aims", "战争目标"),
      rule: "13.0",
      blocks: [
        bullets(
          t(
            "Liberation: target up to two spaces. Retake home spaces or liberate spaces in open rebellion.",
            "解放：指定至多两个空间。夺回本土空间，或解放公开叛乱的空间。",
          ),
          t(
            "Unification: target up to two spaces that containing the unifier's nationality (or citizenship for AU)",
            "统一：指定至多两个拥有统一者民族（奥匈为公民权）的空间",
          ),
          t(
            "Conquest: target up to two spaces, only one of can be a key, increases WTT by one, decrease stability by WTT after increase",
            "征服：指定至多两个空间，其中至多一个是关键区；世界紧张 +1，随后稳定减少“增加后的世界紧张”值",
          ),
        ),
      ],
    },
    {
      title: t("Wartime Actions", "战时行动"),
      rule: "15.4 / GW 27.5",
      blocks: [
        bullets(
          t("Deploy Reserves: 1 CP - place reserve armies = ½ industry (max 3)", "部署预备军：1 CP - 放置预备军 = ½ 工业（最多 3）"),
          t("Land Battle: 1 CP - launch an attack", "陆战：1 CP - 发动进攻"),
          t("Rail Move: 1 CP - move armies = ½ industry", "铁路运输：1 CP - 移动军团 = ½ 工业"),
          t(
            "March: 1 CP - move all armies 2 spaces (1 space via difficult/severe connections)",
            "行军：1 CP - 所有军团移动 2 个空间（经由困难／险峻连接时 1 个空间）",
          ),
          t("Naval Movement: 1 CP - move all fleets and 1 army", "海上移动：1 CP - 移动所有舰队和 1 个军团"),
          t("Joint Naval Operations: 1 CP - move with an ally", "联合海上行动：1 CP - 与盟友一同移动"),
          t("Refit Fleet: 1 CP (only in a friendly port) (GW only)", "整补舰队：1 CP（仅在友好港口）（仅大战）"),
          t("Refit: -1 CP (GW only)", "整补：-1 CP（仅大战）"),
          t("Draft: 1 CP + 1 MP - 2 reduced armies (GW only)", "征召：1 CP + 1 人力 - 2 个减员军团（仅大战）"),
          t("Elite Corps: 1 CP (GW only)", "精英军：1 CP（仅大战）"),
        ),
      ],
    },
    {
      title: t("Minor Power Alliance Table", "小国同盟表"),
      blocks: [
        table(
          [t("Nation", "国家"), t("1st Choice", "第 1 选择"), t("2nd Choice", "第 2 选择"), t("3rd Choice", "第 3 选择")],
          [
            [t("Netherlands/Bel.", "荷兰／比利时"), same("UK/GE*"), t("France", "法国"), same("-")],
            [t("Denmark", "丹麦"), same("UK/FR*"), same("GE/RU*"), t("Germany", "德国")],
            [t("German State", "德意志诸邦"), same("AU/GE*"), t("Russia", "俄国"), t("France", "法国")],
            [t("Balkan State", "巴尔干国家"), same("RU/AU*"), t("France", "法国"), t("UK", "英国")],
            [t("Greece", "希腊"), same("UK/RU*"), same("FR/AU*"), same("-")],
            [t("Italy/Italian Minor", "意大利／意大利小国"), same("FR/AU*"), t("Germany", "德国"), t("UK", "英国")],
            [t("Egypt", "埃及"), same("UK/FR*"), t("Ottomans", "奥斯曼"), same("-")],
            [t("Persia", "波斯"), same("UK/RU*"), t("France", "法国"), t("Ottomans", "奥斯曼")],
            [t("Qing China", "清帝国"), same("UK/FR*"), t("Russia", "俄国"), same("-")],
            [t("Japan", "日本"), same("UK/FR*"), t("Russia", "俄国"), same("-")],
            [t("Poland**", "波兰**"), t("France", "法国"), same("AU/GE*"), same("-")],
            [t("Ireland**", "爱尔兰**"), t("France", "法国"), t("Germany", "德国"), same("-")],
          ],
        ),
        prose(
          "*Both players roll a d6 to see who the minor power turns to for aid, reroll ties.",
          "*两名玩家各掷 1 个 d6，决定小国向谁求援；平局重掷。",
        ),
        prose(
          "**Poland and Ireland do not start as independent nations, but they can become independent",
          "**波兰与爱尔兰开局时并非独立国家，但之后可以独立。",
        ),
      ],
    },
    {
      title: t("(Pre-GW) Wartime SoP", "（大战前）战时流程"),
      blocks: [
        bullets(
          t(
            "1. War Aim Step: choose war aim, defender surrender?, defender plays card for CP war budget?",
            "1. 战争目标步骤：选择战争目标；守方是否投降？守方是否打出卡牌作为 CP 战争预算？",
          ),
          t(
            "2. Alliance Step: allies must play a card to join the war, all minor power allies may join",
            "2. 同盟步骤：盟友须打出 1 张牌才能参战；所有小国盟友都可以参战",
          ),
          t("3. Alliance Shift Step: shift defender's alliance chit.", "3. 同盟转换步骤：移动守方的同盟标记。"),
          t(
            "4. Initiative and Budget Step: set initiative order, set war budget (budget = CP + industry level)",
            "4. 先手与预算步骤：确定先手顺序，设定战争预算（预算 = CP + 工业等级）",
          ),
          t("5. Maneuver Step: take 1 CP actions in initiative order", "5. 机动步骤：按先手顺序执行花费 1 CP 的行动"),
          t("6. Victory Step: impose treaty options, exchange truces", "6. 胜利步骤：强加条约选项，交换停战"),
          t(
            "7. Demobilization Step: check for blockade, demobilize, displace armies, free redeployment and naval movement action.",
            "7. 复员步骤：检查封锁、复员、处理军团位移、免费重新部署与海上移动行动。",
          ),
        ),
      ],
    },
    {
      title: t("Victory Step and Treaty Options", "胜利步骤与条约选项"),
      rule: "16.0",
      blocks: [
        sub("Victory Types", "胜利类型"),
        bullets(
          t(
            "Major victory: occupying the opponent's capital or surrender. The winner receives two treaty options. Attacker +1 stability, defender -1 stability.",
            "大胜：占领对手首都或对手投降。胜者获得两个条约选项。攻方稳定 +1，守方稳定 -1。",
          ),
          t(
            "Normal victory: check if the attacker accomplished the war aims they set out at the beginning of the war. The winner receives one treaty option.",
            "普通胜利：检查攻方是否达成了战争开始时设定的战争目标。胜者获得一个条约选项。",
          ),
          t(
            "Defensive Victory: the attacker did not accomplish their war aims and the defender either: (1) occupies a space controlled by the attacker, or (2) is blocking the attacker. The winner receives one treaty option.",
            "防御胜利：攻方未达成战争目标，且守方满足下列之一：(1) 占领了攻方控制的空间，或 (2) 阻挡住攻方。胜者获得一个条约选项。",
          ),
          t(
            "Negotiated Peace: Both players agree to end the fighting with one side conceding 1 treaty option.",
            "谈判和平：双方同意结束战斗，其中一方让出 1 个条约选项。",
          ),
          t(
            "White Peace: both sides agree to end the fighting with no treaty options OR none of the above conditions are met. No treaty options are awarded.",
            "白和：双方同意在不设条约选项的情况下结束战斗；或以上条件均未满足。此时不授予任何条约选项。",
          ),
          t(
            "Special - Ally Knockout: This awards one treaty option, but it can only be imposed upon the player that was knocked out of the war.",
            "特殊 - 盟友出局：授予一个条约选项，但只能施加于被逐出战争的玩家。",
          ),
        ),
        sub("Treaty Options", "条约选项"),
        bullets(
          t(
            "Territorial Cession: Gain control of or, in the case of a liberation war aim, liberate all territory targeted at the beginning of the war.",
            "领土割让：获得控制权；若战争目标为解放，则解放战争开始时指定的全部领土。",
          ),
          t(
            "Realignment: there are two different types of realignment treaty options: (1) Choose one minor power allied with your opponent, remove the alliance marker from the minor power and replace it with your own. (2) This option is only available to the GE player in a war of unification. All minor powers that have GE nationality and were allied to the losing power become allies of the GE player.",
            "重新结盟：有两种不同的重新结盟条约选项：(1) 选择一个小国，移除对手与该小国的同盟标记，换为你自己的。(2) 此选项仅在统一战争中供德国玩家使用：所有拥有德意志民族、且曾与失败方结盟的小国，全部转为德国玩家的盟友。",
          ),
          t(
            "War Reparations: The winner of the war gains a +1 card marker and the loser gains a -1 card marker.",
            "战争赔款：战争胜者获得 +1 抽牌标记，败者获得 -1 抽牌标记。",
          ),
          t(
            "Righteous Defense: Only available to the defender. Gain control of one key or territory where the defender can trace a LoC. The space must be occupied unless it is a defender home space.",
            "正义防御：仅守方可用。获得一个守方能够追溯补给线的关键区或领地的控制权。该空间必须被占领，除非它是守方的本土空间。",
          ),
          t(
            "Colonial Cession: Gain one colonial key or naval base controlled by the losing player; this colony does not have to be occupied by the winner. Cannot choose a colonial home space, unless it is occupied by the winner.",
            "殖民地割让：获得失败方控制的一个殖民地关键区或海军基地；该殖民地不必由胜者占领。不能选择殖民地本土空间，除非该空间由胜者占领。",
          ),
        ),
      ],
    },
    {
      title: t("Refusing a Call to War", "拒绝参战召唤"),
      blocks: [
        bullets(
          t(
            "If the refusing player is an aligned alliance box, they immediately receive 5 neutral influence on the MPIT",
            "若拒绝的玩家处于“结盟”同盟框，其立即在 MPIT 上获得 5 点中立影响力",
          ),
          t(
            "If the refusing player is in a committed alliance box, they lose 1 stability and immediately receive 10 neutral influence on the MPIT",
            "若拒绝的玩家处于“坚定”同盟框，其失去 1 点稳定，并立即在 MPIT 上获得 10 点中立影响力",
          ),
          t(
            "If Italy is attacked and a player refuses to join the war Italy gains 10 neutral influence on the MPIT per player that refused to join",
            "若意大利遭到进攻而某玩家拒绝参战，每有一名玩家拒绝，意大利就在 MPIT 上获得 10 点中立影响力",
          ),
          t("Refusing to aid a minor power see 13.4.1", "拒绝援助小国见 13.4.1"),
          t(
            "Errata (Mar. 2026): if joining a war could cause a player ally to break a truce, they must decline with no penalties, which also cancels the penalties for refusing to aid Italy (13.4.1).",
            "勘误（2026 年 3 月）：若参战会导致玩家盟友破坏停战，其必须拒绝参战且不受惩罚，同时免除拒绝援助意大利的惩罚（13.4.1）。",
          ),
        ),
      ],
    },
    {
      title: t("Errata (Mar. 2026)", "勘误（2026 年 3 月）"),
      blocks: [
        bullets(
          t(
            "13.4.3 Non-Player Alliance Table: Denmark's 3rd choice is Austria. The printed sheet shows “Germany” in that cell, which is a misprint.",
            "13.4.3 非玩家同盟表：丹麦的第 3 选择为奥匈。原表在该格印作“Germany（德国）”，属误印。",
          ),
          t(
            "16.2.4 Righteous Defense: the defender may also give a home space controlled by the attacker back to its owner (occupied or not), or liberate a minority nationality in a space the defender occupies and immediately ally with the new minor power.",
            "16.2.4 正义防御：守方还可将攻方控制的本土空间交还原主（不论是否被占领），或解放其占领空间中的少数民族并立即与新小国结盟。",
          ),
          t(
            "16.2 Treaty Options: each option can only be chosen once, and no more than one option may be imposed on a player who is not a primary belligerent.",
            "16.2 条约选项：每个选项只能被选择一次；对非主要交战方的玩家最多只能强加一个选项。",
          ),
        ),
      ],
    },
  ],
};
