import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import {POWER_NAMES, POWERS} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";

export const PendingGregorianPanel = (props: any) => {
    const {G, moves, playerID, gregorianTarget, setGregorianTarget} = props;
    return (
        <Stack spacing={1}>
            <Typography>公历纪年法 · {POWER_NAMES[G.gregorianResponse.after].zh} 的回合已结束，等待 {POWER_NAMES[G.gregorianResponse.responder].zh} 决定是否响应。</Typography>
            {ownerOf(G, G.gregorianResponse.responder) === playerID && <>
                <Typography variant="body2">选择一个势力开始下一个行动轮（可以是刚结束回合的势力），并从牌堆抽一张牌（若与教廷结盟）。</Typography>
                <Select size="small" value={gregorianTarget} onChange={(e) => setGregorianTarget(e.target.value)}>
                    {POWERS.map((power) => <MenuItem key={power} value={power}>{POWER_NAMES[power].zh}</MenuItem>)}
                </Select>
                <Stack direction="row" spacing={0.5}>
                    <Button variant="contained" onClick={() => moves.playCard({cardId: "vq-101", asEvent: true, target: gregorianTarget})}>
                        打出公历纪年法
                    </Button>
                    <Button variant="outlined" onClick={() => moves.declineGregorianCalendar()}>不打出</Button>
                </Stack>
            </>}
        </Stack>
    );
};
