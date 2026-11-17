import React from "react";
import { useParams } from "react-router-dom";
import { CircularProgress, Typography, Grid, Link } from "@mui/material";
import { FilmCentenaryBoard } from "./board";
import { IG } from "../types/setup";
import { BoardProps } from "boardgame.io/react";
import { PlayerID } from "boardgame.io";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import { Link as RouterLink } from "react-router-dom";

/* ==================== 类型 ==================== */

interface IReplayRecord {
    version: number;
    matchID: string;
    exportedAt: string;
    state: {
        G: IG;
        ctx: any;
        plugins?: any;
        _undo?: any[];
        _redo?: any[];
        _stateID?: number;
    };
    log?: any[];
    metadata?: Array<{ id: number; name?: string; isConnected?: boolean }>;
    initialState?: any;
}

/* ==================== 只读 stub ==================== */

const noop = () => {};
const stubEvents: BoardProps<IG>["events"] = { endGame: noop, endPhase: noop, endTurn: noop, endStage: noop, setPhase: noop, setStage: noop };
const stubMoves: Record<string, (...args: any[]) => void> = {};
const stubMatchData = [{ id: 0, name: "复盘模式", isConnected: false }];

/* ==================== 组件 ==================== */

const MatchDataPage: React.FC = () => {
    const { matchID } = useParams();
    const [record, setRecord] = React.useState<IReplayRecord | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState("");

    React.useEffect(() => {
        setLoading(true);
        setError("");
        fetch(`/api/match-data/${matchID}`)
            .then((resp) => {
                if (!resp.ok) throw new Error(resp.status === 404 ? "对局未找到" : `请求失败 (${resp.status})`);
                return resp.json();
            })
            .then((data: IReplayRecord) => {
                setRecord(data);
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message);
                setLoading(false);
            });
    }, [matchID]);

    if (loading) {
        return (
            <Grid container sx={{justifyContent: "center"}} style={{ paddingTop: 80 }}>
                <CircularProgress size={48} />
            </Grid>
        );
    }

    if (error || !record) {
        return (
            <Grid container spacing={2} sx={{justifyContent: "center"}} style={{ paddingTop: 40 }}>
                <Grid container size={12} sx={{justifyContent: "center"}}>
                    <ErrorOutlineIcon color="error" fontSize="large" />
                </Grid>
                <Grid size={12}>
                    <Typography align="center" color="error">{error || "数据加载失败"}</Typography>
                </Grid>
                <Grid container size={12} sx={{justifyContent: "center"}}>
                    <Link component={RouterLink} to="/">返回首页</Link>
                </Grid>
            </Grid>
        );
    }

    const { state } = record;

    const boardProps = {
        ...state,
        log: record.log || [],
        events: stubEvents,
        moves: stubMoves,
        undo: noop,
        redo: noop,
        matchData: record.metadata || stubMatchData,
        matchID: record.matchID,
        playerID: null as unknown as PlayerID,
        isActive: false,
        isMultiplayer: false,
        isConnected: true,
    } as unknown as BoardProps<IG>;

    return <FilmCentenaryBoard {...boardProps} />;
};

export default MatchDataPage;
