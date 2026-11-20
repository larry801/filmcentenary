/**
 * The named dice modifiers behind a battle's two DRM totals.
 *
 * The board and the after-battle report both print the totals; the table asked
 * to see *where* each one came from ("我看不到 DRM 的来源").  Rule 18.2.1 and
 * 19.5 are long printed lists, and a card, a national characteristic, the
 * committed elite bonus and the force-point edge all feed the same number, so
 * one shared list keeps the live battle panel and the result dialog agreeing.
 *
 * Entries arrive pre-labelled by key from `engine/battleDrm.ts` (recorded) and
 * `engine/combat.ts#battleDrmBreakdown` (derived).  An unknown key still prints
 * its raw name instead of vanishing.
 */
import React from "react";
import type {BattleDrmBreakdown, BattleDrmSource} from "../types";
import {spaceLabel} from "../constant/spaces";
import {cardDisplayNameById} from "./cardDisplay";
import {bi} from "./boardHelpers";

type Locale = "en" | "zh_CN";

const SOURCE_LABELS: Record<string, {en: string; zh: string}> = {
  amphibious: {en: "Amphibious assault", zh: "两栖登陆"},
  stability: {en: "Stability track", zh: "稳定度轨道"},
  manpowerExhausted: {en: "Manpower exhausted (GW)", zh: "兵员枯竭（大战）"},
  reducedOnly: {en: "Only reduced units in the force", zh: "部队全部为受损单位"},
  brokenLoc: {en: "Broken line of communication", zh: "补给线中断"},
  difficultTerrain: {en: "Difficult terrain on the approach", zh: "进攻路线地形困难"},
  noFriendlyPorts: {en: "No friendly adjacent port", zh: "相邻区域没有友方港口"},
  portAdvantage: {en: "Two or more ports more than the opponent", zh: "比对手多两个以上港口"},
  failedAvoid: {en: "Failed to avoid battle", zh: "避战失败"},
  warLandDrm: {en: "New Rifles / New Artillery (this war)", zh: "新式步枪／新式火炮（本场战争）"},
  combatDrm: {en: "At Any Cost (A43)", zh: "不惜一切（A43）"},
  enemyLandDrm: {en: "Charge of the Light Brigade (A60)", zh: "轻骑兵冲锋（A60）"},
  gwCombatDrm: {en: "Technological Terror / Dawn of Modern Warfare (GW-03/GW-04)", zh: "技术恐怖／现代战争黎明（GW-03/GW-04）"},
  combatCard: {en: "Combat card", zh: "战斗牌"},
  britishFirstArmy: {en: "British 1st Army", zh: "英国第一军团"},
  indianArmy: {en: "Indian army while India is unstable", zh: "印度不稳时的印度军团"},
  zouaves: {en: "Zouaves", zh: "祖阿夫兵"},
  bewegungskrieg: {en: "Bewegungskrieg", zh: "运动战"},
  prussianMilitaryTradition: {en: "Prussian Military Tradition", zh: "普鲁士军事传统"},
  dreyfusAffair: {en: "Dreyfus Affair", zh: "德雷福斯事件"},
  endlessSpace: {en: "Endless Space (support halved)", zh: "无尽空间（支援减半）"},
  jihad: {en: "Ottoman Jihad marker", zh: "奥斯曼圣战标记"},
  eliteBonus: {en: "Committed elite unit", zh: "投入的精英单位"},
  forcePointEdge: {en: "Force-point advantage", zh: "兵力点优势"},
  machineGuns: {en: "Machine Guns: minimum die roll 3", zh: "机枪：掷骰最低为 3"},
};

const signed = (value: number): string => (value > 0 ? `+${value}` : String(value));

/** A 0-DRM informational line (e.g. Machine Guns) prints a dash, not "+0". */
const drmText = (value: number): string => (value === 0 ? "—" : signed(value));

/**
 * Fills a label's parenthetical detail in the reader's punctuation: the
 * Chinese board uses full-width brackets, the English one ASCII.
 */
const withDetail = (label: string, detail: string, locale: Locale): string =>
  locale === "zh_CN" ? `${label}（${detail}）` : `${label} (${detail})`;

/** The clauses this entry names, with its own numbers filled in. */
const sourceLabel = (source: BattleDrmSource, locale: Locale): string => {
  const detail = source.detail ?? {};
  switch (source.key) {
    case "stability": {
      const name = bi(locale, "Stability track", "稳定度轨道");
      return detail.value === undefined ? name : withDetail(name, String(detail.value), locale);
    }
    case "brokenLoc": {
      const name = bi(locale, "Broken line of communication", "补给线中断");
      return detail.space === undefined ? name : `${name} · ${spaceLabel(detail.space, locale)}`;
    }
    case "difficultTerrain": {
      const name = bi(locale, "Difficult terrain", "地形困难");
      return detail.space === undefined ? name : `${name} · ${spaceLabel(detail.space, locale)}`;
    }
    case "combatCard": {
      const card = detail.card === undefined ? "" : ` · ${cardDisplayNameById(detail.card, locale)}`;
      return `${bi(locale, "Combat card", "战斗牌")}${card}`;
    }
    case "eliteBonus": {
      const name = bi(locale, "Committed elite unit", "投入的精英单位");
      return detail.count === undefined ? name : `${name} ×${detail.count}`;
    }
    case "forcePointEdge": {
      const name = bi(locale, "Force-point advantage", "兵力点优势");
      return detail.count === undefined ? name : withDetail(name, `+${detail.count}`, locale);
    }
    default: {
      const known = SOURCE_LABELS[source.key];
      return known === undefined ? source.key : bi(locale, known.en, known.zh);
    }
  }
};

export interface BattleDrmListProps {
  side: "attacker" | "defender";
  breakdown: BattleDrmBreakdown | undefined;
  /** The side's total, printed under the list (falls back to the sum). */
  total: number;
  locale: Locale;
  /** The live battle is still running: label the list as "before the roll". */
  live?: boolean;
  testId?: string;
}

/** One side's modifier list, each line naming its clause and its signed DRM. */
export const BattleDrmList = ({side, breakdown, total, locale, live = false, testId}: BattleDrmListProps) => {
  // A saved battle or a hand-written test state may carry only the totals.
  const sources = breakdown?.[side] ?? [];
  const sum = sources.reduce((acc, source) => acc + source.drm, 0);
  return (
    <div className="ie-battle-drm" data-testid={testId ?? `ie-battle-drm-${side}`} data-side={side}>
      <div className="ie-battle-drm-head">
        <span>{side === "attacker" ? bi(locale, "Attacker DRM", "进攻方 DRM") : bi(locale, "Defender DRM", "防守方 DRM")}</span>
        <strong>{signed(total)}</strong>
      </div>
      {sources.length === 0 ? (
        <div className="ie-muted">
          {live
            ? bi(locale, "No modifier yet", "暂无修正")
            : bi(locale, "No modifiers were recorded", "没有记录修正来源")}
        </div>
      ) : (
        <ul>
          {sources.map((source, index) => (
            <li key={`${source.key}-${index}`} data-testid={`ie-battle-drm-${side}-item`}>
              <span className="ie-battle-drm-name">{sourceLabel(source, locale)}</span>
              <span className="ie-battle-drm-value">{drmText(source.drm)}</span>
            </li>
          ))}
        </ul>
      )}
      {sources.length > 0 && Math.abs(sum - total) > 0.001 && (
        // Should never happen once every site records its clause; printing the
        // difference is better than a list that silently fails to add up.
        <div className="ie-battle-drm-gap">
          {bi(locale, "Unnamed difference", "未列明的差额")}: {signed(total - sum)}
        </div>
      )}
    </div>
  );
};
