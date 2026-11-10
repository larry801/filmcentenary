import React from "react";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import i18n from "../../../constant/i18n";

export interface DiceToastProps {
    /** Raw roll summary from the game state, e.g. "3, 5, 5". */
    rolls?: string;
    /** How long the toast stays up, in milliseconds. */
    duration?: number;
}

const face = (value: string, index: number): React.ReactNode => {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return trimmed;
    // Index in the key: a roll may show the same face several times (e.g.
    // "3, 3, 5"), and keying by the face alone makes React warn about
    // duplicate children.
    return <span key={`${index}-${trimmed}`} className="vq-die" aria-hidden="true">{trimmed}</span>;
};

/** The individual die faces from a `G.lastRolls` summary. */
export const DiceFaces = ({rolls}: {rolls: string}) => {
    const values = rolls.split(/[,\s]+/).filter((value) => value !== "");
    return <span className="vq-dice-row" aria-label={rolls}>{values.map(face)}</span>;
};

/**
 * Transient dice read-out.  `G.lastRolls` is a plain summary string; this turns
 * it into a short toast with individual die faces so the result of a roll is
 * noticeable even when the log is scrolled away.
 */
export const DiceToast = ({rolls, duration = 5000}: DiceToastProps) => {
    i18n.use();
    const [seen, setSeen] = React.useState<string | undefined>(undefined);
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        if (rolls === undefined || rolls === "" || rolls === seen) return undefined;
        setSeen(rolls);
        setOpen(true);
        const timer = setTimeout(() => setOpen(false), duration);
        return () => clearTimeout(timer);
    }, [rolls, seen, duration]);

    if (rolls === undefined || rolls === "") return null;
    return <Snackbar open={open} onClose={() => setOpen(false)} autoHideDuration={duration}
                     anchorOrigin={{vertical: "bottom", horizontal: "center"}}>
        <Alert severity="info" variant="filled" onClose={() => setOpen(false)}
               sx={{alignItems: "center", gap: 1}} icon={false}>
            <span className="vq-dice-label">{i18n.chain.vq.log.recentRolls}</span>
            <DiceFaces rolls={rolls}/>
        </Alert>
    </Snackbar>;
};
