import React from 'react';
import Dialog from "@material-ui/core/Dialog";
import Button from "@material-ui/core/Button";
import { Country, SongJinnGame, TroopPlace, UNIT_SHORTHAND, emptyJinnTroop, emptySongTroop, CityID, accumulator } from "../constant/general";
import Grid from "@material-ui/core/Grid";
import { useDebounce } from "../../components/modals";
import { usePrevious } from "../../components/board";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import { troopEndurance, unitsToString } from '../util';
import { Typography } from '@material-ui/core';


interface ITakeDmgProps {
    G: SongJinnGame;
    callback: (ready: number[], standby: number[]) => void,
    max: number[];
    initUnits: number[],
    disabled?: boolean,
    show: boolean;
    initial: boolean;
    p: TroopPlace;
    c: CityID | null;
    popAfterShow?: boolean,
    buttonColor?: boolean,
    country: Country
}

export const TakeDamageDialog = ({
    show,
    popAfterShow,
    initUnits,
    max,
    p, G, c,
    initial,
    callback,
    country
}: ITakeDmgProps) => {
    // const initial = playerID === SJPlayer.P1 ? [0, 0, 0, 0, 0, 0] : [0, 0, 0, 0, 0, 0, 0];
    const [readyUnits, setReadyUnits] = React.useState(initUnits);
    const [standbyUnits, setStandbyUnits] = React.useState(initUnits);
    const [open, setOpen] = React.useState(initial);
    const unitNames = country === Country.JINN ? UNIT_SHORTHAND[1] : UNIT_SHORTHAND[0];
    const emptyTroop = country === Country.JINN ? emptyJinnTroop() : emptySongTroop();

    const prevShow = usePrevious(show);

    React.useEffect(() => {
        setReadyUnits(initUnits);
        setStandbyUnits(initUnits);
    }, [initUnits]);

    React.useEffect(() => {
        if (show && prevShow === false && popAfterShow !== false) {
            setOpen(true);
        }
    }, [prevShow, show, popAfterShow])

    const handleClickOpen = () => {
        setOpen(true);
    };
    const handleClose = () => {
        setOpen(false);
    };
    const handleConfirm = () => {
        handleClose();
        callback(readyUnits, standbyUnits);
    };

    const changeStandbyUnits = (idx: number, a: number) => {
        const newUnits = [...standbyUnits];
        newUnits[idx] += a;
        setStandbyUnits(newUnits);
    }

    const changeUnits = (idx: number, a: number) => {
        const newUnits = [...readyUnits];
        newUnits[idx] += a;
        setReadyUnits(newUnits);
    }



    const mockStandby = { g: country, p: p, c: c, u: standbyUnits }
    const mockReady = { g: country, p: p, c: c, u: readyUnits }
    const readySum = readyUnits.reduce(accumulator);
    const standbySum = standbyUnits.reduce(accumulator);
    const readyText = readySum > 0 ? `溃${unitsToString(readyUnits)} (${troopEndurance(G, mockReady)})` : '';
    const standbyText = standbySum > 0 ? `死${unitsToString(standbyUnits)} (${troopEndurance(G, mockStandby)})` : '';


    const getAllEndurance = () => {
        const all = [...emptyTroop.u]
        for (let i = 0; i < emptyTroop.u.length; i++) {
            all[i] = readyUnits[i] + standbyUnits[i];
        }
        const mockAll = { ...mockReady, u: all };
        return troopEndurance(G, mockAll);
    }

    const fullText = `${readyText} ${standbyText} (${getAllEndurance()})`

    const debouncedHandleConfirm = useDebounce(handleConfirm, 400);

    const title = "受创" + fullText

    return show ? <>
        <Button fullWidth variant={"outlined"} onClick={handleClickOpen}>{title}</Button>
        <Dialog
            aria-label={title}
            open={open}
            onClose={handleClose}
        >
            <DialogTitle>
                {title}
            </DialogTitle>
            <DialogContent>
                <Grid container xs={12}>
                    <Grid item xs={6} >
                        <Typography>击溃 {readyText}</Typography>
                        {readyUnits.map((u, idx) => {
                            if (max[idx] > 0) {
                                return <Grid container item xs={12} key={`adjust-${idx}-grid`}>
                                    <Button
                                        disabled={u === 0}
                                        onClick={() => {
                                            changeUnits(idx, -1)
                                        }}>-</Button>
                                    {u}{unitNames[idx]}
                                    <Button
                                        disabled={u >= max[idx] || u + standbyUnits[idx] >= max[idx]}
                                        onClick={() => {
                                            changeUnits(idx, 1)
                                        }}
                                    >+</Button>

                                </Grid>
                            } else {
                                return <div key={`adjust-ready-${idx}`}></div>
                            }
                        })}
                    </Grid>
                    <Grid item xs={6} >
                        <Typography>消灭 {standbyText} </Typography>
                        {standbyUnits.map((u, idx) => {
                            if (max[idx] > 0) {
                                return <Grid item xs={12} key={`adjust-${idx}-standby-grid`}>
                                    <Button
                                        disabled={u === 0}
                                        onClick={() => {
                                            changeStandbyUnits(idx, -1)
                                        }}>-</Button>
                                    {u}{unitNames[idx]}
                                    <Button
                                        disabled={u >= max[idx] || u + readyUnits[idx] >= max[idx]}
                                        onClick={() => {
                                            changeStandbyUnits(idx, 1)
                                        }}
                                    >+</Button>
                                </Grid>
                            } else {
                                return <div key={`adjust-standby-${idx}`}></div>
                            }
                        })}
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={debouncedHandleConfirm}>
                    确认{title}
                </Button>
            </DialogActions>
        </Dialog>
    </> : <></>
}
