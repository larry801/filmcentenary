/**
 * The nine published reference charts, transcribed as bilingual text.
 *
 * `CHARTS` in `ChartLightbox.tsx` is the catalogue of the printed PNGs; this
 * module is the same nine ids with their panels as markup.  A chart with no
 * transcription is a bug, not a fallback: the lightbox's text view asks
 * `chartTextById` and the test suite asserts that all nine resolve.
 */
import {COLONIAL_GREAT_WARS} from "./colonialGreatWars";
import {COMBAT_CRT} from "./combatCrt";
import {COUNTER_COUNT} from "./counterCount";
import {CRISIS} from "./crisis";
import {INFLUENCE_TRACK} from "./influenceTrack";
import {ITALY_LEGEND} from "./italyLegend";
import {MAP_FLASHPOINTS} from "./mapFlashpoints";
import {SEQUENCE_OF_PLAY} from "./sequenceOfPlay";
import {WAR_AIMS_MINORS} from "./warAimsMinors";
import type {ChartText} from "./types";

export type {Bi, ChartBlock, ChartSection, ChartText} from "./types";

/** The nine transcriptions, in the published chart order. */
export const CHART_TEXTS: readonly ChartText[] = [
  MAP_FLASHPOINTS,
  COMBAT_CRT,
  COLONIAL_GREAT_WARS,
  WAR_AIMS_MINORS,
  CRISIS,
  INFLUENCE_TRACK,
  ITALY_LEGEND,
  SEQUENCE_OF_PLAY,
  COUNTER_COUNT,
];

const BY_ID = new Map(CHART_TEXTS.map((chart) => [chart.id, chart]));

/** The transcription of one chart, or `undefined` when it has none. */
export const chartTextById = (id: string): ChartText | undefined => BY_ID.get(id);
