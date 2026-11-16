/**
 * The reference drawer: a right-hand panel plus a full-screen chart lightbox.
 *
 * It replaced the Reference tab and the always-open chart grid: the drawer is
 * opened on purpose (the track strip's "?", the mat's printed display, a step
 * in the stepper) at an anchor, and then shows the inline tables first — the
 * CRT computed from `crt()`, the action costs from `ACTION_COSTS`, the
 * sequence of play from `phaseSteps` — and the printed PNG charts after them.
 *
 * Other powers' dashboards live here too: the mat shows the viewer only, so
 * the drawer is where a table reads everybody else at once.
 */
import React from "react";
import {ieT} from "./i18n";
import {bi} from "./boardHelpers";
import {ChartLightbox, chartById, type ChartEntry} from "./ChartLightbox";
import {ReferenceTables} from "./referenceTables";
import type {CoreSlice, ReferenceSlice} from "./boardSlices";

export interface ReferenceDrawerProps {
  core: CoreSlice;
  reference: ReferenceSlice;
  /** Drawer open state, owned by the board so any control can open it. */
  open?: boolean;
  anchor?: string | null;
  onOpen?: (anchor: string) => void;
  onClose?: () => void;
}

/**
 * Anchors inside the drawer:
 *   chart:<id>   the printed chart id (`combat-crt`, …)
 *   rules:<key>  an inline section (`prep`, `maneuver`, `victory`, `crt`, `costs`, …)
 */
export const resolveAnchor = (anchor: string | null | undefined): {chart: ChartEntry | null; section: string | null} => {
  if (!anchor) return {chart: null, section: null};
  if (anchor.startsWith("chart:")) {
    const id = anchor.slice("chart:".length);
    return {chart: chartById(id) ?? null, section: null};
  }
  if (anchor.startsWith("rules:")) return {chart: null, section: anchor.slice("rules:".length)};
  // A bare id is a chart id, for convenience.
  return {chart: chartById(anchor) ?? null, section: null};
};

export const ReferenceDrawer = ({core, reference, open: openProp, anchor = null, onOpen, onClose}: ReferenceDrawerProps) => {
  const t: ReturnType<typeof ieT> = core.t;
  const locale = core.locale;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = openProp ?? internalOpen;
  const resolved = resolveAnchor(anchor);
  const [lightbox, setLightbox] = React.useState<ChartEntry | null>(null);

  // Opening the drawer at a chart means opening that chart, not just
  // scrolling to it: the PNGs are unreadable at drawer width.
  React.useEffect(() => {
    if (open && resolved.chart) setLightbox(resolved.chart);
  }, [open, resolved.chart]);

  // Esc anywhere in the page closes the drawer once its lightbox is shut.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || lightbox !== null) return;
      event.preventDefault();
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // `close` is re-created each render; the guard on `lightbox` is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lightbox]);

  const setOpen = (next: boolean) => {
    if (next && onOpen) onOpen(anchor ?? "chart:sequence-of-play");
    else if (!next && onClose) onClose();
    else setInternalOpen(next);
  };

  const close = () => {
    setLightbox(null);
    setOpen(false);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          className="ie-ref-open"
          data-testid="ie-open-reference"
          aria-expanded="false"
          onClick={() => setOpen(true)}
          title={bi(locale, "Reference (?): rules, CRT and charts", "参考（?）：规则、战斗表与图表")}
        >
          <span aria-hidden="true">?</span> {bi(locale, "Reference", "参考")}
        </button>
      )}
      <aside
        className="ie-ref-drawer"
        data-testid="ie-reference-drawer"
        data-open={open ? "true" : "false"}
        aria-label={bi(locale, "Reference", "参考")}
        hidden={!open}
      >
        <header className="ie-ref-head">
          <h2>{bi(locale, "Reference", "参考")}</h2>
          <button
            type="button"
            className="ie-btn secondary"
            data-testid="ie-reference-close"
            onClick={close}
            aria-label={bi(locale, "Close the reference", "关闭参考")}
            title={bi(locale, "Close (Esc)", "关闭（Esc）")}
          >
            ✕
          </button>
        </header>
        <div className="ie-ref-body">
          {/* The drawer's stale copy of the slice lost `locale` (the `locale` key
              is resolved late in the hook), so the board's own values are
              passed explicitly and the slice fills the rest. */}
          <ReferenceTables
            {...reference}
            locale={core.actualLocale}
            t={core.t}
            anchor={resolved.section}
            onOpenChart={(entry) => setLightbox(entry)}
          />
        </div>
      </aside>
      {lightbox !== null && (
        <ChartLightbox chart={lightbox} locale={locale} onClose={() => setLightbox(null)}/>
      )}
    </>
  );
};
