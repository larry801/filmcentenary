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
    gameName: string;
}

interface Params {
    matchID: string;
    player: Player;
    credential?: string;
}

const JoinPage = ({serverURL, gameName}: JoinPageProps) => {
    useI18n(i18n);
    const history = useHistory();
    const {matchID, player, credential}: Params = useParams();
    const [credentials, setCredentials] = React.useState("generateCredentials");
    const [error, setError] = React.useState("");
    const [numPlayers, setNumPlayers] = React.useState(0);
    React.useEffect(() => {
        if (credential !== undefined) {
            setCredentials(credential);
        } else {
            const loadedCredential = loadCredentials(matchID, player, gameName);
            if (loadedCredential) {
                setCredentials(loadedCredential);
                history.push(`/join/${gameName}/${matchID}/${player}/${loadedCredential}`)
            } else {
                if (player !== Player.SPECTATE) {
                    joinMatch(serverURL, matchID, player, gameName)
                        .then((responseCredential) => {
                            saveCredentials(matchID, player, responseCredential);
                            setCredentials(responseCredential);
                            history.push(`/join/${matchID}/${player}/${responseCredential}`)
                        })
                        .catch((err) => {
                            setError(JSON.stringify(err));
                        });
                }
            }
        }
        if (player !== Player.SPECTATE) {
            getMatch(serverURL, matchID, gameName)
                .then((data) => {
                    setNumPlayers(data.players.size)
                })
                .catch((err) => {
                    // console.log(JSON.stringify(err));
                    setError(JSON.stringify(err));
                })
        }
    }, [serverURL, matchID, player, credential, history]);

    const handleLeave = (choice: string) => {
        if (choice === "yes") {
            leaveMatch(serverURL, matchID, player, credentials, gameName)
                .then(() => {
                    deleteCredentials(matchID, player);
                    history.push('/');
                })
                .catch((err) => setError(err.toString))

        }
    }
    const gameContent = player === Player.SPECTATE ?
        <Spectate
            gameName={gameName}
            matchID={matchID}
            server={serverURL}/> :
        <>
            <MultiPlayer
                gameName={gameName}
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
        {error !== "" ? <Typography>{error}</Typography> : <>
            {gameContent}
            <Typography>{window.location.href}</Typography>
        </>}
        {numPlayers > 0 ? <>
                <ShareLink
                    player={player}
                    matchID={matchID}
                    numPlayer={numPlayers}
                    gameName={gameName}
                />
            </>
            : <></>}
    </>
}
export default JoinPage;
