/**
 * The board's polite rejection notice.
 *
 * boardgame.io answers a refused move with a bare `INVALID_MOVE`, so the screen
 * would otherwise just not change: the click silently did nothing. The board
 * wraps its own moves and, when one is refused, raises this notice with the
 * action it tried and the best reason the UI already computed for that control.
 *
 * `role="status"` + `aria-live="polite"`: it is announced without stealing
 * focus, and it never blocks a click, so a wrong guess costs nothing but a
 * sentence. It dismisses itself so it cannot pile up.
 */
import React from "react";
import {bi} from "./boardHelpers";

export interface ToastProps {
  toast: {title: string; body?: string; tone: "info" | "warn" | "error"} | null;
  locale: "en" | "zh_CN";
  onDismiss: () => void;
  /** How long a notice stays up before it removes itself. */
  timeoutMs?: number;
}

const TONE_GLYPH: Record<"info" | "warn" | "error", string> = {info: "i", warn: "!", error: "×"};

export const Toast = ({toast, locale, onDismiss, timeoutMs = 4500}: ToastProps) => {
  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
    if (toast === null || hovered) return;
    const timer = setTimeout(onDismiss, timeoutMs);
    return () => clearTimeout(timer);
  }, [toast, hovered, onDismiss, timeoutMs]);

  React.useEffect(() => {
    if (toast === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toast, onDismiss]);

  if (toast === null) return null;
  return (
    <div
      className={`ie-toast ie-toast-${toast.tone}`}
      data-testid="ie-toast"
      data-tone={toast.tone}
      role="status"
      aria-live="polite"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="ie-toast-glyph" aria-hidden="true">{TONE_GLYPH[toast.tone]}</span>
      <div className="ie-toast-text">
        <div className="ie-toast-title">{toast.title}</div>
        {toast.body !== undefined && toast.body !== "" && <div className="ie-toast-body">{toast.body}</div>}
      </div>
      <button
        type="button"
        className="ie-toast-close"
        data-testid="ie-toast-close"
        aria-label={bi(locale, "Dismiss the notice", "关闭提示")}
        title={bi(locale, "Dismiss (Esc)", "关闭（Esc）")}
        onClick={onDismiss}
      >
        ✕
      </button>
    </div>
  );
};
