import React from 'react';
import Dialog from "@mui/material/Dialog";
import Button from "@mui/material/Button";
import {Country, UNIT_SHORTHAND} from "../constant/general";
import Grid from "@mui/material/Grid";
import {useDebounce} from "../../components/modals";
import {usePrevious} from "../../components/board";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";


interface IChoiceProps {
    callback: (choice: number[]) => void,
    max: number[],
    initUnits: number[],
    disabled?: boolean,
    show: boolean,
    title: string,
    toggleText: string | React.JSX.Element,
    initial: boolean,
    popAfterShow?: boolean,
    buttonColor?: boolean,
    country: Country
}

export const ChooseUnitsDialog = ({
                                      show,
                                      popAfterShow,
                                      initUnits,
                                      toggleText,
                                      max,
                                      initial,
                                      callback,
                                      title,
                                      country
                                  }: IChoiceProps) => {
    // const initial = playerID === SJPlayer.P1 ? [0, 0, 0, 0, 0, 0] : [0, 0, 0, 0, 0, 0, 0];
    const [units, setUnits] = React.useState(initUnits);
    const [open, setOpen] = React.useState(initial);
    const unitNames = country === Country.JINN ? UNIT_SHORTHAND[1] : UNIT_SHORTHAND[0];

    const prevShow = usePrevious(show);

    React.useEffect(() => {
        setUnits(initUnits)
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
        callback(units);
    };

    const changeUnits = (idx: number, a: number) => {
        const newUnits = [...units];
        newUnits[idx] += a;
        setUnits(newUnits);
    }
    const debouncedHandleConfirm = useDebounce(handleConfirm, 400);

    return show ? <>
        <Button fullWidth variant={"outlined"} onClick={handleClickOpen}>{toggleText}</Button>
        <Dialog
            aria-label={title}
            open={open}
            onClose={handleClose}
        >
            <DialogTitle>
                {title}
            </DialogTitle>
            <DialogContent>
                <Grid container>
                    {units.map((u, idx) => {
                        if (max[idx] > 0) {
                            return <Grid key={`adjust-${idx}`} size={12}>
                                <Button
                                    disabled={u === 0}
                                    onClick={() => {
                                        changeUnits(idx, -1)
                                    }}>-</Button>
                                {u}{unitNames[idx]}
                                <Button
                                    disabled={u >= max[idx]}
                                    onClick={() => {
                                        changeUnits(idx, 1)
                                    }}
                                >+</Button>
                            </Grid>
                        } else {
                            return <div key={`adjust-${idx}`}></div>
                        }
                    })}
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={debouncedHandleConfirm}>确认</Button>
            </DialogActions>
        </Dialog>
    </> : <></>
}
