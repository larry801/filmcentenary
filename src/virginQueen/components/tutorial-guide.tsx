import React from "react";
import i18n from "../../constant/i18n";
import {BoardProps} from "boardgame.io/react";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {POWER_NAMES, VQGame, powerName, Power} from "../constant/general";
import {ownerOf} from "../ownership";
import {tutorialLesson} from "../tutorial";

export const TutorialGuide = ({G, ctx, playerID}: Pick<BoardProps<VQGame>, "G" | "ctx" | "playerID">) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const e = i18n.chain.vq.tutorial;
    const [expanded, setExpanded] = React.useState(false);
    const contentID = React.useId();
    if (G.scenario !== "tutorial") return null;
    const lesson = tutorialLesson(G, ctx.phase ?? "");
    const owner = lesson && ownerOf(G, lesson.power);
    const finished = ctx.gameover !== undefined;
    const steps = [e.step1, e.step2, e.step3];
    const step = ["cardDraw", "spring", "action"].indexOf(ctx.phase ?? "");
    return <div className="vq-guide">
        <div className="vq-guide-title">{e.title}</div>
        <Stack direction="row" spacing={0.5} useFlexGap sx={{flexWrap: "wrap", mb: 1}}>
            {steps.map((label, index) => <Chip key={label} size="small" label={`${index + 1}. ${label}`}
                color={!finished && step === index ? "primary" : "default"}
                variant={!finished && step === index ? "filled" : "outlined"}/>)}
        </Stack>
        <Typography variant="subtitle2">{finished ? e.finished : lesson?.title}</Typography>
        {!finished && lesson && <>
            <Typography variant="body2" color={owner === playerID ? "primary" : "text.secondary"} sx={{my: 0.5}}>
                {`${e.currentOp}：P${Number(owner) + 1} · ${powerName(lesson.power, vqLocale)}。`}
                {playerID === null ? e.spectator : owner === playerID
                    ? e.yourTurn : `${e.waitOther} P${Number(owner) + 1} ${e.tab}.`}
            </Typography>
            <Typography variant="body2">{lesson.instruction}</Typography>
        </>}
        {finished && <Typography variant="body2">{e.review}</Typography>}
        <Button size="small" aria-expanded={expanded} aria-controls={contentID} sx={{px: 0}}
                onClick={() => setExpanded(!expanded)}>{expanded ? e.collapse : e.expand}</Button>
        {expanded && <Stack id={contentID} spacing={1}>
            <Typography variant="body2">{e.p1p2}</Typography>
            <Typography variant="caption" color="text.secondary">
                {e.scope}
                {e.ottomanWin}
            </Typography>
        </Stack>}
    </div>;
};
