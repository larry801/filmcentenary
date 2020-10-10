import React, {useEffect, useState} from "react";
import {useHistory, useParams} from "react-router-dom";
import {loadCredentials, saveCredentials} from "../../api/localStorage";
import {Player} from "../../Game";
import {getMatch, joinMatch, leaveMatch} from "../../api/match";
import {Loading, MultiPlayer, Spectate} from "./multiplayer";
import {ShareLink} from "./share";
import Typography from "@material-ui/core/Typography";
import i18n from "../../constant/i18n";
import {useI18n} from "@i18n-chain/react";
import {ChoiceDialog} from "../modals";

interface JoinPageProps {
    serverURL: string;
}

interface Params {
    matchID: string;
    player: Player;
}

export const JoinPage = ({serverURL}: JoinPageProps) => {
    useI18n(i18n);
    const history = useHistory();
    const {matchID, player}: Params = useParams();
    const [credentials, setCredentials] = useState("");
    const [error, setError] = useState("");
    const [numPlayers, setNumPlayers] = useState(0);
    useEffect(() => {
        const loadedCredential = loadCredentials(matchID, player);
        if (loadedCredential) {
            setCredentials(loadedCredential);
        } else {
            if (player !== "spectate") {
                joinMatch(serverURL, matchID, player)
                    .then((loadedCredential) => {
                        saveCredentials(matchID, player, loadedCredential);
                        setCredentials(loadedCredential);
                    })
                    .catch((err) => setError(err.toString()));
            }
        }

        if (player !== "spectate") {
            getMatch(serverURL, matchID)
                .then((data) => {
                    setNumPlayers(data.players.size)
                })
                .catch((err) => setError(err.toString))
        }
    }, [serverURL, matchID, player]);

    const handleLeave = (choice:string) => {
        if(choice==="yes"){
            leaveMatch(serverURL,matchID,player,credentials)
                .then(()=>history.push('/'))
                .catch((err) => setError(err.toString))
        }
    }

    return <>
        {error !== "" && <Typography>{error}</Typography>}
        {player === "spectate" ?
            <Spectate
                matchID={matchID}
                server={serverURL}/> :
            <>
            <MultiPlayer
                matchID={matchID}
                serverURL={serverURL}
                credentials={credentials}
                player={player}/>
                </>}
        {numPlayers > 0 && player !== "spectate"
            ? <ShareLink
                player={player}
                matchID={matchID}
                numPlayer={numPlayers}/>
            : <Loading/>}
        <ChoiceDialog
            initial={false}
            callback={handleLeave}
            choices={[
                {label: i18n.dialog.confirmRespond.yes, value: "yes", disabled: false, hidden: false},
                {label: i18n.dialog.confirmRespond.no, value: "no", disabled: false, hidden: false}
            ]} defaultChoice={"no"}
            show={player !== Player.spectate}
            title={i18n.lobby.leave} toggleText={i18n.lobby.leave}
        />
    </>
}
