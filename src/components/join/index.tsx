import React from "react";
import {useHistory, useParams} from "react-router-dom";
import {deleteCredentials, loadCredentials, saveCredentials} from "../../api/localStorage";
import {Player} from "../../Game";
import {getMatch, joinMatch, leaveMatch} from "../../api/match";
import {MultiPlayer, Spectate} from "./multiplayer";
import {ShareLink} from "./share";
import Typography from "@material-ui/core/Typography";
import i18n from "../../constant/i18n";
import {useI18n} from "@i18n-chain/react";
import ChoiceDialog from "../modals";

interface JoinPageProps {
    serverURL: string;
}

interface Params {
    matchID: string;
    player: Player;
}

const JoinPage = ({serverURL}: JoinPageProps) => {
    useI18n(i18n);
    const history = useHistory();
    const {matchID, player}: Params = useParams();
    const [credentials, setCredentials] = React.useState("generateCredentials");
    const [error, setError] = React.useState("");
    const [numPlayers, setNumPlayers] = React.useState(0);
    React.useEffect(() => {
        const loadedCredential = loadCredentials(matchID, player);
        if (loadedCredential) {
            setCredentials(loadedCredential);
        } else {
            if (player !== Player.spectate) {
                joinMatch(serverURL, matchID, player)
                    .then((loadedCredential) => {
                        saveCredentials(matchID, player, loadedCredential);
                        setCredentials(loadedCredential);
                    })
                    .catch((err) => {
                        console.log(JSON.stringify(err));
                        getMatch(serverURL, matchID)
                            .then((data) => {
                                setNumPlayers(data.players.size)
                            })
                            .catch((err) => {
                                console.log(JSON.stringify(err));
                            })
                        // setError(err.toString());
                    });
            }
        }

        if (player !== Player.spectate) {
            getMatch(serverURL, matchID)
                .then((data) => {
                    setNumPlayers(data.players.size)
                })
                .catch((err) => {
                    console.log(JSON.stringify(err));
                    // setError(JSON.stringify(err));
                })
        }
    }, [serverURL, matchID, player]);

    const handleLeave = (choice: string) => {
        if (choice === "yes") {
            leaveMatch(serverURL, matchID, player, credentials)
                .then(() => {
                    deleteCredentials(matchID, player);
                    history.push('/');
                })
                .catch((err) => setError(err.toString))

        }
    }
    const gameContent = player === Player.spectate ?
        <Spectate
            matchID={matchID}
            server={serverURL}/> :
        <>
            <MultiPlayer
                matchID={matchID}
                serverURL={serverURL}
                credentials={credentials}
                player={player}/>
            <ChoiceDialog
                initial={false}
                callback={handleLeave}
                choices={[
                    {label: i18n.dialog.confirmRespond.yes, value: "yes", disabled: false, hidden: false},
                    {label: i18n.dialog.confirmRespond.no, value: "no", disabled: false, hidden: false}
                ]} defaultChoice={"no"}
                show={true}
                title={i18n.lobby.leave} toggleText={i18n.lobby.leave}
            />
        </>
    return <>
        {error !== "" ? <Typography>{error}</Typography> : <>{gameContent}{credentials}</>}
        {numPlayers > 0 ? <>
                <ShareLink
                    player={player}
                    matchID={matchID}
                    numPlayer={numPlayers}/>
            </>
            : <></>}
    </>
}
export default JoinPage;
