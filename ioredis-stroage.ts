import {LogEntry, Server, State, StorageAPI} from "boardgame.io";
import {Async} from "boardgame.io/internal";

import Redis from 'ioredis';
import {ChainableCommander} from "ioredis/built/utils/RedisCommander";


const l = (c: string) => {};
// const l = (c: string) => console.log(Date.now().toString() + '|ioredis|' + c);
// 3 days
const expireTime = 3 * 24 * 60 * 60;
type FetchOpts = StorageAPI.FetchOpts;
type PlayerMetadata = {
    id: number;
    name?: string;
    credentials?: string;
    data?: any;
    isConnected?: boolean;
};

interface MatchData {
    gameName: string;
    players: {
        [id: number]: PlayerMetadata;
    };
    setupData?: any;
    gameover?: any;
    nextMatchID?: string;
    unlisted?: boolean;
    createdAt: number;
    updatedAt: number;
}

const matchPrefix = 'match:'

const flushExpire = (pipeline: ChainableCommander, matchID: string) => {
    pipeline.expire(`${matchPrefix}${matchID}:log`, expireTime);
    pipeline.expire(`${matchPrefix}${matchID}:state`, expireTime);
    pipeline.expire(`${matchPrefix}${matchID}:metadata`, expireTime);
    pipeline.expire(`${matchPrefix}${matchID}:initialState`, expireTime);
}

class RedisStorage extends Async {
    private redis: Redis;
    private hasJSON: boolean;

    constructor(url: string) {
        super();
        this.redis = new Redis(url);
        this.hasJSON = false;
    }

    async connect() {
        const pipeline = this.redis.pipeline();
        // @ts-ignore
        pipeline.module("LIST", (err, result: Array<Array<string>>) => {
            if (err) {
                console.error('Error sending MODULE LIST command:', err);
            } else {
                // Parse the result to check if ReJSON is in the list of loaded modules
                // TODO use ReJSON if available
                result.forEach((r) => {
                    if (r.includes("ReJSON")) {
                        console.log("Has ReJSON")
                        this.hasJSON = true;
                    }
                })
            }
        });
        await pipeline.exec();
    }


    async createMatch(matchID: string, opts: StorageAPI.CreateMatchOpts): Promise<void> {
        l('createMatch|' + matchID + JSON.stringify(opts));
        const pipeline = this.redis.pipeline();
        pipeline.set(`${matchPrefix}${matchID}:initialState`, JSON.stringify(opts.initialState));
        pipeline.set(`${matchPrefix}${matchID}:state`, JSON.stringify(opts.initialState));
        pipeline.set(`${matchPrefix}${matchID}:metadata`, JSON.stringify(opts.metadata));
        flushExpire(pipeline, matchID);
        await pipeline.exec();
    }

    async setState(matchID: string, state: State, deltalog?: LogEntry[]): Promise<void> {
        l('setState|' + matchID);

        const pipeline = this.redis.pipeline();
        pipeline.set(`${matchPrefix}${matchID}:state`, JSON.stringify(state));
        if (deltalog) {
            pipeline.rpush(`${matchPrefix}${matchID}:log`, ...deltalog.map(entry => JSON.stringify(entry)));
            pipeline.expire(`${matchPrefix}${matchID}:log`, expireTime);
        }
        flushExpire(pipeline, matchID);
        await pipeline.exec();
    }


    async setMetadata(matchID: string, metadata: Server.MatchData): Promise<void> {
        l('setMetadata' + matchID + JSON.stringify(metadata));

        const pipeline = this.redis.pipeline();
        pipeline.set(`${matchPrefix}${matchID}:metadata`, JSON.stringify(metadata));
        flushExpire(pipeline, matchID);
        await pipeline.exec();
    }

    async fetch<O extends FetchOpts>(matchID: string, opts: O): Promise<StorageAPI.FetchResult<O>> {
        l('fetch|' + matchID + JSON.stringify(opts));
        const results = await Promise.all([
            opts.state ? this.redis.get(`${matchPrefix}${matchID}:state`) : undefined,
            opts.log ? this.redis.lrange(`${matchPrefix}${matchID}:log`, 0, -1) : undefined,
            opts.metadata ? this.redis.get(`${matchPrefix}${matchID}:metadata`) : undefined,
            opts.initialState ? this.redis.get(`${matchPrefix}${matchID}:initialState`) : undefined,
        ]);

        const [rawState, rawLog, rawMetadata, rawInitialState] = results;
        return {
            state: rawState ? JSON.parse(rawState) : undefined,
            log: rawLog ? rawLog.map(entry => JSON.parse(entry)) : undefined,
            metadata: rawMetadata ? JSON.parse(rawMetadata) : undefined,
            initialState: rawInitialState ? JSON.parse(rawInitialState) : undefined,
        } as StorageAPI.FetchResult<O>;
    }

    async wipe(matchID: string): Promise<void> {
        l('wipe|' + matchID);
        const keysToDelete = [
            `${matchPrefix}${matchID}:state`,
            `${matchPrefix}${matchID}:log`,
            `${matchPrefix}${matchID}:metadata`,
            `${matchPrefix}${matchID}:initialState`,
        ];
        await this.redis.del(keysToDelete);
    }

    async listMatches(opts?: StorageAPI.ListMatchesOpts): Promise<string[]> {
        let cursor = '0';
        const matchIDs: string[] = [];

        do {
            // Using scan to fetch match keys
            const [newCursor, keys] = await this.redis.scan(cursor, 'MATCH', 'match:*:metadata', 'COUNT', 100);
            cursor = newCursor;

            for (const key of keys) {
                const matchID = key.split(':')[1];
                if (!opts || await this.matchFilter(matchID, opts)) {
                    matchIDs.push(matchID);
                }
            }
        } while (cursor !== '0');

        return matchIDs;
    }


    private async matchFilter(matchID: string, opts: StorageAPI.ListMatchesOpts): Promise<boolean> {
        l('matchFilter|' + JSON.stringify(opts));

        const metadata = await this.redis.get(`${matchPrefix}${matchID}:metadata`);
        if (metadata) {
            const parsedMetadata = JSON.parse(metadata) as MatchData;
            if (opts.gameName) {
                if (parsedMetadata.unlisted) {
                    l(`${matchID}|unlisted`);

                    return false;
                }
                if (parsedMetadata.gameName !== opts.gameName) {
                    l(`${metadata}name fail`);

                    return false;
                }
            }

            if (opts.where) {
                l(`where`);

                if (opts.where.isGameover !== undefined && parsedMetadata.gameover && opts.where.isGameover) {
                    l(`'game over fail'${parsedMetadata}`);

                    return false;
                }

                if (opts.where.updatedBefore !== undefined && parsedMetadata.updatedAt >= opts.where.updatedBefore) {
                    l('update before fail');

                    return false;
                }

                if (opts.where.updatedAfter !== undefined && parsedMetadata.updatedAt <= opts.where.updatedAfter) {
                    l('update after fail');
                    return false;
                }

            }
        } else {
            l('no meta data');

            return false;
        }
        l(`${matchID}|OK`);

        return true;
    }
}


export default RedisStorage;