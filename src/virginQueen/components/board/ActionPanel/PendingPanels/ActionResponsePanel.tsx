import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import {POWER_NAMES} from "../../../../constant/general";

export const PendingActionPanel = (props: any) => {
    const {G, moves, myActionChoices, actionResponder, actionResponders, selectedActionResponder, setSelectedActionResponder} = props;
    const choice = myActionChoices.find((entry: any) => entry.responder === actionResponder);
    
    return (
        <Stack spacing={1}>
            <Typography>{G.pendingAction.move === "impulse" ? "行动轮开始响应" : "行动响应"} · 等待 {actionResponders.map((power: string) => POWER_NAMES[power as keyof typeof POWER_NAMES].zh).join("、")}。</Typography>
            {myActionChoices.length > 1 && <>
                <Typography variant="body2">你控制多个可响应势力，请选择由哪个势力进行响应。</Typography>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-action-responder">行动响应势力</InputLabel>
                    <Select labelId="vq-action-responder" label="行动响应势力" value={actionResponder}
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
