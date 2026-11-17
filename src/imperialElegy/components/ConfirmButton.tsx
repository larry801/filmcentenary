/**
 * A two-step, arm-then-confirm button.
 *
 * There is no engine undo in Imperial Elegy (hands are hidden, dice are rolled
 * and the client runs with `disableUndo`), so an irreversible control must not
 * fire on a single stray click.  The first click arms the button and swaps its
 * label; the second click within the arm window fires it.  Arming ends on blur,
 * on Escape, or after `ARM_MS` with nothing happening — the button never stays
 * loaded in secret.
 *
 * Firing after a pointer click releases focus, matching an ordinary button, but
 * a keyboard activation (Enter/Space) keeps focus: blurring here would drop the
 * keyboard user onto `<body>`, which inside a dialog ejects them from it.
 *
 * It is deliberately **not** a modal: it stays inline in whatever bar renders
 *it, so the static-markup suites and assistive technology keep reading the
 * same element.  When `confirm` is false (the preference is off, or the action
 * is harmless) it behaves as a plain button.
 */
import React from "react";

export const ARM_MS = 5000;

export interface ConfirmButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children"> {
  /** The plain label ("Play for 3 CP"). */
  children: React.ReactNode;
  /** The armed label; defaults to `Confirm: <label>`. */
  confirmLabel?: React.ReactNode;
  /** Whether confirmation is wanted (the `confirmActions` preference). */
  confirm: boolean;
  /** The irreversible action, run on the second click. */
  onConfirm: () => void;
  /** Accessible name for the armed state, when the label is an icon. */
  confirmAriaLabel?: string;
}

const TEXT_NODE = (node: React.ReactNode): React.ReactNode => (typeof node === "string" ? node : null);

/**
 * Release focus after a mouse/touch activation only.  `detail` is 0 for a
 * keyboard-generated click (Enter/Space), so a keyboard user keeps focus on
 * the control — or, if it unmounts, on whatever the app moves it to — instead
 * of being dumped on `<body>`.
 */
const releasePointerFocus = (event: React.MouseEvent<HTMLButtonElement>): void => {
  if (event.detail > 0) event.currentTarget.blur();
};

export const ConfirmButton = ({
  children, confirmLabel, confirm, onConfirm, confirmAriaLabel, onBlur, onKeyDown, ...rest
}: ConfirmButtonProps) => {
  const [armed, setArmed] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const disarm = React.useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setArmed(false);
  }, []);

  React.useEffect(() => disarm, [disarm]);

  // The preference can be switched off mid-arm; the button must not stay hot.
  React.useEffect(() => {
    if (!confirm) disarm();
  }, [confirm, disarm]);

  const label = React.useMemo<React.ReactNode>(() => {
    if (!armed) return children;
    if (confirmLabel !== undefined) return confirmLabel;
    const text = TEXT_NODE(children);
    return text === null ? children : `Confirm: ${text}`;
  }, [armed, children, confirmLabel]);

  return (
    <button
      {...rest}
      type={rest.type ?? "button"}
      data-armed={armed ? "true" : "false"}
      aria-live={armed ? "polite" : undefined}
      aria-label={armed && confirmAriaLabel !== undefined ? confirmAriaLabel : rest["aria-label"]}
      onBlur={(event) => {
        disarm();
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" || event.key === "Esc") {
          if (armed) {
            event.preventDefault();
            event.stopPropagation();
            disarm();
            return;
          }
        }
        onKeyDown?.(event);
      }}
      onClick={(event) => {
        // A disabled control never fires, but a data-only button (a test
        // double) may still dispatch; the guard keeps the contract.
        if (event.currentTarget.disabled) return;
        if (!confirm) {
          onConfirm();
          releasePointerFocus(event);
          return;
        }
        if (!armed) {
          setArmed(true);
          if (timer.current !== null) clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            timer.current = null;
            setArmed(false);
          }, ARM_MS);
          return;
        }
        disarm();
        onConfirm();
        releasePointerFocus(event);
      }}
    >
      {label}
    </button>
  );
};
