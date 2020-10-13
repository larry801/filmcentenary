import React from "react";
import {FixedSizeList, ListChildComponentProps} from "react-window";
import Grid from "@material-ui/core/Grid";
import AutoSizer from "react-virtualized-auto-sizer";
import {LogEntry} from "boardgame.io";
import Button from "@material-ui/core/Button";
import {createStyles, makeStyles, Theme} from '@material-ui/core/styles';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import i18n from "../constant/i18n";
import {useI18n} from "@i18n-chain/react";
import {MoveNames} from "../types/core";
import shortid from 'shortid'

const useStyles = makeStyles((theme: Theme) =>
    createStyles({
        root: {
            width: '100%',
            minHeight: 160,
            maxHeight: 500,
            minWidth: 400,
            backgroundColor: theme.palette.background.paper,
        },
    }),
);

export interface ILogViewProps {
    log: LogEntry[],
    getPlayerName: (pid?: string) => string,
}

export const LogView = ({log, getPlayerName}: ILogViewProps) => {

    useI18n(i18n);
    const classes = useStyles();
    const [open, setOpen] = React.useState(true);
    const toggleGameLog = () => {
        setOpen(!open)
    }

    const getMoveText = (l: LogEntry): string => {
        switch (l.action.type) {
            case "MAKE_MOVE":
                let moveName = l.action.payload.type as MoveNames
                let pid = l.action.payload.playerID
                if (moveName === MoveNames.requestEndTurn) {
                    return `p${pid}.moves.requestEndTurn("${pid}");p${pid}.events.endTurn()`
                } else {
                    return `p${pid}.moves.${moveName}(${JSON.stringify(l.action.payload.args[0])})`
                }
            default:
                return ""
        }
    }

    const getLogText = (l: LogEntry): string => {
        switch (l.action.type) {
            case "GAME_EVENT":
                if (l.action.payload.type === "endTurn") {
                    return i18n.action.turnEnd({a: l.turn})
                } else {
                    return "";
                }
            case "MAKE_MOVE":
                let moveName = l.action.payload.type as MoveNames
                // @ts-ignore
                return getPlayerName(l.action.payload.playerID) + i18n.moves[moveName]({
                    args: l.action.payload.args
                })
            default:
                return ""
        }
    }

    return <Grid item container xs={12}>
        <Button fullWidth={true} onClick={toggleGameLog}>
            {i18n.pub.gameLog}
        </Button>

        {open && <> <Grid item xs={6} className={classes.root}>
            <AutoSizer
                defaultHeight={1000}
                defaultWidth={400}>
                {({height, width}) => <FixedSizeList
                    className="List"
                    height={height}
                    itemCount={log.length}
                    itemSize={40}
                    width={width}>
                    {({index, style}: ListChildComponentProps) => {
                        const i = log.length - index - 1;
                        const text = getLogText(log[i])
                        return text === "" ? <></> : <ListItem
                            button
                            // @ts-ignore
                            style={
                                // @ts-ignore
                                style
                            }
                            key={shortid.generate()}>
                            <ListItemText primary={text}/>
                        </ListItem>
                    }}
                </FixedSizeList>}
            </AutoSizer>
        </Grid>
            <Grid item xs={6}>
                {log.map((l: LogEntry) => <div key={shortid.generate()}>{getMoveText(l)}</div>)}
            </Grid>
        </>}
    </Grid>
}
