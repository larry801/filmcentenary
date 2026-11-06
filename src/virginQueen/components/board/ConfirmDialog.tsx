import React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

export interface ConfirmDialogProps {
    open: boolean;
    /** Title of the confirmation, e.g. "End this impulse?". */
    title: string;
    /** Optional one-line explanation shown under the title. */
    message?: string;
    /** Label of the button that performs the action. */
    confirmLabel: string;
    /** Label of the button that dismisses the dialog. */
    cancelLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * Small textual confirmation used before ending a turn.  The board renders it
 * as a portal at the root so it is never clipped by a scrolling panel.
 */
export const ConfirmDialog = ({
    open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel,
}: ConfirmDialogProps) => (
    <Dialog open={open} onClose={onCancel} aria-labelledby="vq-confirm-title"
            slotProps={{paper: {sx: {minWidth: 280, maxWidth: 380}}}}>
        <DialogTitle id="vq-confirm-title">{title}</DialogTitle>
        {message !== undefined && <DialogContent>
            <DialogContentText>{message}</DialogContentText>
        </DialogContent>}
        <DialogActions>
            <Button onClick={onCancel}>{cancelLabel}</Button>
            <Button variant="contained" onClick={onConfirm} autoFocus>{confirmLabel}</Button>
        </DialogActions>
    </Dialog>
);
