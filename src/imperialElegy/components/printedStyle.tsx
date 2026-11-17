/**
 * Printed-board primitives shared by the reference sheet and the live map.
 *
 * Keeping the flags, star geometry and nameplates here means the interactive
 * board cannot drift from the printed sheet: both draw the same counter, from
 * the same data, at the same scale.
 */
import React from "react";
import {Power, SpaceDef} from "../types";
import {POWER_DEFS} from "../constant/powers";

export const BOARD_FONT = "Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Times New Roman', serif";
export const PRINTED_INK = "#2b241a";

export const isMajor = (control: string | null): control is Power =>
  control !== null && Object.prototype.hasOwnProperty.call(POWER_DEFS, control);

export const markerRadius = (space: SpaceDef): number => {
  if (space.type === "navalBox") return 104;
  if (space.type === "territory") return 58;
  return 66;
};

type FlagLayout = "horizontal" | "vertical" | "union" | "special";

interface FlagSpec {
  layout: FlagLayout;
  colors: string[];
  /** A second field colour, for canton/cross/symbol drawing. */
  accent?: string;
  symbol?: "cross" | "saltire" | "crescent" | "star" | "disc" | "sun" | "checker" | "triangle" | "stars";
}

const flag = (layout: FlagLayout, colors: string[], symbol?: FlagSpec["symbol"], accent?: string): FlagSpec =>
  ({layout, colors, symbol, accent});

/**
 * The flags printed beside the counters.  Where a nationality has a
 * conventional tricolour the colours are the historical ones; the small
 * emblems are simplified to what a 40 px flag can actually show.
 */
const FLAGS: Record<string, FlagSpec> = {
  Germany: flag("horizontal", ["#1d1d1b", "#f2eee1", "#a5232a"]),
  "United Kingdom": flag("union", ["#1e3f75", "#f4efe2", "#b3262e"]),
  France: flag("vertical", ["#1f4f8b", "#f4efe2", "#b3262e"]),
  "Austria-Hungary": flag("horizontal", ["#b3262e", "#f4efe2", "#b3262e"]),
  Russia: flag("horizontal", ["#f4efe2", "#1f4f8b", "#b3262e"]),
  "Ottoman Empire": flag("special", ["#b3262e"], "crescent", "#f4efe2"),
  Italy: flag("vertical", ["#2e7d4f", "#f4efe2", "#b3262e"]),
  Belgium: flag("vertical", ["#1d1d1b", "#e0b83a", "#b3262e"]),
  Netherlands: flag("horizontal", ["#b3262e", "#f4efe2", "#1f4f8b"]),
  Denmark: flag("special", ["#b3262e"], "cross", "#f4efe2"),
  Greece: flag("special", ["#1f4f8b", "#f4efe2"], "cross", "#f4efe2"),
  Romania: flag("vertical", ["#1f4f8b", "#e0b83a", "#b3262e"]),
  Serbia: flag("horizontal", ["#b3262e", "#1f4f8b", "#f4efe2"]),
  Bulgaria: flag("horizontal", ["#f4efe2", "#2e7d4f", "#b3262e"]),
  "Bosnia-Herzegovina": flag("special", ["#1f4f8b", "#e0b83a"], "triangle"),
  Croatia: flag("horizontal", ["#b3262e", "#f4efe2", "#1f4f8b"], "checker"),
  Hungary: flag("horizontal", ["#b3262e", "#f4efe2", "#2e7d4f"]),
  Bohemia: flag("special", ["#f4efe2", "#b3262e"], "triangle", "#1f4f8b"),
  Poland: flag("horizontal", ["#f4efe2", "#b3262e"]),
  Ukraine: flag("horizontal", ["#1f62a8", "#e0b83a"]),
  Finland: flag("special", ["#f4efe2"], "cross", "#1f62a8"),
  Ireland: flag("vertical", ["#2e7d4f", "#f4efe2", "#d9772a"]),
  Scotland: flag("special", ["#1f4f8b"], "saltire", "#f4efe2"),
  Wales: flag("horizontal", ["#f4efe2", "#2e7d4f"], "disc", "#b3262e"),
  Bavaria: flag("special", ["#6ba3c8", "#f4efe2"], "checker", "#1f4f8b"),
  Saxony: flag("horizontal", ["#f4efe2", "#2e7d4f"]),
  Hanover: flag("horizontal", ["#f4efe2", "#e0b83a"]),
  Tuscany: flag("horizontal", ["#b3262e", "#f4efe2", "#b3262e"]),
  "Papal States": flag("vertical", ["#e0b83a", "#f4efe2"], "cross", "#b3262e"),
  "Two Sicilies": flag("horizontal", ["#f4efe2", "#1f4f8b", "#b3262e"]),
  "Qing China": flag("special", ["#e0b83a"], "disc", "#b3262e"),
  Japan: flag("special", ["#f4efe2"], "disc", "#b3262e"),
  Korea: flag("special", ["#f4efe2"], "disc", "#b3262e"),
  "United States": flag("special", ["#b3262e", "#f4efe2"], "stars", "#1f4f8b"),
  Mexico: flag("vertical", ["#2e7d4f", "#f4efe2", "#b3262e"]),
  Morocco: flag("special", ["#b3262e"], "star", "#2e7d4f"),
  Ethiopia: flag("horizontal", ["#2e7d4f", "#e0b83a", "#b3262e"]),
  Egypt: flag("horizontal", ["#b3262e", "#f4efe2", "#1d1d1b"]),
  Italians: flag("vertical", ["#2e7d4f", "#f4efe2", "#b3262e"]),
  Germans: flag("horizontal", ["#1d1d1b", "#f4efe2", "#a5232a"]),
  French: flag("vertical", ["#1f4f8b", "#f4efe2", "#b3262e"]),
  Czechs: flag("special", ["#f4efe2", "#b3262e"], "triangle", "#1f4f8b"),
  Poles: flag("horizontal", ["#f4efe2", "#b3262e"]),
  Ukrainians: flag("horizontal", ["#1f62a8", "#e0b83a"]),
  Hungarians: flag("horizontal", ["#b3262e", "#f4efe2", "#2e7d4f"]),
  Croats: flag("horizontal", ["#b3262e", "#f4efe2", "#1f4f8b"], "checker"),
  Serbians: flag("horizontal", ["#b3262e", "#1f4f8b", "#f4efe2"]),
  Romanians: flag("vertical", ["#1f4f8b", "#e0b83a", "#b3262e"]),
  Bulgarians: flag("horizontal", ["#f4efe2", "#2e7d4f", "#b3262e"]),
  Bosnians: flag("special", ["#1f4f8b", "#e0b83a"], "triangle"),
  Greeks: flag("special", ["#1f4f8b", "#f4efe2"], "cross", "#f4efe2"),
  Arabs: flag("special", ["#1d1d1b", "#f4efe2", "#2e7d4f"], "triangle", "#b3262e"),
  Egyptians: flag("horizontal", ["#b3262e", "#f4efe2", "#1d1d1b"]),
  Syrians: flag("horizontal", ["#2e7d4f", "#f4efe2", "#1d1d1b"], "stars", "#b3262e"),
  Palestinians: flag("special", ["#1d1d1b", "#f4efe2", "#2e7d4f"], "triangle", "#b3262e"),
  Armenians: flag("horizontal", ["#b3262e", "#1f4f8b", "#d9772a"]),
  Belarusians: flag("horizontal", ["#b3262e", "#2e7d4f"]),
  Finns: flag("special", ["#f4efe2"], "cross", "#1f62a8"),
  Latvians: flag("horizontal", ["#8f2d3b", "#f4efe2", "#8f2d3b"]),
  Lithuanians: flag("horizontal", ["#e0b83a", "#2e7d4f", "#b3262e"]),
  Estonians: flag("horizontal", ["#2b5d9b", "#1d1d1b", "#f4efe2"]),
  Macedonians: flag("special", ["#b3262e"], "sun", "#e0b83a"),
  Danes: flag("special", ["#b3262e"], "cross", "#f4efe2"),
  Irish: flag("vertical", ["#2e7d4f", "#f4efe2", "#d9772a"]),
  Scots: flag("special", ["#1f4f8b"], "saltire", "#f4efe2"),
  Welsh: flag("horizontal", ["#f4efe2", "#2e7d4f"], "disc", "#b3262e"),
};

const FALLBACK_FLAGS: [string, string][] = [
  ["#b3262e", "#f4efe2"],
  ["#1f4f8b", "#e0b83a"],
  ["#2e7d4f", "#f4efe2"],
  ["#7b5aa6", "#f4efe2"],
  ["#d9772a", "#1d1d1b"],
];

const specFor = (name: string | null | undefined): FlagSpec | null => {
  if (!name) return null;
  const known = FLAGS[name];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const [a, b] = FALLBACK_FLAGS[hash % FALLBACK_FLAGS.length];
  return flag("horizontal", [a, b]);
};

const starPoints = (cx: number, cy: number, outer: number, inner: number, points = 5): string =>
  Array.from({length: points * 2}, (_, i) => {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? outer : inner;
    return `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`;
  }).join(" ");

/**
 * One printed flag at `w` x `h`, anchored at its top-left.  The little fold at
 * the hoist and the slight rotation are the printed artwork's cues; they also
 * stop a block of flags from reading as a row of rectangles.
 */
export const Flag = ({
  name, x, y, w = 86, h = 54, rotate = -5,
}: {name: string; x: number; y: number; w?: number; h?: number; rotate?: number}) => {
  const spec = specFor(name);
  if (!spec) return null;
  const base = spec.colors[0];
  const second = spec.colors[1] ?? "#f4efe2";
  const third = spec.colors[2] ?? base;
  const accent = spec.accent ?? "#f4efe2";
  const stripe = spec.layout === "vertical" ? w / spec.colors.length : h / spec.colors.length;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`} data-flag={name}>
      <path d={`M0,0 H${w} V${h} H0 L${Math.max(4, w * 0.08)},${h / 2} Z`} fill={base}
        stroke="#2a2218" strokeWidth={1.8}/>
      <g opacity={0.97}>
        {spec.layout === "horizontal" && spec.colors.map((color, index) => (
          <rect key={index} x={0} y={index * stripe} width={w} height={stripe + 0.5} fill={color}
           />
        ))}
        {spec.layout === "vertical" && spec.colors.map((color, index) => (
          <rect key={index} x={index * stripe} y={0} width={stripe + 0.5} height={h} fill={color}
           />
        ))}
        {spec.layout === "union" && (
          <>
            <rect width={w} height={h} fill={base}/>
            <path d={`M0,0 L${w},${h} M${w},0 L0,${h}`} stroke="#f4efe2" strokeWidth={h * 0.26}/>
            <path d={`M0,0 L${w},${h} M${w},0 L0,${h}`} stroke="#b3262e" strokeWidth={h * 0.12}/>
            <rect x={w * 0.33} y={0} width={w * 0.34} height={h} fill="#f4efe2"/>
            <rect x={0} y={h * 0.34} width={w} height={h * 0.32} fill="#f4efe2"/>
            <rect x={w * 0.38} y={0} width={w * 0.24} height={h} fill="#b3262e"/>
            <rect x={0} y={h * 0.4} width={w} height={h * 0.2} fill="#b3262e"/>
          </>
        )}
        {spec.layout === "special" && (
          <>
            {spec.colors.length >= 3 ? (
              <>
                <rect width={w} height={h / 3} fill={base}/>
                <rect y={h / 3} width={w} height={h / 3} fill={second}/>
                <rect y={(h * 2) / 3} width={w} height={h / 3} fill={third}/>
              </>
            ) : (
              <rect width={w} height={h} fill={base}/>
            )}
            {spec.symbol === "cross" && (
              <>
                <rect x={w * 0.38} y={0} width={w * 0.14} height={h} fill={accent}/>
                <rect x={0} y={h * 0.4} width={w} height={h * 0.16} fill={accent}/>
              </>
            )}
            {spec.symbol === "saltire" && (
              <path d={`M0,0 L${w},${h} M${w},0 L0,${h}`} stroke={accent} strokeWidth={h * 0.15}/>
            )}
            {spec.symbol === "crescent" && (
              <>
                <circle cx={w * 0.56} cy={h * 0.5} r={h * 0.22} fill={accent}/>
                <circle cx={w * 0.62} cy={h * 0.5} r={h * 0.18} fill={base}/>
                <polygon points={starPoints(w * 0.73, h * 0.5, h * 0.11, h * 0.045)} fill={accent}/>
              </>
            )}
            {spec.symbol === "star" && (
              <polygon points={starPoints(w * 0.5, h * 0.5, h * 0.25, h * 0.1)} fill={accent}/>
            )}
            {spec.symbol === "disc" && <circle cx={w * 0.5} cy={h * 0.5} r={h * 0.22} fill={accent}/>}
            {spec.symbol === "sun" && (
              <>
                <circle cx={w * 0.5} cy={h * 0.5} r={h * 0.2} fill={accent}/>
                {Array.from({length: 8}, (_, i) => (
                  <line key={i} x1={w * 0.5} y1={h * 0.5} x2={w * 0.5 + Math.cos((i * Math.PI) / 4) * h * 0.38}
                    y2={h * 0.5 + Math.sin((i * Math.PI) / 4) * h * 0.38} stroke={accent} strokeWidth={2.4}/>
                ))}
              </>
            )}
            {spec.symbol === "checker" && (
              <g fill={accent}>
                {Array.from({length: 12}, (_, i) => (
                  <rect key={i} x={(i % 4) * (w / 4)} y={Math.floor(i / 4) * (h / 3)} width={w / 4} height={h / 3}
                    opacity={((i % 2) + Math.floor(i / 4)) % 2 === 0 ? 0.9 : 0}/>
                ))}
              </g>
            )}
            {spec.symbol === "triangle" && (
              <path d={`M0,0 L${w * 0.44},${h * 0.5} L0,${h} Z`} fill={accent}/>
            )}
            {spec.symbol === "stars" && (
              <g fill={accent}>
                {[0.25, 0.5, 0.75].map((fx, row) =>
                  [0.25, 0.55].map((fy, column) => (
                    <polygon key={`${fx}-${fy}`}
                      points={starPoints(w * fx, h * (0.25 + row * 0.22 + column * 0.06), h * 0.07, h * 0.03)}/>
                  )),
                )}
              </g>
            )}
          </>
        )}
      </g>
      <path d={`M0,0 H${w} V${h} H0 L${Math.max(4, w * 0.08)},${h / 2} Z`} fill="none"
        stroke="#2a2218" strokeWidth={1.4}/>
    </g>
  );
};

export const capitalStar = (r: number): string =>
  Array.from({length: 16}, (_, i) => {
    const angle = (Math.PI / 8) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.63;
    return `${(Math.cos(angle) * radius).toFixed(1)},${(Math.sin(angle) * radius).toFixed(1)}`;
  }).join(" ");

const labelLines = (name: string): string[] => {
  if (name.length <= 13) return [name];
  const words = name.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line === "") line = word;
    else if (`${line} ${word}`.length <= 13) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
};

export const PrintedNameplate = ({
  name, y, fontSize = 21, maxWidth = 252, selected = false,
}: {name: string; y: number; fontSize?: number; maxWidth?: number; selected?: boolean}) => {
  const lines = labelLines(name.toUpperCase());
  const width = Math.min(maxWidth, Math.max(fontSize * 3.4, Math.max(...lines.map((line) => line.length)) * fontSize * 0.63 + 24));
  const height = lines.length === 1 ? Math.max(28, fontSize * 1.8) : 12 + lines.length * fontSize * 1.15;
  const lineStep = fontSize * 1.1;
  return (
    <g transform={`translate(0 ${y})`}>
      <rect x={-width / 2 + 3} y={3} width={width} height={height} rx={2} fill="rgba(44,36,26,.22)"/>
      <rect x={-width / 2} y={0} width={width} height={height} rx={2}
        fill={selected ? "#ffe9a8" : "#f6efdd"} stroke={selected ? "#7a2418" : "#3a3023"}
        strokeWidth={selected ? 3 : 2.2}/>
      {lines.map((line, index) => (
        <text key={line} x={0} y={height / 2 + (index - (lines.length - 1) / 2) * lineStep + 8}
          textAnchor="middle" fontFamily={BOARD_FONT} fontSize={fontSize} letterSpacing={0.6}
          fill={selected ? "#7a2418" : PRINTED_INK}
          fontWeight={selected ? 700 : 400}>{line}</text>
      ))}
      <circle cx={width / 2 - Math.max(4, fontSize * 0.38)} cy={height / 2} r={Math.max(1.6, fontSize * 0.15)} fill="#6d6252"/>
    </g>
  );
};

/** Nationality -> the power whose own flag it is.  A German in Germany does
 * not print a second flag on the counter; a German in Alsace-Lorraine does. */
const NATIONALITY_POWER: Record<string, string> = {
  Germans: "GE", French: "FR", Russians: "RU", Austrians: "AU", British: "UK",
};

export const largeFlagName = (space: SpaceDef, control: string | null = space.control): string | null => {
  const nationality = space.nationalities?.[0];
  if (nationality && NATIONALITY_POWER[nationality] !== control) return nationality;
  if (space.minorHome && space.minorHome !== control) return space.minorHome;
  if (space.nationalities === undefined && space.minorHome) return space.minorHome;
  if (control !== null && !isMajor(control)) return control;
  return null;
};

export const smallFlagName = (space: SpaceDef, control: string | null = space.control): string | null =>
  control;

