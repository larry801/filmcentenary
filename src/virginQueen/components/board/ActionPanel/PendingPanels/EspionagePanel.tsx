import React from "react";
import i18n from "../../../../constant/i18n";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES, powerName, Power} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {espionageOptions} from "../../../../espionage";

export const PendingEspionagePanel = (props: any) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const {G, moves, playerID} = props;
    const pending = G.pendingEspionage;
    const e = i18n.chain.vq.espionage;
    return (
        <Stack spacing={1}>
            <Typography>{e.title} · {e.waiting} {powerName(pending.responding, vqLocale)} {e.choose}。</Typography>
            <Typography variant="body2">
                {pending.step === "responses" ? e.responses :
                 pending.step === "offense" ? `${e.offense} ${pending.remaining} ${e.offenseMax}` :
                 pending.step === "conversions" ? `${e.conversions} ${pending.conversionSide === "protestant" ? e.protestant : e.catholic} ${e.conversions2}` :
                 pending.step === "rebelLosses" ? `${e.rebelLosses} ${pending.remaining} ${e.rebelLosses2}` :
                 pending.step === "massacreConvert" ? `${e.massacreConvert} ${pending.remaining} ${e.massacreConvert2}` :
                 pending.step === "massacreAssassinate" ? `${e.massacreAssassinate} ${pending.cp} ${e.massacreAssassinate2}` :
                 pending.step === "northernConvert" ? `${e.northernConvert} ${pending.remaining} ${e.northernConvert2}` :
                 pending.step === "northernUnrest" ? `${e.northernUnrest} ${pending.remaining} ${e.northernUnrest2}` :
                 e.default}
            </Typography>
            {ownerOf(G, pending.responding) === playerID && espionageOptions(G).map((entry: any) =>
                <Button key={entry.id} variant="outlined" onClick={() => moves.chooseEspionage({choice: entry.id})}>{entry.label}</Button>
            )}
        </Stack>
    );
};
