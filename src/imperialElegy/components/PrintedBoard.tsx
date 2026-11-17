/**
 * The printed board, rebuilt as one vector sheet.
 *
 * This is not the interactive map: it is the physical board a player would lay
 * on the table, drawn in the same 7706 x 5462 coordinate space as the scan and
 * the space catalogue.  Terrain comes from the traced coastline data, while
 * every counter, nameplate, flag, chart and track is drawn from the game data
 * in `constant/spaces.ts` and the printed values beside it.
 *
 * The sheet is deliberately static.  It is the reference for "what does the
 * board actually say?", and the download button serialises this exact SVG, so
 * the exported file has no external font, image or stylesheet dependency.
 */
import React from "react";
import background from "../data/map-background.json";
import {CONNECTIONS, SPACES, SPACE_IDS} from "../constant/spaces";
import {POWER_DEFS} from "../constant/powers";
import {ConnectionDef, Power, SpaceDef, SpaceId} from "../types";
import {CONNECTION_STYLE, trimSegment} from "./connectionStyle";
import {flashpointHulls} from "./flashpoints";
import {Anchor} from "./Anchor";
import {BOARD_FONT, Flag, PrintedNameplate, capitalStar, isMajor, largeFlagName, markerRadius, smallFlagName} from "./printedStyle";

const PAPER = {
  x: background.paper[0],
  y: background.paper[1],
  width: background.paper[2] - background.paper[0],
  height: background.paper[3] - background.paper[1],
};

const SANS = "'Helvetica Neue', Arial, sans-serif";
const PAPER_FILL = "#efe6d2";
const PAPER_EDGE = "#b9a786";

const POWER_COLOR = (power: Power): string => POWER_DEFS[power].color;
const POWER_DARK = (power: Power): string => POWER_DEFS[power].dark;

const controlColor = (control: string | null): string => {
  if (control === null) return "#8b8b8b";
  if (isMajor(control)) return POWER_COLOR(control);
  return "#7b5aa6";
};

const controlDark = (control: string | null): string => {
  if (control === null) return "#4a4a4a";
  if (isMajor(control)) return POWER_DARK(control);
  return "#4f396e";
};

const toRect = (box: number[] | undefined) => {
  const [x0, y0, x1, y1] = box ?? [PAPER.x, PAPER.y, PAPER.x + PAPER.width, PAPER.y + PAPER.height];
  return {x: x0, y: y0, width: x1 - x0, height: y1 - y0};
};

const SpaceMarker = ({space}: {space: SpaceDef}) => {
  const r = markerRadius(space);
  const fill = controlColor(space.control);
  const dark = controlDark(space.control);
  const large = largeFlagName(space);
  const small = smallFlagName(space);
  const showLarge = large !== null && (space.nationalities !== undefined || !isMajor(space.control));
  const isCapital = space.type === "capital" || space.type === "subcapital";
  const isNavalBase = space.type === "navalBase";
  const isCircle = space.type === "territory";
  return (
    <g transform={`translate(${space.x} ${space.y})`} data-printed-space={space.id}>
      {/* Counter body: a light paper edge under a coloured plate, so the
          marker reads as a printed counter rather than a flat UI blob. */}
      {isCapital ? (
        <g>
          <polygon points={capitalStar(r + 10)} fill="#f8f1df" stroke={dark} strokeWidth={7} strokeLinejoin="round"/>
          <polygon points={capitalStar(r)} fill={fill} stroke={dark} strokeWidth={5} strokeLinejoin="round"/>
          <polygon points={capitalStar(r * 0.72)} fill="none" stroke="rgba(255,255,255,.24)" strokeWidth={2}/>
        </g>
      ) : isNavalBase ? (
        <g>
          <polygon points={`0,${-r * 1.08} ${r * 1.02},${r * 0.8} ${-r * 1.02},${r * 0.8}`}
            fill="#f8f1df" stroke={dark} strokeWidth={7} strokeLinejoin="round"/>
          <polygon points={`0,${-r * 0.94} ${r * 0.88},${r * 0.7} ${-r * 0.88},${r * 0.7}`}
            fill={fill} stroke={dark} strokeWidth={4} strokeLinejoin="round"/>
          <polygon points={`0,${-r * 0.55} ${r * 0.5},${r * 0.48} ${-r * 0.5},${r * 0.48}`}
            fill="none" stroke="rgba(255,255,255,.3)" strokeWidth={2}/>
        </g>
      ) : isCircle ? (
        <g>
          <circle r={r + 7} fill="#f8f1df" stroke={dark} strokeWidth={6}/>
          <circle r={r} fill={fill} stroke={dark} strokeWidth={4}/>
          <circle r={r * 0.78} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth={2}/>
        </g>
      ) : (
        <g>
          <rect x={-r + 3} y={-r + 3} width={r * 2} height={r * 2} rx={16} fill="rgba(44,36,26,.28)"/>
          <rect x={-r - 7} y={-r - 7} width={r * 2 + 14} height={r * 2 + 14} rx={20}
            fill="#f8f1df" stroke={dark} strokeWidth={5}/>
          <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={14} fill={fill}
            stroke={dark} strokeWidth={3}/>
          <rect x={-r + 7} y={-r + 7} width={r * 2 - 14} height={r * 2 - 14} rx={11} fill="none"
            stroke="rgba(255,255,255,.24)" strokeWidth={2}/>
        </g>
      )}

      {/* The flag of the space's nationality, or of the minor that owns it. */}
      {showLarge && large !== null && (
        <Flag name={large} x={-r * 0.38} y={-r * 0.24} w={r * 0.98} h={r * 0.62} rotate={-7}/>
      )}

      {/* The controlling power's small flag strip, as printed on the counter. */}
      {small !== null && !(large === small && showLarge) && (
        <Flag name={small} x={r * 0.28} y={r * 0.35} w={r * 0.56} h={r * 0.34} rotate={-6}/>
      )}

      {/* The printed anchor mark: one badge for the first port, a small "+" for
          any others, rather than a separate red line for every sea route. */}
      {space.ports && space.ports.length > 0 && (
        <g transform={`translate(${-r * 1.02} ${-r * 1.02})`}>
          <circle r={22} fill="#f7f1e0" stroke={isMajor(space.control) ? POWER_DARK(space.control) : "#4f396e"}
            strokeWidth={3}/>
          <Anchor size={30} color={isMajor(space.control) ? POWER_DARK(space.control) : "#4f396e"}/>
          {space.ports.length > 1 && (
            <text x={17} y={19} fontFamily={SANS} fontSize={15} fontWeight={700}
              fill="#4a3a22">+{space.ports.length - 1}</text>
          )}
        </g>
      )}

      {/* A key space prints the key/territory distinction as a small tab. */}
      {space.keyType === "colonial" && (
        <text x={r * 1.15} y={-r * 0.55} textAnchor="middle" fontFamily={SANS} fontSize={14}
          fontWeight={700} fill="#4a3a22">COL</text>
      )}

      <PrintedNameplate name={space.name} y={r + 14}/>
    </g>
  );
};

/* ------------------------------------------------------------------------- */
/* Panels, charts and tracks                                                  */
/* ------------------------------------------------------------------------- */

const Panel = ({
  x, y, w, h, children, rotate = 0,
}: {x: number; y: number; w: number; h: number; children: React.ReactNode; rotate?: number}) => (
  <g transform={`translate(${x} ${y})${rotate === 0 ? "" : ` rotate(${rotate} ${w / 2} ${h / 2})`}`}>
    <rect x={7} y={9} width={w} height={h} rx={3} fill="rgba(46,37,26,.3)"/>
    <rect width={w} height={h} rx={3} fill="#f7f0de" stroke="#4a3a26" strokeWidth={3}/>
    <rect x={8} y={8} width={w - 16} height={h - 16} fill="none" stroke="#8d7859" strokeWidth={2}/>
    {children}
  </g>
);

const chartTitle = (x: number, y: number, text: string, size = 38, anchor: "start" | "middle" = "start") => (
  <text x={x} y={y} fontFamily={BOARD_FONT} fontSize={size} fontWeight={700} fill="#3b2e20"
    textAnchor={anchor} letterSpacing={0.5}>{text}</text>
);

const BuildBox = () => {
  const columns: {
    title: string[];
    rows?: string[];
    note?: string;
    red?: number[];
  }[] = [
    {title: ["Low", "Countries", "& Denmark"], rows: ["BELGIUM", "NETHERLANDS", "DENMARK"]},
    {title: ["Germany"], rows: ["HANOVER", "SAXONY", "BAVARIA"]},
    {title: ["Poland"], note: "Builds two army steps [22.7]"},
    {title: ["Italy"], rows: ["PIEDMONT", "SARDINIA", "TUSCANY (1)", "KINGDOM OF", "THE TWO SICILIES"], red: [2]},
    {title: ["Balkans"], rows: ["BOSNIA (1)", "SERBIA (1)", "BULGARIA (1)", "GREECE", "ROMANIA (1)"], red: [0, 1, 2, 4]},
    {title: ["Non", "European"], rows: ["EGYPT", "QAJAR PERSIA", "JAPAN*"]},
  ];
  const width = 1155;
  const height = 268;
  const left = 92;
  const colWidth = (width - left - 22) / columns.length;
  return (
    <Panel x={1105} y={638} w={width} h={height}>
      <text transform={`translate(55 ${height - 34}) rotate(-90)`} fontFamily={BOARD_FONT}
        fontSize={30} fontWeight={700} fill="#2b241a" letterSpacing={1}>END PHASE BUILD BOX</text>
      {columns.map((column, index) => {
        const x = left + index * colWidth;
        return (
          <g key={column.title.join(" ")}>
            {index > 0 && <line x1={x} y1={12} x2={x} y2={height - 14} stroke="#6a573b" strokeWidth={2}/>}
            {column.title.map((line, lineIndex) => (
              <text key={line} x={x + colWidth / 2} y={40 + lineIndex * 25} textAnchor="middle"
                fontFamily={BOARD_FONT} fontSize={19} fontWeight={700} fill="#33291d">{line}</text>
            ))}
            {column.note && (
              <text x={x + colWidth / 2} y={150} textAnchor="middle" fontFamily={BOARD_FONT}
                fontSize={18} fontStyle="italic" fill="#33291d">
                <tspan x={x + colWidth / 2} dy={0}>Builds two</tspan>
                <tspan x={x + colWidth / 2} dy={21}>army steps</tspan>
                <tspan x={x + colWidth / 2} dy={21}>[22.7]</tspan>
              </text>
            )}
            {column.rows?.map((row, rowIndex) => (
              <text key={row} x={x + 14} y={151 + rowIndex * 21} fontFamily={BOARD_FONT} fontSize={16}
                fill={column.red?.includes(rowIndex) ? "#a32822" : "#33291d"}>• {row}</text>
            ))}
          </g>
        );
      })}
      <line x1={left} y1={12} x2={left} y2={height - 14} stroke="#6a573b" strokeWidth={2}/>
    </Panel>
  );
};

const TurnTracks = () => {
  const width = 1520;
  const height = 742;
  const decades = ["1850's", "1860's", "1870's", "1880's", "1890's", "1900's", "1910's"];
  return (
    <Panel x={5580} y={3320} w={width} h={height}>
      {chartTitle(42, 64, "Turn Track", 40)}
      {decades.map((decade, index) => {
        const x = 42 + index * 196;
        const dark = index === 2 || index === 4;
        return (
          <g key={decade}>
            <rect x={x} y={86} width={164} height={134} rx={26} fill="#cadba9" stroke="#a8bb88" strokeWidth={2}/>
            <text x={x + 82} y={168} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={58} fontWeight={700}
              fill="#262a1c">{index + 1}</text>
            <text x={x + 82} y={199} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={21}
              fill="#262a1c">{decade}</text>
            {index >= 2 && (
              <g transform={`translate(${x + 122} ${74})`}>
                <rect width={42} height={27} rx={4} fill="#6b5a45"/>
                <text x={21} y={19} textAnchor="middle" fontFamily={SANS} fontSize={13} fontWeight={700}
                  fill="#f6efdd">NEW</text>
              </g>
            )}
            {index === 2 && (
              <g transform={`translate(${x - 14} ${82})`}>
                <rect width={36} height={48} rx={4} fill="#8d7859"/>
                <text x={18} y={30} textAnchor="middle" fontFamily={SANS} fontSize={16} fontWeight={700}
                  fill="#f6efdd">NG</text>
              </g>
            )}
            {index === 4 && (
              <g transform={`translate(${x + 138} ${82})`}>
                <rect width={36} height={48} rx={4} fill="#8d7859"/>
                <text x={18} y={30} textAnchor="middle" fontFamily={SANS} fontSize={16} fontWeight={700}
                  fill="#f6efdd">NG</text>
              </g>
            )}
          </g>
        );
      })}

      {chartTitle(42, 312, "Great War Turn Track", 36)}
      {["0", "1", "2", "3", "4", "5"].map((turn, index) => {
        const x = 42 + index * 240;
        const notes = ["Opening\nmonths", "First Year\n(Trenches)", "Second Year", "Third Year", "Fourth Year", "Fifth Year"];
        return (
          <g key={turn}>
            <rect x={x} y={330} width={208} height={132} rx={24} fill="#cadba9" stroke="#a8bb88" strokeWidth={2}/>
            <text x={x + 104} y={405} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={52} fontWeight={700}
              fill="#262a1c">{turn}</text>
            {notes[index].split("\n").map((line, lineIndex) => (
              <text key={line} x={x + 104} y={438 + lineIndex * 17} textAnchor="middle" fontFamily={BOARD_FONT}
                fontSize={15} fill="#262a1c">{line}</text>
            ))}
          </g>
        );
      })}

      {chartTitle(42, 534, "World Tension Track", 36)}
      {["0", "1", "2", "3", "4", "5"].map((value, index) => {
        const x = 42 + index * 240;
        return (
          <g key={value}>
            <rect x={x} y={552} width={208} height={146} rx={24} fill="#cadba9" stroke="#a8bb88" strokeWidth={2}/>
            <text x={x + 104} y={646} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={62} fontWeight={700}
              fill="#262a1c">{value}</text>
            {index === 3 && (
              <text x={x + 104} y={674} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={14}
                fill="#262a1c">Cannot<tspan x={x + 104} dy={16}>Declare War</tspan></text>
            )}
            {index === 5 && (
              <text x={x + 104} y={674} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={14}
                fill="#262a1c">Roll on the<tspan x={x + 104} dy={16}>Crisis table</tspan></text>
            )}
          </g>
        );
      })}
    </Panel>
  );
};

const Flashpoints = () => {
  const width = 1923;
  const height = 470;
  const top = [
    {label: "Italy", keys: "3 Keys", filled: true},
    {label: "Germany", keys: "3 Keys", filled: true},
    {label: "Balkans", keys: "3 Keys"},
    {label: "Low Countries", keys: "3 Keys"},
    {label: "Caucasus"},
    {label: "Power Projection", triangle: true},
  ];
  const bottom = [
    {label: "Qing China and Japan", keys: "8 Keys", filled: true},
    {label: "Africa", keys: "8 Keys", filled: true},
    {label: "Central Europe", keys: "2 Keys"},
    {label: "Great Game", keys: "5 Spaces"},
    {label: "Suez Canal"},
    {label: "Power Projection", triangle: true},
  ];
  const columnWidth = (width - 60) / 6;
  return (
    <Panel x={5250} y={4068} w={width} h={height}>
      {chartTitle(34, 54, "Flashpoints", 44)}
      {top.map((item, index) => {
        const x = 30 + index * columnWidth;
        return (
          <g key={item.label}>
            <text x={x + columnWidth / 2} y={88} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={24}
              fontWeight={700} fill="#3a3023">{item.label}</text>
            {item.keys && (
              <text x={x + columnWidth / 2} y={112} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={18}
                fill="#6f5c42">{item.keys}</text>
            )}
            {!item.triangle && (
              <rect x={x + 8} y={126} width={columnWidth - 16} height={126} rx={20}
                fill={item.filled ? "#574a35" : "#f6efdd"} stroke="#574a35" strokeWidth={5}/>
            )}
            {item.triangle && (
              <g transform={`translate(${x + columnWidth / 2} 190)`}>
                <polygon points="0,-46 42,32 -42,32" fill="#8d7859"/>
                <text y={44} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={17} fill="#3a3023">Power Projection</text>
              </g>
            )}
          </g>
        );
      })}
      <line x1={24} y1={268} x2={width - 24} y2={268} stroke="#8d7859" strokeWidth={3}/>
      {bottom.map((item, index) => {
        const x = 30 + index * columnWidth;
        return (
          <g key={item.label}>
            {!item.triangle && (
              <rect x={x + 8} y={286} width={columnWidth - 16} height={96} rx={18}
                fill={item.filled ? "#574a35" : "#f6efdd"} stroke="#574a35" strokeWidth={5}/>
            )}
            {item.triangle && (
              <g transform={`translate(${x + columnWidth / 2} 330)`}>
                <polygon points="0,-34 32,24 -32,24" fill="#8d7859"/>
              </g>
            )}
            <text x={x + columnWidth / 2} y={412} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={22}
              fontWeight={700} fill="#3a3023">{item.label}</text>
            {item.keys && (
              <text x={x + columnWidth / 2} y={437} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={17}
                fill="#6f5c42">{item.keys}</text>
            )}
          </g>
        );
      })}
    </Panel>
  );
};

const VpTrack = () => {
  const width = 693;
  const height = 360;
  const cell = 79;
  return (
    <Panel x={6480} y={4552} w={width} h={height}>
      {chartTitle(24, 50, "VP and Power Projection Track", 27)}
      {Array.from({length: 16}, (_, value) => {
        const row = value < 8 ? 0 : 1;
        const column = value % 8;
        const x = 20 + column * (cell + 3);
        const y = 78 + row * 105;
        return (
          <g key={value}>
            <rect x={x} y={y} width={cell} height={92} rx={4} fill="#35657a" stroke="#264a5a" strokeWidth={2}/>
            <text x={x + cell / 2} y={y + 64} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={42}
              fontWeight={700} fill="#f6efdd">{value}</text>
          </g>
        );
      })}
    </Panel>
  );
};

const AllianceTrack = () => {
  const height = 548;
  const width = 1930;
  const boxes = [
    {top: "COMMITTED", main: "Triple\nAlliance", fill: "#d9b28c"},
    {top: "ALIGNED", main: "Triple\nAlliance", fill: "#e5c6a2"},
    {top: "", main: "Neutral", fill: "#d8d1cc"},
    {top: "ALIGNED", main: "Triple\nEntente", fill: "#b9c3d8"},
    {top: "COMMITTED", main: "Triple\nEntente", fill: "#a9b6cf"},
  ];
  const boxWidth = 350;
  return (
    <Panel x={2020} y={4360} w={width} h={height}>
      <rect x={0} y={0} width={width} height={height} fill="#2f5b5b"/>
      <rect x={8} y={8} width={width - 16} height={height - 16} fill="none" stroke="#1e3c3c" strokeWidth={4}/>
      <text x={width / 2} y={66} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={48}
        fontStyle="italic" fill="#f2ead7">The Alliance Track</text>
      {boxes.map((box, index) => {
        const x = 32 + index * (boxWidth + 16);
        return (
          <g key={index}>
            <rect x={x} y={106} width={boxWidth} height={380} fill={box.fill} stroke="#6b5a45" strokeWidth={3}/>
            <rect x={x + 10} y={116} width={boxWidth - 20} height={360} fill="none" stroke="#f7f0de" strokeWidth={3}/>
            <text x={x + boxWidth / 2} y={154} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={22}
              fill="#3b2e20">{box.top}</text>
            {box.main.split("\n").map((line, lineIndex) => (
              <text key={line} x={x + boxWidth / 2} y={240 + lineIndex * 38} textAnchor="middle"
                fontFamily={BOARD_FONT} fontSize={34} fill="#2b241a">{line}</text>
            ))}
          </g>
        );
      })}
    </Panel>
  );
};

const WartimeInitiative = () => (
  <Panel x={2040} y={4020} w={1160} h={300}>
    {chartTitle(24, 50, "Wartime Initiative Order", 34)}
    {[1, 2, 3, 4, 5, 6, 7].map((value, index) => (
      <g key={value}>
        <rect x={22 + index * 158} y={72} width={140} height={126} rx={8} fill="#8c806d" stroke="#5e5342" strokeWidth={3}/>
        <text x={92 + index * 158} y={153} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={62}
          fill="#f7f0de">{value}</text>
        {index === 6 && (
          <text x={92 + index * 158} y={183} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={15}
            fill="#f7f0de">US/Italy</text>
        )}
      </g>
    ))}
    <text x={24} y={238} fontFamily={BOARD_FONT} fontSize={17} fontStyle="italic" fill="#3b2e20">
      The US and Italy always go last, in that order.
    </text>
  </Panel>
);

const TitleCartouche = () => (
  <g transform="translate(5520 4535)">
    <rect x={6} y={8} width={935} height={315} fill="rgba(46,37,26,.22)"/>
    <rect width={935} height={315} fill="#f7f0de" stroke="#d8cdb6" strokeWidth={2}/>
    <text x={42} y={110} fontFamily={BOARD_FONT} fontSize={92} fontWeight={700} fill="#3d3224"
      letterSpacing={-2}>Imperial</text>
    <text x={42} y={210} fontFamily={BOARD_FONT} fontSize={88} fill="none" stroke="#3d3224"
      strokeWidth={2} letterSpacing={7}>ELEGY</text>
    <text x={44} y={258} fontFamily={BOARD_FONT} fontSize={19} fontStyle="italic" fill="#6d5a3f">
      The Imperial World at War · 1850–1920
    </text>
    <g transform="translate(770 238)">
      <polygon points="0,-22 20,-11 20,11 0,22 -20,11 -20,-11" fill="#3d3224"/>
      <text y={46} textAnchor="middle" fontFamily={SANS} fontSize={11} letterSpacing={1.2}
        fill="#3d3224">VUCA</text>
    </g>
  </g>
);

/* ------------------------------------------------------------------------- */
/* Printed place names and decorations                                        */
/* ------------------------------------------------------------------------- */

const CONTINENT_LABELS = [
  {text: "EUROPE", x: 2470, y: 2390, size: 180, rotate: -7},
  {text: "RUSSIA", x: 4700, y: 940, size: 250, rotate: 0},
  {text: "ASIA", x: 6320, y: 2280, size: 240, rotate: 0},
  {text: "AFRICA", x: 3380, y: 4380, size: 220, rotate: 0},
  {text: "TURKEY", x: 4220, y: 3270, size: 170, rotate: -4},
  {text: "PERSIA", x: 5220, y: 1700, size: 120, rotate: -11},
  {text: "CHINA", x: 6180, y: 1510, size: 190, rotate: 0},
  {text: "ARABIAN PENINSULA", x: 4710, y: 3980, size: 105, rotate: -2},
  {text: "NORTH AMERICA", x: 790, y: 2310, size: 78, rotate: 0},
] as const;

const SEA_LABELS = [
  {text: "NORTH ATLANTIC OCEAN", x: 750, y: 1760, size: 52, rotate: -6},
  {text: "SOUTH ATLANTIC OCEAN", x: 720, y: 4050, size: 48, rotate: 3},
  {text: "BALTIC SEA", x: 2820, y: 1010, size: 46, rotate: -8},
  {text: "MEDITERRANEAN SEA", x: 2420, y: 3260, size: 46, rotate: -4},
  {text: "BLACK SEA", x: 4160, y: 2890, size: 40, rotate: 0},
  {text: "INDIAN OCEAN", x: 5570, y: 2450, size: 52, rotate: -6},
  {text: "PACIFIC OCEAN", x: 6460, y: 2530, size: 46, rotate: -8},
  {text: "SOUTH & CENTRAL PACIFIC OCEAN", x: 6800, y: 3220, size: 36, rotate: -4},
] as const;

const FlashpointLabels = () => (
  <g fontFamily={BOARD_FONT} fill="#8d3f2d" opacity={0.62} pointerEvents="none">
    {[
      {text: "LOW COUNTRIES", x: 1710, y: 1595, rotate: -24},
      {text: "GERMANY", x: 2350, y: 1635, rotate: -20},
      {text: "CENTRAL EUROPE", x: 3370, y: 1730, rotate: 54},
      {text: "ITALY", x: 2220, y: 2810, rotate: 0},
      {text: "BALKANS", x: 3150, y: 2820, rotate: -38},
      {text: "AFRICA", x: 2570, y: 3750, rotate: 0},
      {text: "THE GREAT GAME", x: 5410, y: 1050, rotate: -10},
      {text: "CHINA & JAPAN", x: 6150, y: 1160, rotate: -16},
    ].map((label) => (
      <text key={label.text} x={label.x} y={label.y} fontSize={40} letterSpacing={7}
        transform={`rotate(${label.rotate} ${label.x} ${label.y})`}>{label.text}</text>
    ))}
  </g>
);

const NavalBox = ({id}: {id: SpaceId}) => {
  const space = SPACES[id];
  const box = NAVAL_PLATES[id];
  if (!space || !box) return null;
  const [x, y, w, h] = box;
  const name = space.name.toUpperCase();
  const color = id === "north-atlantic" ? "#b8a34c" : "#3d6d8a";
  // Wide, short plates print the title on two lines and put the anchor in the
  // body; the tall Atlantic and Pacific plates stack the title over the anchor.
  const compact = w > h * 1.4;
  const bare = name.replace(/ BOX$/, "");
  const titleSize = compact
    ? Math.min(44, (w - 80) / Math.max(8, bare.length) / 0.58)
    : name.length > 24 ? 38 : name.length > 16 ? 44 : 50;
  const lines = compact
    ? [bare, "BOX"]
    : name.includes("SOUTH & CENTRAL")
      ? ["SOUTH & CENTRAL", "PACIFIC OCEAN", "BOX"]
      : name.split(" ");
  const lineStep = titleSize * 0.9;
  const headerHeight = 32 + lines.length * lineStep;
  const firstBaseline = 22 + titleSize * 0.8;
  return (
    <g transform={`translate(${x} ${y})`} data-printed-naval={id}>
      <rect x={8} y={10} width={w} height={h} fill="rgba(46,37,26,.34)"/>
      <rect width={w} height={h} fill="#f8f1df" stroke="#4a3e2c" strokeWidth={3}/>
      <rect x={8} y={8} width={w - 16} height={h - 16} fill="none" stroke="#8d7859" strokeWidth={2}/>
      <rect x={14} y={14} width={w - 28} height={headerHeight} fill={color} stroke="#4a3e2c" strokeWidth={2}/>
      {lines.map((line, index) => (
        <text key={line} x={w / 2} y={firstBaseline + index * lineStep} textAnchor="middle"
          fontFamily={BOARD_FONT} fontSize={titleSize} fontWeight={700} fill="#252019">{line}</text>
      ))}
      <g transform={`translate(${w / 2} ${headerHeight + (h - headerHeight - 54) / 2})`}>
        <circle r={Math.min(w, h - headerHeight) * 0.17} fill="none" stroke={color} strokeWidth={5}/>
        <Anchor size={Math.min(w, h - headerHeight) * 0.23} color={color}/>
      </g>
      {id === "indian-ocean" && (
        <text x={w / 2} y={h - 58} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={18}
          fontStyle="italic" fill="#4a3e2c">Connects to Eastern Mediterranean
          <tspan x={w / 2} dy={21}>after Suez Canal</tspan></text>
      )}
    </g>
  );
};

/** Printed panel boxes, in board coordinates: x, y, width, height. */
const NAVAL_PLATES: Record<string, [number, number, number, number]> = {
  "north-atlantic": [505, 560, 520, 1010],
  "south-atlantic": [500, 4300, 540, 590],
  "baltic-sea": [2460, 600, 660, 280],
  "western-mediterranean": [1210, 2920, 720, 330],
  "eastern-mediterranean": [3300, 3595, 700, 330],
  "black-sea": [3830, 2450, 610, 350],
  "indian-ocean": [5350, 1900, 610, 480],
  "pacific-ocean": [6100, 2350, 600, 350],
  "south-central-pacific": [6440, 2680, 580, 420],
};

const EventBox = ({x, y, lines, number}: {x: number; y: number; lines: string[]; number?: number}) => (
  <g transform={`translate(${x} ${y})`}>
    <rect x={5} y={7} width={205} height={168} rx={18} fill="rgba(46,37,26,.28)"/>
    <rect width={205} height={168} rx={18} fill="#f7f0de" stroke="#77684d" strokeWidth={3}/>
    <rect x={9} y={9} width={187} height={150} rx={13} fill="none" stroke="#a99672" strokeWidth={2}/>
    {lines.map((line, index) => (
      <text key={line} x={102} y={58 + index * 32} textAnchor="middle" fontFamily={BOARD_FONT}
        fontSize={24} fontStyle="italic" fill="#3b2e20">{line}</text>
    ))}
    {number !== undefined && (
      <g transform="translate(-20 84)">
        <circle r={27} fill="#5b503e" stroke="#f7f0de" strokeWidth={3}/>
        <text y={9} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={26} fill="#f7f0de">{number}</text>
      </g>
    )}
  </g>
);

const Grid = () => (
  <g stroke="#3c7170" strokeWidth={1.8} opacity={0.13} pointerEvents="none">
    {Array.from({length: 12}, (_, index) => {
      const x = 560 + index * 590;
      return <path key={`v${index}`} d={`M${x},540 C${x + 24},1500 ${x - 18},3000 ${x + 32},4900`}/>;
    })}
    {Array.from({length: 9}, (_, index) => {
      const y = 620 + index * 500;
      return <path key={`h${index}`} d={`M480,${y} C1900,${y + 20} 4200,${y - 16} 7170,${y + 12}`}/>;
    })}
  </g>
);

/* ------------------------------------------------------------------------- */
/* The board                                                                  */
/* ------------------------------------------------------------------------- */

export interface PrintedBoardProps {
  /** Extra class for the sheet (the page uses it for print/layout). */
  className?: string;
}

export const PrintedBoard = ({className = ""}: PrintedBoardProps) => {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [notice, setNotice] = React.useState("");
  const [zoom, setZoom] = React.useState(1);
  const flashpoints = React.useMemo(() => flashpointHulls(70), []);
  const markers = SPACE_IDS.map((id) => SPACES[id]).filter((space) => space && space.type !== "navalBox");
  const navalBoxes = SPACE_IDS.filter((id) => SPACES[id]?.type === "navalBox");

  const download = () => {
    const node = svgRef.current;
    if (!node) return;
    const clone = node.cloneNode(true) as SVGSVGElement;
    clone.removeAttribute("style");
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(PAPER.width));
    clone.setAttribute("height", String(PAPER.height));
    clone.setAttribute("viewBox", `${PAPER.x} ${PAPER.y} ${PAPER.width} ${PAPER.height}`);
    const source = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
    const blob = new Blob([source], {type: "image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "imperial-elegy-board.svg";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("SVG downloaded");
  };

  return (
    <section className={`ie-printed-page ${className}`} data-testid="ie-printed-page">
      <header className="ie-printed-toolbar">
        <div>
          <h1>Imperial Elegy · printed board</h1>
          <p>
            The 1850–1920 campaign map at the printed sheet&apos;s own scale:
            1 board unit = 1 SVG unit.  Vector only — no scan, no fonts fetched,
            no raster fallback.
          </p>
        </div>
        <div className="ie-printed-actions">
          <div className="ie-printed-zoom" role="group" aria-label="Board zoom">
            <button type="button" className="ie-btn secondary" aria-label="Zoom out"
              data-testid="ie-printed-zoom-out" onClick={() => setZoom((value) => Math.max(1, value - 0.5))}>−</button>
            <button type="button" className="ie-btn secondary" data-testid="ie-printed-zoom-fit"
              onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
            <button type="button" className="ie-btn secondary" aria-label="Zoom in"
              data-testid="ie-printed-zoom-in" onClick={() => setZoom((value) => Math.min(4, value + 0.5))}>+</button>
          </div>
          <button type="button" className="ie-btn" data-testid="ie-printed-download" onClick={download}>
            Download SVG
          </button>
          <button type="button" className="ie-btn secondary" onClick={() => window.print()}>
            Print
          </button>
          <a className="ie-btn secondary" href="/localIE">Back to the game</a>
        </div>
      </header>
      {notice !== "" && <p className="ie-printed-notice" role="status">{notice}</p>}

      <div className="ie-printed-stage">
        <svg
          ref={svgRef}
          className="ie-printed-board"
          style={zoom === 1 ? undefined : {width: `${zoom * 100}%`, maxWidth: "none"}}
          viewBox={`${PAPER.x} ${PAPER.y} ${PAPER.width} ${PAPER.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Imperial Elegy printed campaign board, 1850 to 1920"
          data-testid="ie-printed-board"
          data-spaces={markers.length}
          data-naval={navalBoxes.length}
        >
          <defs>
            <linearGradient id="printed-sea" gradientUnits="userSpaceOnUse"
              x1={PAPER.x} y1={PAPER.y} x2={PAPER.x + PAPER.width * 0.45} y2={PAPER.y + PAPER.height}>
              <stop offset="0%" stopColor="#bcd2cf"/>
              <stop offset="52%" stopColor="#a2c0c0"/>
              <stop offset="100%" stopColor="#87adb4"/>
            </linearGradient>
            <pattern id="printed-hatch" width="104" height="104" patternUnits="userSpaceOnUse"
              patternTransform="rotate(34)">
              <rect width="104" height="104" fill="#c98f78" opacity="0.18"/>
              <line x1="0" y1="0" x2="0" y2="104" stroke="#9c4a34" strokeWidth="11" opacity="0.57"/>
            </pattern>
            <pattern id="printed-paper" width="120" height="120" patternUnits="userSpaceOnUse">
              <circle cx="17" cy="23" r="0.9" fill="#8d7859" opacity="0.14"/>
              <circle cx="79" cy="87" r="0.7" fill="#8d7859" opacity="0.12"/>
              <path d="M0,61 H120" stroke="#a69272" strokeWidth="0.45" opacity="0.09"/>
            </pattern>
            <clipPath id="printed-paper-clip">
              <rect {...toRect(background.paper)}/>
            </clipPath>
            {background.regions.map((region) => (
              <clipPath key={region.id} id={`printed-clip-${region.id}`}>
                <rect {...toRect(region.box)}/>
              </clipPath>
            ))}
            <clipPath id="printed-land">
              <path d={background.regions.find((region) => region.id === "main")?.d ?? ""}/>
            </clipPath>
            <mask id="printed-water" maskUnits="userSpaceOnUse"
              x={PAPER.x} y={PAPER.y} width={PAPER.width} height={PAPER.height}>
              <rect {...toRect(background.paper)} fill="white"/>
              {background.regions.map((region) => <path key={region.id} d={region.d} fill="black"/>)}
            </mask>
          </defs>

          <g clipPath="url(#printed-paper-clip)">
            <rect {...toRect(background.paper)} fill={PAPER_FILL}/>
            <rect {...toRect(background.paper)} fill="url(#printed-paper)"/>

            {/* Terrain: sea, land and the two inset panels, each in its own
                printed box so a wash cannot bleed into the ocean. */}
            {background.regions.map((region) => (
              <g key={region.id} clipPath={`url(#printed-clip-${region.id})`}>
                <rect {...toRect(region.box)} fill="url(#printed-sea)"/>
                <path d={region.d} fill="#ebdfc6" fillRule="evenodd"/>
                <path d={region.d} fill="none" stroke="#9f8e73" strokeWidth={4} fillRule="evenodd"/>
                <rect x={region.box[0] + 4} y={region.box[1] + 4} width={region.box[2] - region.box[0] - 8}
                  height={region.box[3] - region.box[1] - 8} fill="none" stroke="#6f5d43" strokeWidth={3}/>
              </g>
            ))}

            <Grid/>
            <g clipPath="url(#printed-land)">
              <g fill="url(#printed-hatch)" opacity={0.9}>
                {flashpoints.map((point) => <path key={point.id} d={point.d}/>)}
              </g>
            </g>
            <FlashpointLabels/>

            {CONTINENT_LABELS.map((label) => (
              <text key={label.text} x={label.x} y={label.y} textAnchor="middle" fontFamily={BOARD_FONT}
                fontSize={label.size} fontStyle="italic" fill="#a5926f" opacity={0.64}
                letterSpacing={18} transform={`rotate(${label.rotate} ${label.x} ${label.y})`}>{label.text}</text>
            ))}
            {SEA_LABELS.map((label) => (
              <text key={label.text} x={label.x} y={label.y} textAnchor="middle" fontFamily={BOARD_FONT}
                fontSize={label.size} fontStyle="italic" fill="#4f7d80" opacity={0.55} letterSpacing={5}
                transform={`rotate(${label.rotate} ${label.x} ${label.y})`}>{label.text}</text>
            ))}

            {/* Frontiers: the printed military network, with sea routes masked
                to water exactly as the board prints them. */}
            <g mask="url(#printed-water)" opacity={0.72}>
              {CONNECTIONS.filter((connection) => connection.type === "sea").map((connection) => {
                const a = SPACES[connection.a];
                const b = SPACES[connection.b];
                if (!a || !b || a.type === "navalBox" || b.type === "navalBox") return null;
                const line = trimSegment(a, b, markerRadius(a) + 8, markerRadius(b) + 8);
                if (!line) return null;
                return <line key={`sea-${connection.a}-${connection.b}`} x1={line.x1} y1={line.y1}
                  x2={line.x2} y2={line.y2} stroke={CONNECTION_STYLE.sea.stroke} strokeWidth={6} opacity={0.8}/>;
              })}
            </g>
            {CONNECTIONS.map((connection: ConnectionDef) => {
              const a = SPACES[connection.a];
              const b = SPACES[connection.b];
              if (!a || !b) return null;
              if (connection.type === "sea") return null;
              const style = CONNECTION_STYLE[connection.type];
              const gapA = a.type === "navalBox" ? 300 : markerRadius(a) + 9;
              const gapB = b.type === "navalBox" ? 300 : markerRadius(b) + 9;
              const line = trimSegment(a, b, gapA, gapB);
              if (!line) return null;
              return <line key={`${connection.a}-${connection.b}`} x1={line.x1} y1={line.y1}
                x2={line.x2} y2={line.y2} stroke={style.stroke} strokeWidth={style.width}
                strokeDasharray={style.dash ? `${style.dash[0]} ${style.dash[1]}` : undefined}
                strokeLinecap="round" opacity={0.94}/>;
            })}

            {navalBoxes.map((id) => <NavalBox key={id} id={id}/>)}

            {/* Charts and printed tracks, in their physical places on the sheet. */}
            <BuildBox/>
            <TurnTracks/>
            <Flashpoints/>
            <VpTrack/>
            <AllianceTrack/>
            <WartimeInitiative/>
            <TitleCartouche/>

            <EventBox x={1880} y={2880} lines={["Italy", "Unified?"]} number={1}/>
            <EventBox x={2390} y={3850} lines={["Berlin", "Conference", "Played?"]} number={2}/>
            <EventBox x={4380} y={3560} lines={["Suez", "Canal?"]}/>

            <g fontFamily={BOARD_FONT} fill="#5b4a34">
              <text x={3900} y={3532} fontSize={22} letterSpacing={3}>OTTOMAN HOME SPACES</text>
              <text x={1680} y={3820} fontSize={24} letterSpacing={2}>AFRICA</text>
              <text x={1680} y={3852} fontSize={16}>2 ARMY STACKING LIMIT</text>
              <text x={6230} y={4180} fontSize={24} letterSpacing={2}>ASIA</text>
              <text x={6230} y={4212} fontSize={16}>2 ARMY STACKING LIMIT</text>
              <text x={4585} y={3810} fontSize={20} letterSpacing={2}>Suez Canal</text>
              <text x={4650} y={3840} fontSize={15} fill="#7a6a52">the gateway to the East</text>
            </g>

            <g transform="translate(3300 3210)">
              <circle r={38} fill="#3f5b3f" stroke="#f7f0de" strokeWidth={3}/>
              <text y={-2} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={15} fill="#f7f0de">Rule:</text>
              <text y={17} textAnchor="middle" fontFamily={BOARD_FONT} fontSize={16} fill="#f7f0de">3.4.1</text>
            </g>

            {markers.map((space) => <SpaceMarker key={space.id} space={space}/>)}

            <rect {...toRect(background.paper)} fill="none" stroke={PAPER_EDGE} strokeWidth={10}/>
            <rect x={PAPER.x + 20} y={PAPER.y + 20} width={PAPER.width - 40} height={PAPER.height - 40}
              fill="none" stroke="#cbb894" strokeWidth={3}/>
          </g>
        </svg>
      </div>
    </section>
  );
};

export default PrintedBoard;
