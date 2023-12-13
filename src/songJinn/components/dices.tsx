import React from "react";
import {SJPubInfo} from "../constant/general";
import Typography from "@material-ui/core/Typography";

interface IDicesInfo {
    pub:SJPubInfo;
}

export const Dices = ({pub}:IDicesInfo) => {
    const sDice: number[] = pub.dices.length > 0 ? pub.dices[pub.dices.length - 1] : [];

    return <>
        {pub.dices.length > 0 && <Typography>{JSON.stringify(sDice)}中
            {sDice.filter(d => d > 3).length}
            |{sDice.filter(d => d > 4).length}
            |{sDice.filter(d => d > 5).length}
        </Typography>}</>
}