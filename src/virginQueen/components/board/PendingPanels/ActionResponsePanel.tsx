import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import i18n from "../../../../constant/i18n";
import {powerName, Power} from "../../../constant/general";
import {PendingPanelProps} from "./types";

export interface ActionResponseChoice {
    responder: Power;
    label: string;
    options: {id: string; label: string}[];
}

export interface PendingActionResponsePanelProps extends PendingPanelProps {
    responders: Power[];
    /** Chooser rows for every power the local player controls. */
    choices: ActionResponseChoice[];
    responder?: Power;
    onSelectResponder: (power: Power) => void;
}

/** #2/#7-style reaction window opened after an impulse. */
export const PendingActionResponsePanel = ({
    G, moves, responders, choices, responder, onSelectResponder,
}: PendingActionResponsePanelProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    if (G.pendingAction === undefined) return null;
    const choice = choices.find((entry) => entry.responder === responder);
    return <Stack spacing={1}>
        <Typography>{G.pendingAction.move === "impulse" ? i18n.chain.vq.actionResponse.impulse : i18n.chain.vq.actionResponse.response} · {i18n.chain.vq.actionResponse.waiting} {responders.map((power) => powerName(power, vqLocale)).join(i18n.chain.vq.punct.list)}{i18n.chain.vq.punct.period}</Typography>
        {choices.length > 1 && <>
            <Typography variant="body2">{i18n.chain.vq.actionResponse.multi}</Typography>
            <FormControl size="small" fullWidth>
                <InputLabel id="vq-action-responder">{i18n.chain.vq.actionResponse.responder}</InputLabel>
                <Select labelId="vq-action-responder" label={i18n.chain.vq.actionResponse.responder} value={responder}
                        onChange={(event) => onSelectResponder(event.target.value as Power)}>
                    {choices.map((entry) =>
                        <MenuItem key={entry.responder} value={entry.responder}>{entry.label}</MenuItem>)}
                </Select>
            </FormControl>
        </>}
        {choice?.options.map((entry) =>
            <Button key={entry.id} onClick={() => moves.respondAction({choice: entry.id, responder: choice.responder})}>{entry.label}</Button>)}
    </Stack>;
};
