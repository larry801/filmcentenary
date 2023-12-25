import React, { useState } from "react";
import { SJPubInfo } from "../constant/general";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";

interface IDicesInfo {
    pub: SJPubInfo;
}

export const Dices = ({ pub }: IDicesInfo) => {
    const l = pub.dices.length;
    const [idx, setIdx] = useState(l - 1);
    const sDice: number[] = pub.dices[idx] !== undefined ? pub.dices[idx] : [];

    React.useEffect(() => {
        if (l >= 1) {
            setIdx(l - 1);
        }
    }, [l])

    const changeIdx = (a: number) => {
        if (idx + a < 0) {
            setIdx(0);
        } else {
            if (idx + a >= l) {
                setIdx(l - 1);
            } else {
                setIdx(idx + a);
            }
        }
    }

    return <>
        <Button onClick={() => changeIdx(-1)}>{'<'}</Button>
        <Button onClick={() => changeIdx(1)}>{'>'}</Button>
        <Button onClick={() => setIdx(l - 1)}>{'>>'}</Button>
        {l > 0 && <Typography>
            {idx}|
            {JSON.stringify(sDice)}
            共{sDice.length}个中
            |{sDice.filter(d => d > 2).length}
            |{sDice.filter(d => d > 3).length}
            |{sDice.filter(d => d > 4).length}
            |{sDice.filter(d => d > 5).length}个
        </Typography>}
    </>
}