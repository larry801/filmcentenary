import React from "react";
import {BoardProps} from "boardgame.io/react";
import {IG} from "../types/setup";
import {BoardRegion} from "./region";
import {Typography} from "@material-ui/core";
import {PlayerHand} from "./playerHand";
import {ChoiceDialog} from "./modals";
import {actualStage, studioInRegion} from "../game/util";
import i18n from "../constant/i18n";
import {FilteredMetadata, PlayerID} from "boardgame.io";
import Button from "@material-ui/core/Button";



export const FilmCentenaryBoard = ({G, ctx, moves, isActive, matchData, playerID}: BoardProps<IG>) => {


    function getName(playerID:PlayerID|null):string{
        const fallbackName =  i18n.playerName.player + playerID;
        if(playerID===null){
            return i18n.playerName.spectator
        }else {
            if(matchData===undefined){
                return fallbackName;
            }else {
                let arr = matchData.filter(m=>m.id.toString()===playerID)
                if(arr.length===0){
                    return fallbackName;
                }else {
                    return arr[0].name ===undefined?fallbackName:arr[0].name;
                }
            }
        }
    }
    return <div>
        {ctx.phase === "InitPhase"?<Button onClick={()=>moves.initialSetup(G.regions)}>                    {i18n.confirm}
        </Button> :<div></div>}
        <Typography>区域</Typography>
        <BoardRegion {...G.regions[0]}/>
        <BoardRegion {...G.regions[1]}/>
        <BoardRegion {...G.regions[2]}/>
        <BoardRegion {...G.regions[3]}/>
        {playerID !== null ? <PlayerHand G={G} playerID={playerID} ctx={ctx}/> : ""}
        <ChoiceDialog callback={moves.choose}
                      choices={
                          Array(G.playerCount)
                          .fill(1)
                          .map((i, idx) => idx)
                          .filter(p => !studioInRegion(G, ctx, G.e.card.region, p.toString()))
                          .map(pid => {
                              return {
                                  label: getName(pid.toString()),
                                  value: pid.toString(),
                                  hidden: false, disabled: false}
                          })
                      }
                      defaultChoice={'0'}
                      show={isActive && actualStage(G,ctx)==="chooseTarget"}
                      title={i18n.dialog.choosePlayer.title}
                      toggleText={i18n.dialog.choosePlayer.toggleText}
        />
    </div>
}
