/**
 * The text of the nine printed reference charts, in both UI languages.
 *
 * The published charts are PNG art (see `docs/imperial-elegy/ASSETS.md`), so a
 * zh_CN reader used to have no way to read them: the drawer and the lightbox
 * could only show the printed English sheets.  Each chart is transcribed here
 * as structured, bilingual data — one section per printed panel, in printed
 * order — and `ChartText` renders it as markup.  The art stays authoritative:
 * this is a transcription, not a replacement for the printed chart, and the
 * lightbox keeps the PNG one click away.
 *
 * The shape is deliberately small: prose, bullets, a table, a sub-heading and
 * a footnote.  That covers every panel on the nine sheets without turning the
 * module into a layout language.
 */

/** One bilingual string; neither language is a fallback for the other. */
export interface Bi {
  en: string;
  zh: string;
}

export type ChartBlock =
  | {kind: "prose"; text: Bi}
  | {kind: "bullets"; items: Bi[]}
  /** The indented sub-bullets the printed sheets set under a parent bullet. */
  | {kind: "sublist"; items: Bi[]}
  | {kind: "table"; columns: Bi[]; rows: Bi[][]; note?: Bi}
  | {kind: "sub"; text: Bi};

export interface ChartSection {
  /** Printed panel title. */
  title: Bi;
  /** Printed rule number(s), when the panel names one (`[18.2]`, `[25.6]`). */
  rule?: string;
  blocks: ChartBlock[];
}

export interface ChartText {
  /** The chart id from `ChartLightbox.tsx`'s `CHARTS`. */
  id: string;
  /** The chart's own bilingual title (the catalogue has the same pair). */
  title: Bi;
  sections: ChartSection[];
}

/* ------------------------------------------------------------------ builders */

/** A bilingual pair. */
export const t = (en: string, zh: string): Bi => ({en, zh});

/** A cell that prints the same in both languages: numbers, `GE`, `+1 CP`, … */
export const same = (text: string): Bi => ({en: text, zh: text});

export const prose = (en: string, zh: string): ChartBlock => ({kind: "prose", text: t(en, zh)});

export const bullets = (...items: Bi[]): ChartBlock => ({kind: "bullets", items});

/** Indented sub-bullets: the printed sheets nest the action list this way. */
export const sublist = (...items: Bi[]): ChartBlock => ({kind: "sublist", items});

export const table = (columns: Bi[], rows: Bi[][], note?: Bi): ChartBlock => ({
  kind: "table",
  columns,
  rows,
  ...(note === undefined ? {} : {note}),
});

export const sub = (en: string, zh: string): ChartBlock => ({kind: "sub", text: t(en, zh)});
