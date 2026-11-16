import React from "react";
import {CardDef} from "../constant/cards";
import {GoalDef} from "../constant/goals";
import {IELocale, ieStringsFor} from "./i18n";

const WIDTH = 300;
const INSET = 18;
const TEXT_WIDTH = WIDTH - INSET * 2;
const BODY_SIZE = 18;
const LINE_HEIGHT = 25;
const SERIF = 'Georgia, "Times New Roman", "Songti SC", SimSun, serif';

// Conservative glyph widths keep wrapping deterministic, including during SSR.
// CJK characters break individually; Latin words stay together when they fit.
const glyphWidth = (char: string): number => {
  if (/\s/.test(char)) return .3;
  if (/[\u2e80-\uffff]/u.test(char)) return 1;
  if (/[ilIjtfr.,:;!'|]/.test(char)) return .4;
  if (/[mwMW@%]/.test(char)) return 1;
  if (/[A-Z]/.test(char)) return .76;
  return .58;
};

const textWidth = (text: string, size: number): number =>
  Array.from(text).reduce((width, char) => width + glyphWidth(char) * size, 0);

const wrapText = (text: string, size: number, width: number): string[] => {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    const tokens = paragraph.match(/[\u2e80-\uffff]|[^\s\u2e80-\uffff]+|\s+/gu) ?? [];
    for (const token of tokens) {
      // Split unusually long words too, rather than clipping the rule text.
      const parts = textWidth(token, size) > width ? Array.from(token) : [token];
      for (const part of parts) {
        if (line && textWidth(line + part, size) > width) {
          lines.push(line.trimEnd());
          line = "";
        }
        line += line ? part : part.trimStart();
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
};

const TextLines = ({lines, y, size, lineHeight, className}: {
  lines: string[];
  y: number;
  size: number;
  lineHeight: number;
  className: string;
}) => (
  <text x={INSET} y={y} fontSize={size} className={className}>
    {lines.map((line, index) => <tspan key={index} x={INSET} dy={index === 0 ? 0 : lineHeight}>{line}</tspan>)}
  </text>
);

/** Small vector engravings replace the photographic panel on the printed cards. */
const CardEmblem = ({kind}: {kind: CardDef["kind"] | "goal"}) => (
  <g transform="translate(244 47)" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".65" aria-hidden="true">
    <circle r="31"/>
    <circle r="27" strokeWidth=".5"/>
    {kind === "home" ? <>
      <path d="M-19-8-12 13H12L19-8 8 0 0-15-8 0Z M-12 17H12 M-10 21H10"/>
      <circle cy="-18" r="2"/><circle cx="-20" cy="-11" r="2"/><circle cx="20" cy="-11" r="2"/>
    </> : kind === "greatWar" ? <>
      <path d="M-17-21 12 11 8 15-21-17Z M17-21-12 11-8 15 21-17Z M4 12 16 4 M-4 12-16 4 M10 14 18 23 M-10 14-18 23"/>
    </> : kind === "goal" ? <>
      <path d="M0-17 5-5 18-4 8 4 11 17 0 10-11 17-8 4-18-4-5-5Z"/>
      <path d="M-19 18Q-32 0-19-19 M19 18Q32 0 19-19"/>
    </> : <>
      <circle r="21"/>
      <ellipse rx="10" ry="21"/>
      <path d="M-21 0H21 M-18-10H18 M-18 10H18 M0-21V21"/>
    </>}
  </g>
);

/** Printed power colours on the action-card BOT BOX. */
const BOT_POWER_FILL: Record<string, string> = {
  GE: "#5a5a58", UK: "#b02a2a", FR: "#2f7bb4", AU: "#e0b02c", RU: "#b0ada4", OT: "#2f7a3a",
};
/** Unlit cell: the same parchment the printed box uses for "—". */
const BOT_CELL_EMPTY = "#eae7d4";
const BOT_GRID = [["GE", "UK"], ["FR", "AU"], ["RU", "OT"]] as const;

/**
 * The printed BOT BOX (9.1 / 9.2): a 2×3 grid under the CP value.  A lit cell
 * names a power whose Rule 34 bot always plays this card for its event; the
 * rest read "—".  The data only carries the lit powers, so every other cell is
 * drawn in the blank parchment and the geometry matches the card.
 */
const BotBoxGrid = ({y, powers, label}: {y: number; powers: readonly string[]; label: string}) => {
  const x = INSET;
  const cellW = 34;
  const cellH = 13;
  const lit = new Set(powers);
  return (
    <g className="ie-card-bot-box" aria-label={label}>
      <text x={x} y={y - 5} fontSize="9" fill="#5c5240" fontWeight="700">{label}</text>
      {BOT_GRID.map((row, r) => row.map((power, c) => {
        const on = lit.has(power);
        return (
          <g key={power}>
            <rect
              x={x + c * cellW}
              y={y + r * cellH}
              width={cellW}
              height={cellH}
              fill={on ? BOT_POWER_FILL[power] : BOT_CELL_EMPTY}
              stroke="#8d8770"
              strokeWidth=".5"
            />
            <text
              x={x + c * cellW + cellW / 2}
              y={y + r * cellH + cellH - 3}
              fontSize="9"
              fontWeight="700"
              textAnchor="middle"
              fill={on ? (power === "AU" ? "#4a3a10" : "#f7f2df") : "#8d8770"}
            >
              {on ? power : "–"}
            </text>
          </g>
        );
      }))}
    </g>
  );
};


export type CardFaceProps = {locale: IELocale; showTranslation?: boolean} & (
  | {card: CardDef; goal?: never}
  | {goal: GoalDef; card?: never}
);

/** Data-driven SVG face: no raster images, external fonts, or image requests. */
export const CardFace = React.memo((props: CardFaceProps) => {
  const {locale, card, goal, showTranslation = true} = props;
  const data = goal ?? card!;
  const t = ieStringsFor(locale);
  const uid = React.useId();
  const kind = goal ? "goal" : card!.kind;
  const title = locale === "zh_CN" ? data.titleZh : data.title;
  const text = locale === "zh_CN" ? data.textZh : data.text;
  const translation = locale === "zh_CN" ? data.text : data.textZh;
  const translatedTitle = locale === "zh_CN" ? data.title : data.titleZh;
  const titleLines = wrapText(title, 23, TEXT_WIDTH);
  const bodyLines = wrapText(text, BODY_SIZE, TEXT_WIDTH);
  const titleBottom = 112 + titleLines.length * 28;
  const bodyY = titleBottom + 28;
  // Rule 9.2 / 34.3.4: the printed BOT BOX sits under the CP value.  It is the
  // 2×3 grid GE/UK, FR/AU, RU/OT; a lit cell names a power whose bot always
  // plays that card for its event.  Drawn above the footer rule, and the card
  // grows to hold it, so no printed marker is ever hidden.
  const botBox = goal ? undefined : card!.botBox;
  const BOT_CELL_W = 34;
  const BOT_CELL_H = 13;
  const botBoxY = bodyY + (bodyLines.length - 1) * LINE_HEIGHT + 26;
  const botBoxHeight = botBox === undefined ? 0 : 16 + BOT_CELL_H * 3 + 14;
  const height = Math.max(
    380,
    bodyY + (bodyLines.length - 1) * LINE_HEIGHT + 58 + botBoxHeight,
  );
  const accent = kind === "goal" ? "#727b4b" : kind === "home" ? "#615942" : kind === "greatWar" ? "#8a4d3f" : "#397f76";
  const power = data.power;
  const category = goal ? t.goals : kind === "home" ? t.homeCard : kind === "greatWar" ? t.greatWarMap : t.cardType[card!.type];
  const categoryLines = wrapText(category, 12, 124);
  const subtitle = goal ? goal.power : kind === "action" ? card!.entry : `${power ? `${power} · ` : ""}${t.cardType[card!.type]}`;
  const footer = power ? t.seats[power] : kind === "greatWar" ? t.greatWarMap : card!.entry;
  const markers = goal
    ? `${goal.vp} VP${goal.partialVp ? ` / ${goal.partialVp} VP` : ""}`
    : [card!.remove ? (locale === "zh_CN" ? "事件后移出" : "Remove after event") : "", card!.draw ? (locale === "zh_CN" ? "抽牌" : "Draw card") : ""].filter(Boolean).join(" · ");

  return (
    <>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`ie-card-face ie-card-face-${kind}`}
        viewBox={`0 0 ${WIDTH} ${height}`}
        width={WIDTH}
        height={height}
        role="img"
        aria-labelledby={`${uid}-title ${uid}-description`}
        lang={locale === "zh_CN" ? "zh-CN" : "en"}
        fontFamily={SERIF}
        fill="#2d2a20"
        data-card-id={data.id}
      >
        <title id={`${uid}-title`}>{title}</title>
        <desc id={`${uid}-description`}>{`${category} · ${goal ? `${goal.vp} VP` : `${card!.cp} CP · ${t.cardType[card!.type]}`} · ${footer}. ${text}`}</desc>
        <defs>
          <linearGradient id={`${uid}-paper`} x2=".8" y2="1">
            <stop stopColor="#f8f3e6"/><stop offset="1" stopColor="#e9e2cc"/>
          </linearGradient>
          <pattern id={`${uid}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M0 6 6 0" stroke="#fff8df" strokeWidth=".5" opacity=".15"/>
          </pattern>
        </defs>
        <rect width={WIDTH} height={height} fill={`url(#${uid}-paper)`}/>
        <rect width={WIDTH} height="94" fill={accent}/>
        <rect width={WIDTH} height="94" fill={`url(#${uid}-hatch)`}/>
        <path d="M85 77H197 M85 81H171" stroke="#f0e8d2" strokeWidth=".7" opacity=".5"/>
        <g color="#f6edcf"><CardEmblem kind={kind}/></g>
        <rect x="15" y="14" width="56" height="58" fill="#f5efdc" stroke="#e2d8bd"/>
        <rect x="19" y="18" width="48" height="50" fill="none" stroke={accent}/>
        <text x="43" y="52" fontSize="39" fontWeight="700" textAnchor="middle" fill={accent}>{goal ? "✳" : card!.cp}</text>
        <text x="85" y="31" fontSize="12" fontWeight="700" fill="#fff6df">
          {categoryLines.map((line, index) => <tspan key={index} x="85" dy={index === 0 ? 0 : 16}>{line}</tspan>)}
        </text>
        <text x="85" y={37 + categoryLines.length * 16} fontSize="12" fill="#f0e8d2">{subtitle}</text>
        <rect y="94" width={WIDTH} height={titleBottom - 94} fill={kind === "goal" ? accent : "#e5dfc9"}/>
        <g fill={kind === "goal" ? "#fff8e6" : accent} fontWeight="700">
          <TextLines lines={titleLines} y={123} size={23} lineHeight={28} className="ie-card-title"/>
        </g>
        <path d={`M0 ${titleBottom}H${WIDTH}`} stroke={accent} strokeWidth="1"/>
        <TextLines lines={bodyLines} y={bodyY} size={BODY_SIZE} lineHeight={LINE_HEIGHT} className={`ie-card-rules${locale === "zh_CN" ? " ie-card-zh" : ""}`}/>
        {botBox !== undefined && botBox.length > 0 && <BotBoxGrid y={botBoxY} powers={botBox} label={t.botBox}/>}
        <path d={`M18 ${height - 34}H282`} stroke={accent} strokeWidth=".7" opacity=".6"/>
        <text x={INSET} y={height - 15} fontSize="12" fill={accent}>{footer}</text>
        <text x="282" y={height - 15} fontSize="12" textAnchor="end" fill={accent}>{markers ? `${markers} · ` : ""}{data.number}</text>
      </svg>
      {showTranslation && (
        <details className="ie-card-translation">
          <summary>{locale === "zh_CN" ? "English text" : "中文译文"}</summary>
          <div lang={locale === "zh_CN" ? "en" : "zh-CN"} className={locale === "en" ? "ie-card-zh" : undefined}>
            <strong>{translatedTitle}</strong>
            <p>{translation}</p>
          </div>
        </details>
      )}
    </>
  );
});
