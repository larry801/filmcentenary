import React from "react";
import i18n from "../../../../constant/i18n";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import {POWER_NAMES, powerName, Power} from "../../../../constant/general";

export const PendingActionPanel = (props: any) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const {G, moves, myActionChoices, actionResponder, actionResponders, selectedActionResponder, setSelectedActionResponder} = props;
    const choice = myActionChoices.find((entry: any) => entry.responder === actionResponder);
    
    return (
        <Stack spacing={1}>
            <Typography>{G.pendingAction.move === "impulse" ? i18n.chain.vq.actionResponse.impulse : i18n.chain.vq.actionResponse.response} · {i18n.chain.vq.actionResponse.waiting} {actionResponders.map((power: string) => powerName(power as Power, vqLocale)).join("、")}。</Typography>
            {myActionChoices.length > 1 && <>
                <Typography variant="body2">{i18n.chain.vq.actionResponse.multi}</Typography>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-action-responder">{i18n.chain.vq.actionResponse.responder}</InputLabel>
                    <Select labelId="vq-action-responder" label={i18n.chain.vq.actionResponse.responder} value={actionResponder}
                            onChange={(event) => setSelectedActionResponder(event.target.value)}>
                        {myActionChoices.map((entry: any) =>
                            <MenuItem key={entry.responder} value={entry.responder}>{entry.label}</MenuItem>
                        )}
                    </Select>
                </FormControl>
            </>}
            {choice?.options.map((entry: any) =>
                <Button key={entry.id} onClick={() => moves.respondAction({choice: entry.id, responder: choice.responder})}>{entry.label}</Button>
            )}
        </Stack>
    );
};
