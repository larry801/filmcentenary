/**
 * One reference chart as markup — the text view of a printed PNG.
 *
 * The charts are published art, so a zh_CN board used to show English sheets
 * and nothing else.  The transcription lives in `referenceCharts/`; this
 * component renders it with the board's own type scale, keeps the printed
 * rule numbers, and leaves the PNG one button away in the lightbox.
 *
 * It is pure markup over frozen data (no state, no effects), so a static render
 * is enough to verify both languages.
 */
import React from "react";
import type {Bi, ChartBlock, ChartText} from "./referenceCharts";
import {bi} from "./boardHelpers";

export type ChartLocale = "en" | "zh_CN";

const say = (locale: ChartLocale, value: Bi): string =>
  keepMarker(bi(locale, value.en, value.zh));

/**
 * Keep a printed marker (`*`, `†`) with the word it annotates.
 *
 * CJK line breaking may break between a Han character and a following ASCII
 * marker, which left `国际会议*` printing as `国际会议` and a lone `*` on the
 * next line.  A zero-width word joiner (U+2060) between the two forbids that
 * break without changing the text a reader copies or searches for.
 */
const keepMarker = (text: string): string => text.replace(/([\u3400-\u9fff])([*†]+)/g, "$1\u2060$2");

const Block = ({block, locale}: {block: ChartBlock; locale: ChartLocale}) => {
  switch (block.kind) {
    case "prose":
      return <p className="ie-chart-text-line">{say(locale, block.text)}</p>;
    case "sub":
      return <h5 className="ie-chart-text-sub">{say(locale, block.text)}</h5>;
    case "bullets":
      return (
        <ul className="ie-chart-text-bullets">
          {block.items.map((item, index) => (
            // The list is frozen data with no ids; the printed order is stable.
            <li key={index}>{say(locale, item)}</li>
          ))}
        </ul>
      );
    case "sublist":
      return (
        <ul className="ie-chart-text-bullets ie-chart-text-sublist">
          {block.items.map((item, index) => (
            <li key={index}>{say(locale, item)}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <>
          <table className="ie-chart-text-table">
            <thead>
              <tr>
                {block.columns.map((column, index) => (
                  <th scope="col" key={index}>{say(locale, column)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{say(locale, cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {block.note !== undefined && <p className="ie-chart-text-note">{say(locale, block.note)}</p>}
        </>
      );
    default:
      return null;
  }
};

export interface ChartTextViewProps {
  chart: ChartText;
  locale: ChartLocale;
}

export const ChartTextView = ({chart, locale}: ChartTextViewProps) => (
  <div className="ie-chart-text" data-testid="ie-chart-text" data-chart-text={chart.id} lang={locale}>
    {chart.sections.map((section, index) => (
      <section className="ie-chart-text-section" data-testid={`ie-chart-text-${chart.id}-${index}`} key={index}>
        <h4 className="ie-chart-text-title">
          {say(locale, section.title)}
          {section.rule !== undefined && <span className="ie-chart-text-rule"> [{section.rule}]</span>}
        </h4>
        {section.blocks.map((block, blockIndex) => (
          <Block block={block} locale={locale} key={blockIndex}/>
        ))}
      </section>
    ))}
  </div>
);
