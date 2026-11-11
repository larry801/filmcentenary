import React from "react";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import i18n from "../../../../constant/i18n";
import {powerName} from "../../../constant/general";
import {ownerOf} from "../../../ownership";
import {espionageOptions} from "../../../espionage";
import {PendingPanelProps} from "./types";

/** Espionage resolution window (intelligence, informants, assassination, ...). */
export const PendingEspionagePanel = ({G, moves, playerID}: PendingPanelProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    if (G.pendingEspionage === undefined) return null;
    const step = G.pendingEspionage;
    const isResponder = ownerOf(G, step.responding) === playerID;
    return <Stack spacing={1}>
        <Paper variant="outlined" sx={{p: 1.5, bgcolor: "warning.light", borderColor: "warning.main"}}>
            <Typography variant="subtitle1" sx={{fontWeight: 700, color: "warning.dark"}}>⚠ {i18n.chain.vq.board.espionageTitle}</Typography>
            <Typography sx={{mt: 0.5}}>{isResponder ? i18n.chain.vq.espionage.yourChoice :
                `${i18n.chain.vq.board.waiting} ${powerName(step.responding, vqLocale)} ${i18n.chain.vq.board.choose}${i18n.chain.vq.punct.period}`}</Typography>
        </Paper>
        <Typography variant="body2">{step.step === "responses" ? i18n.chain.vq.espionage.responses :
            step.step === "offense" ? `${i18n.chain.vq.espionage.offense} ${step.remaining} ${i18n.chain.vq.espionage.offenseMax}` :
            step.step === "conversions" ? `${i18n.chain.vq.espionage.conversions} ${step.conversionSide === "protestant" ? i18n.chain.vq.espionage.protestant : i18n.chain.vq.espionage.catholic} ${i18n.chain.vq.espionage.conversions2}` :
            step.step === "rebelLosses" ? `${i18n.chain.vq.espionage.rebelLosses} ${step.remaining} ${i18n.chain.vq.espionage.rebelLosses2}` :
            step.step === "massacreConvert" ? `${i18n.chain.vq.espionage.massacreConvert} ${step.remaining} ${i18n.chain.vq.espionage.massacreConvert2}` :
            step.step === "massacreAssassinate" ? `${i18n.chain.vq.espionage.massacreAssassinate} ${step.cp} ${i18n.chain.vq.espionage.massacreAssassinate2}` :
            step.step === "northernConvert" ? `${i18n.chain.vq.espionage.northernConvert} ${step.remaining} ${i18n.chain.vq.espionage.northernConvert2}` :
            step.step === "northernUnrest" ? `${i18n.chain.vq.espionage.northernUnrest} ${step.remaining} ${i18n.chain.vq.espionage.northernUnrest2}` :
            i18n.chain.vq.espionage.default}</Typography>
        {ownerOf(G, step.responding) === playerID && espionageOptions(G).map((entry) =>
            <Button key={entry.id} variant="contained" onClick={() => moves.chooseEspionage({choice: entry.id})}>{entry.label}</Button>)}
    </Stack>;
};
