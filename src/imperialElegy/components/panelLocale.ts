/**
 * Test-only seam: a live view of the locale a suite selected through its
 * stubbed i18n module.
 *
 * Several static-markup suites replace `../../constant/i18n` so that
 * `getLocaleName()` returns `mockLocale`.  This module lives outside every
 * `jest.mock` scope, so the suites can publish that value here and the board
 * can read it without the i18n module — the production default (`null`) keeps
 * the real locale in charge.
 */
import type {IELocale} from "./i18n";

let current: IELocale | null = null;

/** The locale a suite selected, or null in production. */
export const panelLocale = (): IELocale | null => current;

/** Publish the suite's locale (tests only). */
export const setPanelLocale = (locale: IELocale | null): void => {
  current = locale;
};

/** A live view shaped like `InjectedUi.locale`. */
export const panelLocaleView = {get current(): IELocale | null {
  return current;
}};

/**
 * The sentence tables, read straight from `i18n.ts`.  Exported from this
 * module (outside every `jest.mock` scope) so a suite that stubs the i18n
 * module's locale object still gets real strings.
 */
const readReal = (path: string): {ieStringsFor: (locale: "en" | "zh_CN") => import("./i18n").IEStrings} => {
  const jestGlobal = (globalThis as {jest?: {requireActual?: (module: string) => unknown}}).jest;
  if (jestGlobal?.requireActual !== undefined) return jestGlobal.requireActual(path) as never;
  // Outside Jest (the production bundle) the module is simply required by the
  // test-only caller; nothing here is reached at run time.
  return (require as unknown as (module: string) => unknown)(path) as never;
};

export const ieStringsOf = (locale: "en" | "zh_CN") => readReal("./i18n").ieStringsFor(locale);
