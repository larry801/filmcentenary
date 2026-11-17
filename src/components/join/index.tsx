import React from "react";
import {Link as RouterLink, useNavigate, useParams} from "react-router-dom";
import {deleteCredentials, loadCredentials, loadPlayerName, saveCredentials} from "../../api/localStorage";
import {Player} from "../../Game";
import {getMatch, joinMatch, leaveMatch} from "../../api/match";
import {MultiPlayer, Spectate} from "./multiplayer";
import {ShareLink} from "./share";
import {humanSeatIds} from "./humanSeats";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import i18n from "../../constant/i18n";
import ChoiceDialog from "../modals";
import Link  from "@mui/material/Link"

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
    i18n.use();
    const navigate = useNavigate();
    const {matchID, player, credential} = useParams() as unknown as Params;
    const [credentials, setCredentials] = React.useState("generateCredentials");
    const [error, setError] = React.useState("");
    const [numPlayers, setNumPlayers] = React.useState(0);
    // Imperial Elegy: the seats left to the Rule 34 bot are not joinable, and an
    // invite link must only cover the human ones.  `null` means "every seat".
    const [humanSeats, setHumanSeats] = React.useState<Set<string> | null>(null);
    React.useEffect(() => {
        let active = true;
        const loadMatch = async (): Promise<void> => {
            let meta: {players: Map<Player, string | null>; setupData?: Record<string, unknown>} | null = null;
            try {
                meta = await getMatch(serverURL, matchID, gameName);
            } catch (err) {
                if (active) setError(JSON.stringify(err));
                return;
            }
            if (!active) return;
            setNumPlayers(meta.players.size);
            const seats = humanSeatIds(gameName, meta.players, meta.setupData);
            setHumanSeats(seats);
            if (credential !== undefined) {
                setCredentials(credential);
                return;
            }
            const loadedCredential = loadCredentials(matchID, player, gameName);
            if (loadedCredential) {
                setCredentials(loadedCredential);
                navigate(`/join/${gameName}/${matchID}/${player}/${loadedCredential}`);
                return;
            }
            if (player === Player.SPECTATE) return;
            if (seats !== null && !seats.has(player)) {
                // A bot holds this seat (the server named it at creation), so
                // there is nothing for a human to take here.
                setError(i18n.chain.lobby.botSeatRefused);
                return;
            }
            try {
                const customName = loadPlayerName();
                const responseCredential = await joinMatch(serverURL, matchID, player, gameName, customName || undefined);
                if (!active) return;
                saveCredentials(matchID, player, responseCredential);
                setCredentials(responseCredential);
                navigate(`/join/${gameName}/${matchID}/${player}/${responseCredential}`);
            } catch (err) {
                if (active) setError(JSON.stringify(err));
            }
        };
        void loadMatch();
        return () => { active = false; };
    }, [serverURL, matchID, player, credential, gameName, navigate]);

    const handleLeave = (choice: string) => {
        if (choice === "yes") {
            leaveMatch(serverURL, matchID, player, credentials, gameName)
                .then(() => {
                    deleteCredentials(matchID, player);
                    navigate('/');
                })
                .catch((err) => setError(err?.toString?.() ?? String(err)))

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
                    {label: i18n.chain.dialog.confirmRespond.yes, value: "yes", disabled: false, hidden: false},
                    {label: i18n.chain.dialog.confirmRespond.no, value: "no", disabled: false, hidden: false}
                ]} defaultChoice={"no"}
                show={true}
                title={i18n.chain.lobby.leave} toggleText={i18n.chain.lobby.leave}
            />
        </>
    return (
        <Box sx={{p: 2}}>
            {error !== "" ? <Typography color="error">{error}</Typography> : <>
                {gameContent}
                <Link href={window.location.href} sx={{display: "block", mt: 1}}>本页链接</Link>
            </>}
            {numPlayers > 0 ? (
                <ShareLink
                    player={player}
                    matchID={matchID}
                    numPlayer={numPlayers}
                    gameName={gameName}
                    seats={humanSeats}
                />
            ) : null}
        </Box>
    )
}
export default JoinPage;
