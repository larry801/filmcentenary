import React from "react";

/**
 * Whether the pointer is a finger (or a pen) rather than a mouse.
 *
 * The map pans by drag and zooms by pinch on a touch screen and by wheel on a
 * mouse, so the one-line help under the map has to name the gesture the reader
 * actually has.  CSS cannot change text, hence this hook.
 *
 * SSR and the node test environment have no `window`; there the answer is
 * `false` (the desktop wording), matching `useIsPhone`.
 */
const COARSE_QUERY = "(pointer: coarse)";

export const useCoarsePointer = (): boolean => {
  const read = (): boolean =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(COARSE_QUERY).matches
      : false;
  const [coarse, setCoarse] = React.useState(read);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(COARSE_QUERY);
    const onChange = (event: MediaQueryListEvent) => setCoarse(event.matches);
    setCoarse(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return coarse;
};

/** The map's one-line help, in the gesture the reader has. */
export const mapHelp = (locale: "en" | "zh_CN", coarse: boolean): string => {
  if (locale === "zh_CN") return coarse ? "拖动平移 · 双指缩放 · 点击空间" : "滚轮缩放 · 拖动平移 · 点击空间";
  return coarse ? "drag to pan · pinch to zoom · click a space" : "wheel to zoom · drag to pan · click a space";
};
