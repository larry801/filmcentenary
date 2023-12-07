import React from "react";
import {BoardProps} from "boardgame.io/react";
import {SongJinnGame} from "../constant/setup";
import ErrorBoundary from "../../components/error";
import Grid from "@material-ui/core/Grid";
import ChoiceDialog from "../../components/modals";
import {
    Country,
    SJPlayer, UNIT_SHORTHAND, DevelopChoice,
    SongUnit,
    JinnUnit,
    ActiveEvents,
    UNIT_FULL_NAME
} from "../constant/general";
import {getPlanById} from "../constant/plan";
import {getStateById, playerById, getCountryById, getStage} from "../util/fetch";
import Button from "@material-ui/core/Button";
import {getCityById} from "../constant/city";
import {getRegionById} from "../constant/regions";
import {sjCardById} from "../constant/cards";
import {remainDevelop} from "../util/calc";
import {PubInfo} from "./pub-info";
import {Operation} from "./operation";
import PlayerHand from "../../components/player-hand";
import {SJPlayerHand} from "./player-hand";
import LogView from "./view-log";
import {sjPlayerName} from "../util/text";

export const SongJinnBoard = ({
                                  G,
                                  log,
                                  ctx,
                                  events,
                                  moves,
                                  undo,
                                  redo,
                                  matchData,
                                  matchID,
                                  playerID,
                                  isActive,
                                  isMultiplayer,
                                  isConnected
                              }: BoardProps<SongJinnGame>) => {

    const pub = getStateById(G, playerID as SJPlayer);
    const player = playerById(G, playerID as SJPlayer);
    const country = getCountryById(playerID as SJPlayer);


    return <ErrorBoundary>
        <Grid container>
            {isActive && <Grid item>
                <PubInfo G={G} ctx={ctx}/>
                {pub.troops.map((t, idx) => {
                    const c = t.c === null ? "" : getCityById(t.c).name;
                    const p = t.p === null ? "" : (typeof t.p === "number" ? getRegionById(t.p).name : t.p.toString());
                    let shortUnits = '';
                    switch (t.country) {
                        case Country.JINN:
                            UNIT_SHORTHAND[1].forEach((v, i) => {
                                if (t.u[i] > 0) {
                                    shortUnits += `${t.u[i]}${v}`
                                }
                            });
                            break;
                        case Country.SONG:
                            UNIT_SHORTHAND[0].forEach((v, i) => {
                                if (t.u[i] > 0) {
                                    shortUnits += `${t.u[i]}${v}`;
                                }
                            });
                            break;
                    }
                    return <Button key={`troop-${idx}`}>{p}|{c}|{shortUnits}</Button>;
                })}
                <LogView log={log} getPlayerName={sjPlayerName} G={G}/>

            </Grid>}

            {playerID !== null &&
                <Grid>
                    <Operation
                        G={G} ctx={ctx}
                        playerID={playerID}
                        moves={moves}
                        isActive={isActive}
                    />
                    {isActive &&
                        <SJPlayerHand
                            moves={moves}
                            G={G} ctx={ctx}
                            isActive={isActive}
                            pid={playerID}
                        />
                    }
                </Grid>
            }
        </Grid>
    </ErrorBoundary>
}