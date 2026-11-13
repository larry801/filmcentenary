import React from "react";
import Button from "@mui/material/Button";
import i18n from "../../../constant/i18n";

export interface StepBannerProps {
    /** Completed and pending step labels, in order, e.g. ["Origin", "Units", "Target"]. */
    steps: string[];
    /** Index of the step currently waiting for input. */
    active: number;
    /** Optional extra hint for the current step. */
    hint?: string;
    /** Called when the player cancels the multi-step action. */
    onCancel?: () => void;
}

/**
 * Dock below the map while a multi-step action is in progress, for
 * example "Choose origin → Choose units → Choose target [Cancel]".  Escape is
 * handled by the board itself so the same shortcut works anywhere.
 */
export const StepBanner = ({steps, active, hint, onCancel}: StepBannerProps) => {
    i18n.use();
    if (steps.length === 0) return null;
    return <div className="vq-step-banner" role="status">
        <ol className="vq-step-list">
            {steps.map((label, index) => <li key={`${index}-${label}`}
                className={index === active ? "vq-step-active" : index < active ? "vq-step-done" : undefined}
                aria-current={index === active ? "step" : undefined}>
                <span className="vq-step-index">{index + 1}</span>{label}
            </li>)}
        </ol>
        {hint !== undefined && hint !== "" && <span className="vq-step-hint">{hint}</span>}
        {onCancel !== undefined && <Button size="small" variant="text" onClick={onCancel}>
            {i18n.chain.vq.step.cancel}
        </Button>}
    </div>;
};
